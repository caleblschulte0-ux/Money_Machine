import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server, type Socket } from "node:net";
import { TLSSocket, createSecureContext, type SecureContext } from "node:tls";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sendSmtp, SmtpEmailProvider } from "./smtp.ts";

/**
 * These tests run the client against a real SMTP conversation — an in-process
 * server speaking the actual wire protocol — not against a mock of the client
 * itself. If the client's EHLO/AUTH/DATA handling is wrong, these fail.
 */
interface Delivery {
  from: string;
  to: string[];
  data: string;
  authed: string | null;
}

class TestSmtpServer {
  readonly deliveries: Delivery[] = [];
  private server!: Server;
  port = 0;

  constructor(
    private readonly options: {
      auth?: "PLAIN" | "LOGIN";
      user?: string;
      pass?: string;
      starttls?: SecureContext;
    } = {},
  ) {}

  async start(): Promise<void> {
    this.server = createServer((socket) => this.session(socket));
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    this.port = (this.server.address() as { port: number }).port;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private session(raw: Socket): void {
    let socket: Socket | TLSSocket = raw;
    let buffer = "";
    let inData = false;
    let pendingLoginUser: string | null = null;
    let expectLoginPass = false;
    const current: Delivery = { from: "", to: [], data: "", authed: null };
    const write = (s: string) => socket.write(s + "\r\n");

    const ehloReply = () => {
      const lines = ["250-test.local"];
      if (this.options.starttls && socket === raw) lines.push("250-STARTTLS");
      if (this.options.auth) lines.push(`250-AUTH ${this.options.auth}`);
      lines.push("250 OK");
      socket.write(lines.join("\r\n") + "\r\n");
    };

    const online = (line: string): void => {
      if (inData) {
        if (line === ".") {
          inData = false;
          this.deliveries.push({ ...current, to: [...current.to] });
          write("250 Ok: queued as TESTQUEUE99");
        } else {
          current.data += (line.startsWith("..") ? line.slice(1) : line) + "\r\n";
        }
        return;
      }
      if (expectLoginPass) {
        expectLoginPass = false;
        const pass = Buffer.from(line, "base64").toString();
        if (pendingLoginUser === this.options.user && pass === this.options.pass) {
          current.authed = pendingLoginUser;
          write("235 ok");
        } else write("535 bad credentials");
        return;
      }
      const upper = line.toUpperCase();
      if (upper.startsWith("EHLO")) ehloReply();
      else if (upper === "STARTTLS" && this.options.starttls) {
        write("220 go ahead");
        socket = new TLSSocket(raw, { isServer: true, secureContext: this.options.starttls });
        buffer = "";
        socket.on("data", ondata);
      } else if (upper.startsWith("AUTH PLAIN")) {
        const decoded = Buffer.from(line.slice(11).trim(), "base64").toString();
        const [, user, pass] = decoded.split("\0");
        if (user === this.options.user && pass === this.options.pass) {
          current.authed = user!;
          write("235 ok");
        } else write("535 bad credentials");
      } else if (upper === "AUTH LOGIN") {
        write("334 VXNlcm5hbWU6");
        socket.once("data", () => {});
        expectLoginPass = false;
        pendingLoginUser = null;
        // next line is username
        const takeUser = (line2: string) => {
          pendingLoginUser = Buffer.from(line2, "base64").toString();
          expectLoginPass = true;
          write("334 UGFzc3dvcmQ6");
        };
        onceLine = takeUser;
      } else if (upper.startsWith("MAIL FROM")) {
        current.from = line.slice(line.indexOf("<") + 1, line.indexOf(">"));
        write("250 ok");
      } else if (upper.startsWith("RCPT TO")) {
        current.to.push(line.slice(line.indexOf("<") + 1, line.indexOf(">")));
        write("250 ok");
      } else if (upper === "DATA") {
        inData = true;
        current.data = "";
        write("354 go ahead");
      } else if (upper === "QUIT") {
        write("221 bye");
        socket.end();
      } else write("250 ok");
    };

    let onceLine: ((line: string) => void) | null = null;
    const ondata = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (onceLine) {
          const fn = onceLine;
          onceLine = null;
          fn(line);
        } else online(line);
      }
    };

    raw.on("data", ondata);
    write("220 test.local ESMTP");
  }
}

const message = {
  to: "dana@harbor-mechanical.invalid",
  from: "alerts@holdco.invalid",
  subject: "New signup on quote-chaser",
  body: "Dana Whitmore signed up.\n.hidden dot line\nEnd.",
};

describe("sendSmtp", () => {
  it("delivers a message over plain SMTP with AUTH PLAIN", async () => {
    const server = new TestSmtpServer({ auth: "PLAIN", user: "u", pass: "p" });
    await server.start();
    try {
      const result = await sendSmtp(
        { host: "127.0.0.1", port: server.port, user: "u", pass: "p", secure: false },
        message,
      );
      expect(result.providerMessageId).toBe("TESTQUEUE99");
      expect(server.deliveries).toHaveLength(1);
      const delivery = server.deliveries[0]!;
      expect(delivery.authed).toBe("u");
      expect(delivery.from).toBe(message.from);
      expect(delivery.to).toEqual([message.to]);
      expect(delivery.data).toContain("Subject: New signup on quote-chaser");
      // Dot-stuffing round-trip: the leading-dot line survived intact.
      expect(delivery.data).toContain("\r\n.hidden dot line\r\n");
    } finally {
      await server.stop();
    }
  });

  it("authenticates with AUTH LOGIN when PLAIN is not offered", async () => {
    const server = new TestSmtpServer({ auth: "LOGIN", user: "user2", pass: "pw2" });
    await server.start();
    try {
      await sendSmtp(
        { host: "127.0.0.1", port: server.port, user: "user2", pass: "pw2", secure: false },
        message,
      );
      expect(server.deliveries[0]?.authed).toBe("user2");
    } finally {
      await server.stop();
    }
  });

  it("fails loudly on bad credentials instead of sending", async () => {
    const server = new TestSmtpServer({ auth: "PLAIN", user: "u", pass: "right" });
    await server.start();
    try {
      await expect(
        sendSmtp(
          { host: "127.0.0.1", port: server.port, user: "u", pass: "wrong", secure: false },
          message,
        ),
      ).rejects.toThrow(/535/);
      expect(server.deliveries).toHaveLength(0);
    } finally {
      await server.stop();
    }
  });

  it("upgrades to TLS via STARTTLS and still delivers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "smtp-tls-"));
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 2 -nodes -subj "/CN=127.0.0.1" 2>/dev/null`,
      { cwd: dir },
    );
    const context = createSecureContext({
      key: readFileSync(join(dir, "key.pem")),
      cert: readFileSync(join(dir, "cert.pem")),
    });
    const server = new TestSmtpServer({ starttls: context });
    await server.start();
    try {
      const result = await sendSmtp(
        { host: "127.0.0.1", port: server.port, secure: false, rejectUnauthorized: false },
        message,
      );
      expect(result.providerMessageId).toBe("TESTQUEUE99");
      expect(server.deliveries).toHaveLength(1);
    } finally {
      await server.stop();
    }
  });

  it("times out fast against a dead server", async () => {
    const server = createServer(() => {
      /* accept and say nothing */
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    try {
      await expect(
        sendSmtp({ host: "127.0.0.1", port, secure: false, timeoutMs: 500 }, message),
      ).rejects.toThrow(/no reply|timed out/);
    } finally {
      server.close();
    }
  });

  it("strips CRLF from headers so a subject cannot inject commands", async () => {
    const server = new TestSmtpServer({});
    await server.start();
    try {
      await sendSmtp(
        { host: "127.0.0.1", port: server.port, secure: false },
        { ...message, subject: "Hi\r\nBcc: victim@example.invalid" },
      );
      const data = server.deliveries[0]!.data;
      expect(data).toContain("Subject: Hi Bcc: victim@example.invalid");
      expect(data).not.toContain("\r\nBcc:");
    } finally {
      await server.stop();
    }
  });
});

describe("SmtpEmailProvider", () => {
  let server: TestSmtpServer;

  beforeAll(async () => {
    server = new TestSmtpServer({});
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("declares that it delivers, so the live-communications gate applies", () => {
    const provider = new SmtpEmailProvider({ host: "127.0.0.1", port: server.port, secure: false });
    expect(provider.delivers).toBe(true);
    expect(provider.name).toBe("smtp");
  });

  it("sends through the EmailProvider interface", async () => {
    const provider = new SmtpEmailProvider({ host: "127.0.0.1", port: server.port, secure: false });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("TESTQUEUE99");
  });
});
