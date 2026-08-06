import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";
import { errors } from "@holdco/core";
import type { EmailMessage, EmailProvider, SendResult } from "./index.ts";

/**
 * A small, dependency-free SMTP client.
 *
 * Supports the three connection modes real providers use:
 *   - plain          (port 25/1025 — local sinks like Mailpit)
 *   - STARTTLS       (port 587 — most providers)
 *   - implicit TLS   (port 465)
 * and AUTH PLAIN / AUTH LOGIN.
 *
 * SMTP is a line-oriented text protocol; the whole client is "send a line,
 * read a reply, check the code". Multiline replies ("250-..." then "250 ")
 * are handled. Every step has a timeout so a dead server fails fast instead
 * of hanging a workflow.
 */
export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly user?: string;
  readonly pass?: string;
  /** true = implicit TLS from byte one (port 465). */
  readonly secure: boolean;
  /** Verify server certificates. Only disable for a local test sink. */
  readonly rejectUnauthorized?: boolean;
  readonly timeoutMs?: number;
}

class SmtpError extends Error {
  constructor(
    readonly code: number,
    readonly reply: string,
    stage: string,
  ) {
    super(`SMTP ${stage} failed: ${code} ${reply}`);
    this.name = "SmtpError";
  }
}

class SmtpConnection {
  private socket: Socket | TLSSocket;
  private buffer = "";
  private readonly timeoutMs: number;

  private constructor(socket: Socket | TLSSocket, timeoutMs: number) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
  }

  static async open(config: SmtpConfig): Promise<SmtpConnection> {
    const timeoutMs = config.timeoutMs ?? 15_000;
    const socket = await new Promise<Socket | TLSSocket>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      const s = config.secure
        ? tlsConnect(
            { host: config.host, port: config.port, rejectUnauthorized: config.rejectUnauthorized ?? true },
            () => { s.off("error", onError); resolve(s); },
          )
        : netConnect({ host: config.host, port: config.port }, () => {
            s.off("error", onError);
            resolve(s);
          });
      s.once("error", onError);
      s.setTimeout(timeoutMs, () => {
        s.destroy();
        reject(errors.timeout(`SMTP connect to ${config.host}:${config.port} timed out`));
      });
    });
    socket.setTimeout(0);
    return new SmtpConnection(socket, timeoutMs);
  }

  /** Read one complete (possibly multiline) SMTP reply. */
  async reply(stage: string): Promise<{ code: number; text: string }> {
    const raw = await new Promise<string>((resolve, reject) => {
      const tryParse = (): boolean => {
        const lines = this.buffer.split("\r\n");
        // A reply is complete when a line matches "NNN " (space, not hyphen).
        for (let i = 0; i < lines.length; i++) {
          if (/^\d{3} /.test(lines[i]!)) {
            const complete = lines.slice(0, i + 1).join("\r\n");
            this.buffer = lines.slice(i + 1).join("\r\n");
            resolve(complete);
            return true;
          }
        }
        return false;
      };
      if (tryParse()) return;

      const timer = setTimeout(() => {
        cleanup();
        reject(errors.timeout(`SMTP ${stage}: no reply within ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        if (tryParse()) cleanup();
      };
      const onClose = () => {
        cleanup();
        reject(new Error(`SMTP ${stage}: connection closed by server`));
      };
      const cleanup = () => {
        clearTimeout(timer);
        this.socket.off("data", onData);
        this.socket.off("close", onClose);
      };
      this.socket.on("data", onData);
      this.socket.once("close", onClose);
    });

    const code = Number(raw.slice(0, 3));
    return { code, text: raw };
  }

  async command(line: string, stage: string, expect: number[]): Promise<string> {
    this.socket.write(line + "\r\n");
    const { code, text } = await this.reply(stage);
    if (!expect.includes(Math.floor(code / 100)) && !expect.includes(code)) {
      throw new SmtpError(code, text, stage);
    }
    return text;
  }

  /** Upgrade a plain socket to TLS after STARTTLS was accepted. */
  async upgradeTls(config: SmtpConfig): Promise<void> {
    const plain = this.socket as Socket;
    this.socket = await new Promise<TLSSocket>((resolve, reject) => {
      const tls = tlsConnect(
        {
          socket: plain,
          host: config.host,
          servername: config.host,
          rejectUnauthorized: config.rejectUnauthorized ?? true,
        },
        () => resolve(tls),
      );
      tls.once("error", reject);
    });
    this.buffer = "";
  }

  end(): void {
    this.socket.end();
  }
}

/** Dot-stuffing per RFC 5321 §4.5.2, and enforce CRLF line endings. */
function encodeBody(body: string): string {
  return body
    .split(/\r?\n/)
    .map((line) => (line.startsWith(".") ? "." + line : line))
    .join("\r\n");
}

function headerSafe(value: string): string {
  // Header injection guard: a subject or address must never smuggle CRLF.
  return value.replace(/[\r\n]+/g, " ").trim();
}

export async function sendSmtp(config: SmtpConfig, message: EmailMessage): Promise<SendResult> {
  const connection = await SmtpConnection.open(config);
  try {
    await connection.reply("greeting");
    let ehlo = await connection.command(`EHLO holdco.local`, "EHLO", [2]);

    if (!config.secure && /STARTTLS/i.test(ehlo)) {
      await connection.command("STARTTLS", "STARTTLS", [2]);
      await connection.upgradeTls(config);
      ehlo = await connection.command(`EHLO holdco.local`, "EHLO after TLS", [2]);
    }

    if (config.user && config.pass) {
      if (/AUTH[ =][^\r\n]*PLAIN/i.test(ehlo)) {
        const token = Buffer.from(`\0${config.user}\0${config.pass}`, "utf8").toString("base64");
        await connection.command(`AUTH PLAIN ${token}`, "AUTH PLAIN", [2]);
      } else if (/AUTH[ =][^\r\n]*LOGIN/i.test(ehlo)) {
        await connection.command("AUTH LOGIN", "AUTH LOGIN", [3]);
        await connection.command(Buffer.from(config.user).toString("base64"), "AUTH user", [3]);
        await connection.command(Buffer.from(config.pass).toString("base64"), "AUTH pass", [2]);
      } else {
        throw new Error("SMTP server offers no supported AUTH mechanism (PLAIN or LOGIN)");
      }
    }

    await connection.command(`MAIL FROM:<${headerSafe(message.from)}>`, "MAIL FROM", [2]);
    await connection.command(`RCPT TO:<${headerSafe(message.to)}>`, "RCPT TO", [2]);
    await connection.command("DATA", "DATA", [3]);

    const headers = [
      `From: ${headerSafe(message.from)}`,
      `To: ${headerSafe(message.to)}`,
      `Subject: ${headerSafe(message.subject)}`,
      ...(message.replyTo ? [`Reply-To: ${headerSafe(message.replyTo)}`] : []),
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: 8bit`,
    ].join("\r\n");

    const accepted = await connection.command(
      `${headers}\r\n\r\n${encodeBody(message.body)}\r\n.`,
      "message body",
      [2],
    );

    await connection.command("QUIT", "QUIT", [2]);

    // Many servers include a queue id in the final 250; keep it as the message id.
    const id = accepted.match(/250[ -](?:2\.0\.0\s+)?(?:Ok:?\s*)?(?:queued as\s+)?(\S+)/i)?.[1];
    return {
      providerMessageId: id ?? `smtp-${Date.now()}`,
      acceptedAt: new Date(),
    };
  } finally {
    connection.end();
  }
}

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  /** SMTP delivers real mail, so ALLOW_LIVE_COMMUNICATIONS still gates every send. */
  readonly delivers = true;

  constructor(private readonly config: SmtpConfig) {}

  async send(message: EmailMessage): Promise<SendResult> {
    return sendSmtp(this.config, message);
  }
}
