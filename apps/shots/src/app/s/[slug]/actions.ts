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

  const { registry, capture, organizationId } = await getShots();
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

  return {
    status: result.accepted ? "ok" : "error",
    message: result.message,
  };
}
