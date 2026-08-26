/**
 * Welcome-back lines for when Barkly's person reopens the app after a while.
 * Scripted (no model call) so returning always lands instantly and free.
 * In-character per docs/CHARACTER.md; child-appropriate.
 */

const WITH_NAME = [
  (name: string) => `${name}. You're back. I counted the hours. It was a lot of hours.`,
  (name: string) => `Oh NOW ${name} shows up. I guarded the room the whole time. You're welcome.`,
  (name: string) => `${name}! I mean — hey. Whatever. I wasn't waiting by the door or anything.`,
];

const NO_NAME = [
  () => `You're back. I was starting to think the squirrels got you.`,
  () => `Oh, hey. I did absolutely nothing productive while you were gone. It was great.`,
  () => `Finally. The wall and I ran out of things to talk about.`,
];

/** Pick a greeting; `seed` keeps it varied without needing randomness in tests. */
export function welcomeBack(name: string | undefined, seed: number): string {
  const pool = name ? WITH_NAME : NO_NAME;
  const pick = pool[Math.abs(seed) % pool.length];
  return name ? (pick as (n: string) => string)(name) : (pick as () => string)();
}

/** Pull a name out of stored user facts like "Your person's name is Caleb." */
export function nameFromFacts(facts: string[]): string | undefined {
  for (const f of facts) {
    const m = f.match(/name is ([A-Z][a-zA-Z]+)/);
    if (m) return m[1];
  }
  return undefined;
}
