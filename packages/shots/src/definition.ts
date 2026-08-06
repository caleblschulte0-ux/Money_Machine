import { z } from "zod";

/**
 * A "shot" is one cheap attempt at a business idea.
 *
 * The whole point is speed: define an offer in a few lines, get a live page,
 * and find out within days whether anyone cares. A shot is NOT a venture. It
 * has no budget, no workflows and no agents. It graduates into a venture only
 * if it gets a response — which is the only thing that should earn it more of
 * your time.
 *
 * Three fields carry all the discipline:
 *  - `askedFor`      what the visitor has to give up. An email is weak evidence;
 *                    a deposit is strong. Stated so you don't fool yourself.
 *  - `killAfterDays` when this dies on its own if nothing happens.
 *  - `successLooksLike` written BEFORE launch, so a bad result cannot be
 *                    reinterpreted as a good one afterwards.
 */
export type ShotStatus = "draft" | "live" | "stuck" | "dead" | "graduated";

/** How much the visitor is committing. Higher = stronger evidence. */
export const SIGNAL_STRENGTH = {
  email: 1,
  waitlist_with_details: 2,
  booked_call: 3,
  deposit: 4,
  prepaid: 5,
} as const;

export type AskKind = keyof typeof SIGNAL_STRENGTH;

export interface Shot {
  /** URL slug: the page lives at /s/<slug>. */
  readonly slug: string;
  /** What you'd call this idea out loud. */
  readonly name: string;
  /** Who this is for, in their words, not a market category. */
  readonly forWhom: string;
  /** The problem, stated as the customer would say it. */
  readonly problem: string;
  /** What they get. Concrete enough that a stranger could deliver it. */
  readonly offer: string;
  /** Price. Use 0 only for a genuine free test, and expect weaker signal. */
  readonly priceMinor: number;
  readonly priceNote?: string;
  /** Three to five specifics. No adjectives, no "AI-powered". */
  readonly points: readonly string[];
  /** What you refuse to promise. Keeps you out of trouble later. */
  readonly notPromised: readonly string[];
  /** What the visitor gives up. Drives how much the result is worth. */
  readonly askedFor: AskKind;
  /** Button text. Say exactly what happens next. */
  readonly cta: string;
  /** Written before launch. "12 emails in 14 days", not "traction". */
  readonly successLooksLike: string;
  /** Dies automatically after this many days with no signal. */
  readonly killAfterDays: number;
  readonly status: ShotStatus;
  /** Optional: where you'll send traffic from. Keeps you honest about reach. */
  readonly trafficPlan?: string;
}

export const shotSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]{2,48}$/, "lowercase letters, digits and hyphens"),
  name: z.string().min(3),
  forWhom: z.string().min(10, "say who this is for, specifically"),
  problem: z.string().min(15, "state the problem as the customer would say it"),
  offer: z.string().min(20, "say concretely what they get"),
  priceMinor: z.number().int().min(0),
  priceNote: z.string().optional(),
  points: z.array(z.string().min(5)).min(2).max(6),
  notPromised: z.array(z.string().min(5)).min(1, "state at least one thing you do not promise"),
  askedFor: z.enum(["email", "waitlist_with_details", "booked_call", "deposit", "prepaid"]),
  cta: z.string().min(2),
  successLooksLike: z.string().min(10, "define success before launch, in numbers"),
  killAfterDays: z.number().int().min(1).max(90),
  status: z.enum(["draft", "live", "stuck", "dead", "graduated"]),
  trafficPlan: z.string().optional(),
});

export class ShotError extends Error {}

export function validateShot(shot: Shot): Shot {
  const parsed = shotSchema.safeParse(shot);
  if (!parsed.success) {
    throw new ShotError(
      `Shot "${shot.slug}" is not valid:\n` +
        parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  return shot;
}

export class ShotRegistry {
  private readonly shots = new Map<string, Shot>();

  register(shot: Shot): void {
    validateShot(shot);
    if (this.shots.has(shot.slug)) {
      throw new ShotError(`Shot "${shot.slug}" is already registered.`);
    }
    this.shots.set(shot.slug, shot);
  }

  get(slug: string): Shot | undefined {
    return this.shots.get(slug);
  }

  list(): readonly Shot[] {
    return [...this.shots.values()];
  }

  live(): readonly Shot[] {
    return this.list().filter((s) => s.status === "live");
  }
}

/** Evidence weight of one signup, so 40 emails don't outrank 2 deposits. */
export function signalWeight(shot: Shot): number {
  return SIGNAL_STRENGTH[shot.askedFor];
}
