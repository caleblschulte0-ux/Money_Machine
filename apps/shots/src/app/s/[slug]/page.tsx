import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { formatPrice, getShots } from "@/lib/shots";
import { SignupForm } from "./signup-form";
import "../../globals.css";

export const dynamic = "force-dynamic";

export default async function ShotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { registry, capture, organizationId } = await getShots();

  const shot = registry.get(slug);
  if (!shot || shot.status === "dead") notFound();

  // Count the visit. The key is a coarse hash of headers — enough to tell 30
  // people apart from 1 person refreshing 30 times, and not enough to identify
  // anybody.
  const h = await headers();
  const visitor = createHash("sha256")
    .update(h.get("user-agent") ?? "")
    .update(h.get("accept-language") ?? "")
    .update(new Date().toISOString().slice(0, 10))
    .digest("hex")
    .slice(0, 16);

  await capture.recordView({
    organizationId,
    slug: shot.slug,
    visitor,
    referrer: h.get("referer") ?? undefined,
  });

  return (
    <main className="page">
      <article className="pitch">
        <p className="eyebrow">For {shot.forWhom.toLowerCase()}</p>
        <h1>{shot.name}</h1>

        <p className="problem">{shot.problem}</p>

        <div className="offer">
          <h2>What you get</h2>
          <p>{shot.offer}</p>
          <p className="price">{formatPrice(shot)}</p>
        </div>

        <ul className="points">
          {shot.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <SignupForm slug={shot.slug} cta={shot.cta} askedFor={shot.askedFor} />

        <section className="not-promised">
          <h3>What this does not do</h3>
          <ul>
            {shot.notPromised.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <footer className="foot">
          <p>
            This is an early offer being tested. If not enough people want it, it will not be
            built — and if you signed up, you will be told so rather than left waiting.
          </p>
        </footer>
      </article>
    </main>
  );
}
