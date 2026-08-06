"use server";

import { getShots } from "@/lib/shots";

export interface SignupState {
  status: "idle" | "ok" | "error";
  message: string;
}

export async function submitSignup(
  _previous: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const honeypot = String(formData.get("website") ?? "");
  const renderedAt = Number(formData.get("renderedAt") ?? 0);

  if (!email.includes("@")) {
    return { status: "error", message: "That email address doesn't look right." };
  }

  const { registry, capture, organizationId, platform } = await getShots();
  const shot = registry.get(slug);
  if (!shot) {
    return { status: "error", message: "This offer is no longer available." };
  }

  const result = await capture.recordSignup({
    organizationId,
    shot,
    email,
    name: name || undefined,
    note: note || undefined,
    honeypot,
    submissionTimeMs: renderedAt > 0 ? Date.now() - renderedAt : undefined,
  });

  // Tell the owner a human responded — this is the moment the whole system
  // exists for. Best-effort: a notification failure must never lose a signup.
  const notifyTo = platform.env.OWNER_NOTIFY_EMAIL;
  if (result.accepted && notifyTo) {
    try {
      await platform.communications.sendEmail({
        organizationId,
        ventureId: null,
        to: notifyTo,
        from: platform.env.SMTP_FROM ?? "shots@localhost",
        subject: `[shot: ${shot.slug}] signup from ${email}`,
        body:
          `Shot: ${shot.name} (${shot.slug})\n` +
          `Who:  ${name || "(no name)"} <${email}>\n` +
          (note ? `Note: ${note}\n` : "") +
          `Ask:  ${shot.askedFor}\n\n` +
          `Reply to them personally and quickly — speed is most of the conversion.`,
        purpose: "transactional",
      });
    } catch {
      // Logged by the communications service; the signup is already stored.
    }
  }

  return {
    status: result.accepted ? "ok" : "error",
    message: result.message,
  };
}
