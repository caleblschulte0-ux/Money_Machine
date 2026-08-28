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

function clipIng(text: string): string {
  return text.replace(/\b([A-Za-z]{2,})ing\b/g, (whole, stem: string) => {
    if (NOT_A_SUFFIX.has(whole.toLowerCase())) return whole;
    return `${stem}in'`;
  });
}

export interface VoiceOptions {
  /** 0 = off, 1 = full. Below 1 the openers and closers thin out first. */
  strength?: number;
}

/**
 * Put a line in his mouth.
 *
 * Idempotent in practice: the rules rewrite standard English into dialect, and
 * running it twice finds nothing left to change. That matters because a line
 * can pass through here and then be quoted back in a later prompt.
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
  let landed = 0;
  for (const { rule } of order) {
    if (landed >= MAX_FLAVOUR) break;
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
  const garnish = seed % 6;
  // His thoughts are written lowercase on purpose (they are not spoken, they
  // are overheard). A capitalised "Ay." bolted to the front breaks that.
  const spoken = /^[A-Z]/.test(text.trimStart());
  if (strength >= 1 && garnish === 0 && spoken) {
    const opener = OPENERS[seed % OPENERS.length];
    if (!out.startsWith(opener)) out = `${opener} ${out}`;
  } else if (strength >= 1 && garnish === 1) {
    const closer = CLOSERS[seed % CLOSERS.length];
    const end = out.trimEnd();
    const punctuated = /[.!?]$/.test(end) ? end : `${end}.`;
    if (!punctuated.endsWith(closer)) out = `${punctuated} ${closer}`;
  }

  return out;
}
