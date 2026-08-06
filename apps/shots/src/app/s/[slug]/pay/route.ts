import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getShots } from "@/lib/shots";

/**
 * Click-through to a shot's payment link. Records the click (the strongest
 * signal a page can produce short of the payment itself) and redirects to the
 * owner's own checkout link. No money passes through this platform.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const { registry, capture, organizationId } = await getShots();

  const shot = registry.get(slug);
  if (!shot?.paymentLinkUrl) {
    return NextResponse.redirect(new URL(`/s/${slug}`, request.url));
  }

  const visitor = createHash("sha256")
    .update(request.headers.get("user-agent") ?? "")
    .update(request.headers.get("accept-language") ?? "")
    .update(new Date().toISOString().slice(0, 10))
    .digest("hex")
    .slice(0, 16);

  await capture.recordPaymentClick({ organizationId, slug, visitor });
  return NextResponse.redirect(shot.paymentLinkUrl);
}
