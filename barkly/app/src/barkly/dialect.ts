/**
 * How Barkly talks. He is from the Bronx.
 *
 * This is a LAYER, not a rewrite, and that is the whole point: he has ~300
 * hand-written lines and an offline brain that composes new sentences from
 * your words at runtime. Rewriting the 300 would leave every generated line
 * speaking flat General English, and the generated ones are most of what you
 * actually hear. One transform at the end of the speaking path catches both.
 *
 * THE RULES ARE WHOLE-WORD, ALWAYS. Never a bare substring. "th" → "d" as a
 * substring turns Matthew into Maddew and your name into rubble; `\bthat\b`
 * cannot. Every rule below is anchored, and the tests drive real names,
 * treasure names and user input through it looking for damage.
 *
 * STRENGTH IS CAPPED ON PURPOSE. Eye-dialect is a seasoning. Every "the" as
 * "da" and every "this" as "dis" in the same breath is a Sopranos impression,
 * not a character — and a child has to read this. So the always-safe
 * contractions apply everywhere, the strong markers apply at most twice per
 * line, and which ones land is decided by a hash of the line itself. That
 * makes it deterministic (the same sentence always sounds the same, which is
 * what makes him feel like a person rather than a randomiser) and varied
 * across different sentences.
 *
 * WHAT IT IS NOT. It does not swear, it does not insult, and it adds no
 * meaning — every rule is a spelling change or a set phrase. A dialect layer
 * that could change what a sentence SAYS would be a content bug waiting to
 * happen in a children's app.
 */

/** Stable, order-independent hash so a given line always voices identically. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Keep the original capitalisation when a word is swapped. */
function like(original: string, replacement: string): string {
  if (original[0] === original[0]?.toUpperCase() && original[0] !== original[0]?.toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Words that merely END in "ing" — they have no -ing suffix to clip.
 * Without this, "thing" becomes "thin'" and "the good thing" turns into
 * something about being slim.
 */
const NOT_A_SUFFIX = new Set([
  'thing', 'king', 'ring', 'sing', 'bring', 'string', 'wing', 'spring',
  'swing', 'cling', 'sting', 'fling', 'ding', 'ping', 'zing', 'during',
]);

/** Applied every time. Contractions a New Yorker uses and nobody misreads. */
const ALWAYS: [RegExp, string][] = [
  // The negatives contract FIRST. Otherwise "you will not believe" becomes
  // "you'll not believe", which is a vicar, not a dog from the Bronx.
  [/\bwill not\b/gi, "won't"],
  [/\bcan not\b/gi, "can't"],
  [/\bcannot\b/gi, "can't"],
  [/\bdo not\b/gi, "don't"],
  [/\bdoes not\b/gi, "doesn't"],
  [/\bdid not\b/gi, "didn't"],
  [/\bis not\b/gi, "ain't"],
  [/\bisn't\b/gi, "ain't"],
  [/\baren't\b/gi, "ain't"],
  [/\bare not\b/gi, "ain't"],
  [/\bgoing to\b/gi, 'gonna'],
  [/\bwant to\b/gi, 'wanna'],
  [/\bgot to\b/gi, 'gotta'],
  [/\bhave to\b/gi, 'gotta'],
  [/\bkind of\b/gi, 'kinda'],
  [/\bsort of\b/gi, 'sorta'],
  [/\blet me\b/gi, 'lemme'],
  [/\bgive me\b/gi, 'gimme'],
  [/\bout of\b/gi, 'outta'],
  /**
   * These two are the only replacements that END in an apostrophe, which makes
   * them the only ones that can collide with the one already in the word.
   * `\bsomething\b` matches inside "Something's" — an apostrophe is a non-word
   * character, so the boundary sits right before it — and the result was
   * "Somethin''s gone from my head", which is not an accent, it is a typo in a
   * children's app. The possessive form takes the bare stem and keeps the
   * apostrophe the word came with.
   */
  [/\bnothing(?=['\u2019])/gi, 'nuttin'],
  [/\bsomething(?=['\u2019])/gi, 'somethin'],
  [/\bnothing\b/gi, "nuttin'"],
  [/\bsomething\b/gi, "somethin'"],
  /**
   * Fixed phrases first. "There you are" is not "there you're" — the verb is
   * stressed and cannot contract, and the app greets you with that exact
   * phrase, so the broken version was the first thing he said on a return.
   */
  [/\bthere you are\b/gi, 'dere ya are'],
  [/\bhere you are\b/gi, 'here ya are'],
  [/\byou are\b/gi, "you're"],
  [/\byou will\b/gi, "you'll"],
  [/\byou have\b/gi, "you've"],
  [/\byes\b/gi, 'yeah'],
  [/\bvery\b/gi, 'real'],
];

/**
 * The strong markers. At most two of these land per line — see `MAX_FLAVOUR`.
 * These are what make it read as the Bronx rather than merely casual.
 */
const FLAVOUR: [RegExp, string][] = [
  [/\bthat\b/gi, 'dat'],
  [/\bthis\b/gi, 'dis'],
  [/\bthose\b/gi, 'doze'],
  [/\bthem\b/gi, 'dem'],
  [/\bthere\b/gi, 'dere'],
  [/\bthese\b/gi, 'dese'],
  [/\bthe\b/gi, 'da'],
  /**
   * "you" → "ya" only where it is genuinely unstressed.
   *
   * Two traps. `\byou\b` matches the "you" inside "you're", because an
   * apostrophe is a non-word character — that produced "ya're". And in front of
   * an auxiliary it produces "Ya are marginally better", which is not an
   * accent, it is a grammar mistake. The contractions above catch the common
   * pairs first; this lookahead covers the rest.
   */
  [/\byou\b(?!['\u2019])(?!\s+(?:are|were|have|had|will|would|can|could|should)\b)/gi, 'ya'],
  [/\byour\b(?!['\u2019])/gi, 'ya'],
];

const MAX_FLAVOUR = 2;

/**
 * Words that can be a whole first sentence and still MEAN something. Anything
 * else standing alone in front of a line is, in practice, the name of the
 * person he is talking to — that is the only single word the app ever puts
 * there.
 */
const REAL_OPENERS = new Set([
  'ay', 'yo', 'hey', 'hi', 'hello', 'no', 'nope', 'yes', 'yeah', 'okay', 'ok',
  'right', 'fine', 'wow', 'look', 'listen', 'wait', 'stop', 'exactly', 'anyway',
  'nice', 'good', 'oh', 'well', 'sure', 'again', 'please', 'sorry', 'done',
]);

/**
 * Split "Caleb. Dere ya are." into the name and the rest.
 *
 * Lives here rather than in the voice layer because two separate things need
 * the same answer and must never disagree about it: this file, so his accent
 * does not change depending on what a child is called, and the pre-recorded
 * voice bank, which can hold the body of that line and can never hold the name.
 */
export function splitLeadingName(text: string): [string | null, string] {
  // Unicode-aware on purpose: a child called Zoë or José has a name too, and an
  // ASCII-only pattern silently stopped recognising it — which cost them the
  // recorded voice on every line he greets them by name.
  // \p{M} matters as much as \p{L}: a name typed on a phone can arrive
  // DECOMPOSED, so the í in Aísha is an i followed by a combining accent — a
  // Mark, not a Letter. Without it the pattern sees "A" and gives up.
  const m = text.match(/^(\p{Lu}[\p{L}\p{M}'\u2019-]{1,15})[.,!]\s+(\S[\s\S]*)$/u);
  if (!m || REAL_OPENERS.has(m[1].toLowerCase())) return [null, text];
  return [m[1], m[2]];
}

/**
 * Everything the strong markers can produce. Used to count what a line ALREADY
 * carries before spending any of the budget on it — which is what makes the cap
 * a real cap and the whole transform idempotent. See `bronx` below.
 */
const MARKER = /\b(da|dat|dis|dese|doze|dem|dere|ya)\b/gi;

/** Openers. One lands roughly a third of the time, never two. */
const OPENERS = ['Ay.', 'Yo.', 'Ay, yo.', 'Lemme tell ya.', "I'm not gonna lie to ya."];

/**
 * Closers. Same budget as an opener — a line gets one or the other, or neither.
 *
 * "Fuhgeddaboudit" is deliberately NOT here. It means a specific thing ("don't
 * mention it" / "no chance"), so bolted onto an arbitrary sentence it reads as
 * a tourist doing an impression: "I have been extremely brave in ya absence.
 * Fuhgeddaboudit." These three attach to anything without changing what it
 * says, which is the bar for a rule that fires on lines nobody has read.
 */
const CLOSERS = ['awright?', "I'm just sayin'.", 'Capisce?'];

/**
 * "waiting" -> "waitin'". The trailing apostrophe is the whole point of the
 * rule, so a word that already ends in one — "waiting's", "everything's" —
 * has to take the stem bare and keep its own, or you get a doubled apostrophe.
 */
function clipIng(text: string): string {
  return text.replace(/\b([A-Za-z]{2,})ing\b(['\u2019]?)/g, (whole, stem: string, apos: string) => {
    const word = whole.slice(0, whole.length - apos.length);
    if (NOT_A_SUFFIX.has(word.toLowerCase())) return whole;
    return apos ? `${stem}in${apos}` : `${stem}in'`;
  });
}

export interface VoiceOptions {
  /** 0 = off, 1 = full. Below 1 the openers and closers thin out first. */
  strength?: number;
}

/**
 * Put a line in his mouth.
 *
 * IDEMPOTENT, and that took two goes to get right.
 *
 * A line can pass through here and be quoted back later — into a prompt, into
 * a greeting he repeats, into the pre-recorded voice bank whose keys are the
 * spoken form. So `bronx(bronx(x))` has to equal `bronx(x)`, and the first
 * version failed that on 51 of his 146 fixed lines. Two independent leaks, both
 * invisible unless you actually run the corpus through twice:
 *
 *   THE GARNISH IS SEEDED ON THE INPUT, so a second pass hashes different text,
 *   picks a different opener, and does not recognise the one already there.
 *   "Dere ya are." became "Yo. Dere ya are." became something with two of them.
 *
 *   THE BUDGET WAS SPENT PER RULE, not per marker. A second pass starts with a
 *   fresh budget of two and chews two more words, so a line drifts further into
 *   parody every time it is repeated.
 *
 * Both are fixed below by looking at what the line already IS rather than
 * trusting a seed: markers already present count against the budget, and a line
 * that already opens or closes with a garnish gets none. `tests/dialect.test.ts`
 * runs every line in the game through twice.
 */
export function bronx(text: string, opts: VoiceOptions = {}): string {
  const strength = opts.strength ?? 1;
  if (!text || strength <= 0) return text;
  // Nothing to voice. Without this, whitespace came back as ". I'm just
  // sayin'." — a garnish attached to no sentence at all.
  if (!/[A-Za-z]/.test(text)) return text;

  let out = text;
  for (const [pattern, replacement] of ALWAYS) {
    out = out.replace(pattern, (m) => like(m, replacement));
  }
  out = clipIng(out);

  // Which strong markers land is a property of THIS sentence, so the same
  // sentence always comes out the same way.
  const seed = hash(text);
  const order = FLAVOUR.map((rule, i) => ({ rule, i })).sort(
    (a, b) => ((seed + a.i * 37) % 101) - ((seed + b.i * 37) % 101),
  );
  /**
   * The budget counts MARKERS, not rules, and it counts the ones that are
   * already there. `ALWAYS` can plant two of them on its own ("there you are"
   * -> "dere ya are"), and a line coming back through for a second time is full
   * of them. Starting from zero is what let a repeated line keep getting
   * thicker until he sounded like an impression.
   */
  MARKER.lastIndex = 0;
  let landed = (out.match(MARKER) ?? []).length;
  /**
   * ONE HELPING, EVER. If the line already carries a marker — planted by
   * `ALWAYS` above, or by a previous trip through here — it is seasoned and we
   * are done. A per-pass budget looks equivalent and is not: a line with one
   * marker and one spare would pick up a second on its next pass and a third
   * the time after, so a greeting he repeats thickens into a Sopranos
   * impression over a week of use.
   */
  for (const { rule } of order) {
    if (landed >= MAX_FLAVOUR || landed > 0) break;
    const [pattern, replacement] = rule;
    if (!pattern.test(out)) {
      pattern.lastIndex = 0;
      continue;
    }
    pattern.lastIndex = 0;
    // Only the FIRST occurrence: replacing every "the" in a sentence is the
    // parody. One is an accent.
    let done = false;
    out = out.replace(pattern, (m) => {
      if (done) return m;
      done = true;
      return like(m, replacement);
    });
    landed += 1;
  }

  // An opener or a closer, never both, and only sometimes — one line in three.
  // At `% 3` two lines in three got garnished and he sounded like he was doing
  // a bit rather than talking.
  /**
   * The garnish is decided by the BODY — the line with any existing opener or
   * closer taken back off, and its trailing punctuation ignored.
   *
   * Not by `text`, which was the second idempotence leak. Seeding on the input
   * means a second pass hashes a string that now begins "Yo." and lands on a
   * different decision, so the line collects another one. Hashing the body is
   * invariant: strip the garnish off a garnished line and you are holding
   * exactly what the first pass hashed.
   */
  let body = out.trimStart();
  /**
   * The name he is addressing you by is not part of the sentence for this
   * purpose. Without this, "Mateo. Ask me somethin'." and "Caleb. Ask me
   * somethin'." hash differently and one of them picks up a closer the other
   * does not — so his accent would depend on what a child is called, and the
   * recording of the body would stop matching for half of them.
   */
  body = splitLeadingName(body)[1];
  const worn = OPENERS.find((o) => body.startsWith(o));
  if (worn) body = body.slice(worn.length).trimStart();
  body = body.trimEnd();
  const wearing = CLOSERS.find((c) => body.endsWith(c));
  if (wearing) body = body.slice(0, -wearing.length).trimEnd();
  // The closer adds a full stop to a line that had none, so the punctuation
  // cannot be part of what we hash.
  const bodySeed = hash(body.replace(/[.!?\u2026\s]+$/, ''));
  const garnish = bodySeed % 6;

  // His thoughts are written lowercase on purpose (they are not spoken, they
  // are overheard). A capitalised "Ay." bolted to the front breaks that.
  const spokenAloud = /^[A-Z]/.test(body);

  // `body` dropped the name for hashing; the line still starts with it.
  const [addressed] = splitLeadingName(out.trimStart());
  const prefix = addressed ? `${addressed}. ` : '';
  out = body;
  if (strength >= 1 && garnish === 0 && spokenAloud) {
    out = `${OPENERS[bodySeed % OPENERS.length]} ${out}`;
  } else if (strength >= 1 && garnish === 1) {
    const closer = CLOSERS[bodySeed % CLOSERS.length];
    out = `${/[.!?]$/.test(out) ? out : `${out}.`} ${closer}`;
  }

  return prefix + out;
}
