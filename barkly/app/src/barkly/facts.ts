/**
 * Barkly's structured character memory: facts and shared experiences.
 *
 * The MVP stored memory as a flat list of sentences, which had two fatal
 * production problems: Barkly could believe "favorite color is blue" AND
 * "favorite color is green" forever, and everything decayed in importance at
 * the same rate (i.e. not at all). This module replaces that with addressable
 * facts that UPDATE IN PLACE, and experiences that are first-class objects.
 *
 * Pure and platform-agnostic - no storage, no React, no clock except what
 * callers pass in, so all of it is directly testable.
 *
 * SECURITY: every string here originates from a user or a model and is treated
 * as DATA, never instructions. `sanitize()` is applied before anything reaches
 * a prompt. See prompts.ts for the delimiting.
 */

export type FactCategory =
  | 'identity'      // name, age, where they live
  | 'preference'    // favorite color, food, music
  | 'family'        // siblings, parents
  | 'pet'           // other animals in the house
  | 'person'        // friends, teachers, important people
  | 'promise'       // "we'll play tomorrow"
  | 'interest'      // recurring topics they care about
  | 'event'         // meaningful things that happened to them
  | 'opinion';      // Barkly's own stated opinions

export const FACT_CATEGORIES: FactCategory[] = [
  'identity', 'preference', 'family', 'pet', 'person',
  'promise', 'interest', 'event', 'opinion',
];

/**
 * One addressable thing Barkly knows. Identity is (subject, key) - learning a
 * new value for the same pair UPDATES rather than appends, which is what stops
 * him believing two contradictory things at once.
 */
export interface Fact {
  id: string;
  category: FactCategory;
  /** Who the fact is about: 'person' (his human), 'barkly', or a name. */
  subject: string;
  /** Stable slug within the subject: 'name', 'favorite_color', 'pet_name'. */
  key: string;
  value: string;
  /** 0-1. Rises when repeated. */
  confidence: number;
  /** 0-1. How much this matters - a name outranks a passing comment. */
  importance: number;
  learnedAt: number;
  updatedAt: number;
  lastReferencedAt: number;
  referenceCount: number;
  source: 'user' | 'inferred' | 'world';
  /** Prior values, newest first - so a correction is a change, not amnesia. */
  history?: { value: string; until: number }[];
}

/** Something Barkly believes he and his person did together. */
export interface Experience {
  id: string;
  /** "Caleb threw the ball for me at the park." */
  what: string;
  /** Where it happened, when known. */
  where?: string;
  at: number;
  importance: number;
  /** Other dogs involved. */
  withWhom?: string[];
  lastReferencedAt: number;
  referenceCount: number;
}

// --------------------------------------------------------------- sanitizing

/**
 * Replace control characters (C0, DEL, C1) with spaces. Done by char code
 * rather than a regex literal so this source file stays plain ASCII.
 */
function stripControlChars(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out += c < 32 || (c >= 127 && c <= 159) ? ' ' : s[i];
  }
  return out;
}

/**
 * Make a user- or model-derived string safe to place inside a prompt as data.
 * Strips control characters, collapses whitespace, neutralizes fence/delimiter
 * sequences, and caps length. Never throws.
 */
export function sanitize(raw: unknown, maxLen = 220): string {
  if (typeof raw !== 'string') return '';
  let s = stripControlChars(raw);
  // Neutralize anything that looks like a delimiter, tag, or role marker.
  s = s
    .replace(/`{3,}/g, "'''")
    // Angle runs: neutralizes the memory-block fences themselves, so a stored
    // value can never close the block early and escape into instruction space.
    .replace(/<{2,}|>{2,}/g, ' ')
    .replace(/<\/?[a-zA-Z][^>]{0,40}>/g, ' ')
    .replace(/\[\[|\]\]/g, ' ')
    // Role markers anywhere in the string, not just at line start.
    .replace(/\b(system|assistant|user|human)\s*:/gi, '$1-')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > maxLen) s = s.slice(0, maxLen - 1) + '…';
  return s;
}

/** Slugify a fact key so 'Favorite Color' and 'favorite_color' are one fact. */
export function normalizeKey(key: string): string {
  return sanitize(key, 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ------------------------------------------------------------ fact creation

/** Importance heuristics - what a person would naturally regard as mattering. */
const CATEGORY_IMPORTANCE: Record<FactCategory, number> = {
  identity: 1.0,
  promise: 0.9,
  family: 0.85,
  pet: 0.8,
  person: 0.7,
  preference: 0.6,
  interest: 0.55,
  event: 0.5,
  opinion: 0.4,
};

/** A person's name is the single most important thing he can know. */
function importanceFor(category: FactCategory, key: string): number {
  if (key === 'name') return 1.0;
  return CATEGORY_IMPORTANCE[category] ?? 0.5;
}

export interface FactInput {
  category?: FactCategory;
  subject?: string;
  key: string;
  value: string;
  source?: Fact['source'];
  confidence?: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function makeFact(input: FactInput, now: number): Fact | null {
  const key = normalizeKey(input.key);
  const value = sanitize(input.value);
  if (!key || !value) return null;
  const subject = normalizeKey(input.subject || 'person') || 'person';
  const category = input.category && FACT_CATEGORIES.includes(input.category)
    ? input.category
    : inferCategory(key);
  return {
    id: `${subject}.${key}`,
    category,
    subject,
    key,
    value,
    confidence: clamp01(input.confidence ?? 0.8),
    importance: importanceFor(category, key),
    learnedAt: now,
    updatedAt: now,
    lastReferencedAt: now,
    referenceCount: 0,
    source: input.source ?? 'user',
  };
}

/** Guess a category from the key when the model didn't supply one. */
export function inferCategory(key: string): FactCategory {
  if (/^name$|^age$|^birthday$|^lives/.test(key)) return 'identity';
  if (/^favorite|^likes|^dislikes|^hates/.test(key)) return 'preference';
  if (/sibling|brother|sister|mom|dad|parent|family/.test(key)) return 'family';
  if (/^pet|dog|cat|hamster/.test(key)) return 'pet';
  if (/friend|teacher|coach|grandma|grandpa/.test(key)) return 'person';
  if (/promise|owes|will_/.test(key)) return 'promise';
  if (/hobby|interest|plays|watches/.test(key)) return 'interest';
  return 'event';
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Best-effort parse of a loose statement into a structured fact, so a model
 * that returns prose instead of fields still produces usable memory.
 * Handles: "person.favorite_color = blue", "favorite color: blue",
 * "Your person's name is Caleb.", "His name is Caleb".
 */
export function parseFactStatement(raw: string, now: number): Fact | null {
  const s = sanitize(raw, 300);
  if (!s) return null;

  // subject.key = value  /  key = value  /  key: value
  const assign = s.match(/^([a-zA-Z][\w.]*)\s*[=:]\s*(.+)$/);
  if (assign) {
    const path = assign[1];
    const value = assign[2];
    const dot = path.lastIndexOf('.');
    return makeFact(
      dot > 0
        ? { subject: path.slice(0, dot), key: path.slice(dot + 1), value }
        : { key: path, value },
      now,
    );
  }

  // "<possessive> <thing> is <value>" - e.g. "Your person's name is Caleb."
  const isForm = s.match(
    /^(?:your person'?s?|their|his|her|the user'?s?|my)?\s*([a-zA-Z][a-zA-Z ']{1,40}?)\s+is\s+(.+?)\.?$/i,
  );
  if (isForm) {
    return makeFact({ key: isForm[1], value: isForm[2] }, now);
  }

  // Nothing structured - keep it as a low-importance note keyed by content so
  // repeats collapse instead of stacking.
  return makeFact(
    { category: 'event', key: `note_${hashString(s).toString(36)}`, value: s, confidence: 0.5 },
    now,
  );
}

/**
 * A personal statement the OFFLINE brain should keep.
 *
 * `parseFactStatement` has always been able to turn "my favorite food is
 * pizza" into a fact -- but nothing offline ever handed it one. The scripted
 * provider only ever learned a NAME, so with no model configured (which is
 * every web playtest a stranger will ever open) Barkly forgot everything
 * personal the moment it was said: tell him your favourite food, ask him
 * thirty seconds later, and he had nothing. That is the product's core
 * promise failing in the exact build used to validate the product.
 *
 * Deliberately narrow. It answers "did they just tell me something about
 * themselves", and it must say no to:
 *   - questions ("what is my favorite food") -- storing those as facts is how
 *     he ends up "remembering" that your favourite food is a question mark;
 *   - anything about Barkly rather than the speaker ("your name is silly");
 *   - values long enough to be a paragraph of instructions wearing a fact's
 *     clothing. `makeFact` sanitises, but the shorter gate is here.
 *
 * Returns a `key = value` string in the same shape every other caller uses,
 * so it flows through the identical merge/rank path as a model-extracted one.
 */
export function personalFactFrom(raw: string): string | null {
  const s = sanitize(raw, 200).trim();
  if (!s || /\?/.test(s)) return null;
  // A wh-word anywhere in a short sentence means they are asking, not telling.
  if (/\b(what|which|who|where|when|why|how|do|does|did|is|are|can|could)\b/i.test(s.split(/\s+/)[0] ?? '')) {
    return null;
  }

  const possessive = s.match(
    /^my\s+(favou?rite\s+[a-z ]{2,24}|[a-z]{2,20}(?:'s)?\s?[a-z]{0,20})\s+(?:is|are|was)\s+(.{2,60}?)[.!]?$/i,
  );
  if (possessive) {
    // `normalizeKey`, not the raw words: `parseFactStatement`'s key pattern is
    // `[a-zA-Z][\w.]*`, which has no room for a space, so "favorite food =
    // pizza" fell past the structured branch and was filed as an unstructured
    // note ("note denodj"). It was genuinely stored and completely unfindable
    // -- caught only by reading the Settings memory list in a real browser
    // after the unit tests were already green.
    const key = normalizeKey(possessive[1]);
    const value = possessive[2].trim();
    if (!key || !value) return null;
    return `${key} = ${value}`;
  }

  const loves = s.match(/^i\s+(love|like|hate|really like|can'?t stand)\s+(.{2,60}?)[.!]?$/i);
  if (loves) {
    const verb = loves[1].toLowerCase();
    const key = /hate|stand/.test(verb) ? 'dislikes' : 'likes';
    return `${key} = ${loves[2].trim()}`;
  }

  return null;
}

// ---------------------------------------------------------------- merging

export interface MergeResult {
  facts: Fact[];
  /** Facts whose value actually changed - the "actually, it's green now" case. */
  updated: { fact: Fact; previous: string }[];
  added: Fact[];
}

/**
 * Merge an incoming fact into the store. Same (subject, key):
 *  - identical value  -> confidence up, timestamps touched, NOT duplicated
 *  - different value  -> value replaced, old value pushed to history
 * This is the single rule that stops contradictions accumulating.
 */
export function mergeFact(facts: Fact[], incoming: Fact, now: number): MergeResult {
  const out = [...facts];
  const idx = out.findIndex((f) => f.subject === incoming.subject && f.key === incoming.key);
  if (idx === -1) {
    out.push(incoming);
    return { facts: out, updated: [], added: [incoming] };
  }
  const existing = out[idx];
  if (existing.value.toLowerCase() === incoming.value.toLowerCase()) {
    // Heard again - more confident, more recently relevant, still one fact.
    out[idx] = {
      ...existing,
      confidence: clamp01(existing.confidence + 0.1),
      updatedAt: now,
      lastReferencedAt: now,
      referenceCount: existing.referenceCount + 1,
    };
    return { facts: out, updated: [], added: [] };
  }
  const corrected: Fact = {
    ...existing,
    value: incoming.value,
    confidence: clamp01(Math.max(incoming.confidence, 0.7)),
    updatedAt: now,
    lastReferencedAt: now,
    history: [{ value: existing.value, until: now }, ...(existing.history ?? [])].slice(0, 5),
  };
  out[idx] = corrected;
  return { facts: out, updated: [{ fact: corrected, previous: existing.value }], added: [] };
}

export function mergeFacts(facts: Fact[], incoming: Fact[], now: number): MergeResult {
  let acc: MergeResult = { facts, updated: [], added: [] };
  for (const f of incoming) {
    const r = mergeFact(acc.facts, f, now);
    acc = {
      facts: r.facts,
      updated: [...acc.updated, ...r.updated],
      added: [...acc.added, ...r.added],
    };
  }
  return acc;
}

// ---------------------------------------------------------------- ranking

const DAY_MS = 86_400_000;

/**
 * Relevance score: importance, damped by age, lifted by how often it comes up.
 * Used to decide what fits in the prompt - a name never falls out; a passing
 * remark from three weeks ago does.
 */
export function factScore(f: Fact, now: number): number {
  const ageDays = Math.max(0, (now - f.updatedAt) / DAY_MS);
  const recency = 1 / (1 + ageDays / 14); // half-weight at two weeks
  const frequency = Math.min(1, f.referenceCount / 5);
  return f.importance * f.confidence * (0.55 + 0.3 * recency + 0.15 * frequency);
}

export function rankFacts(facts: Fact[], now: number, limit = 18): Fact[] {
  return [...facts].sort((a, b) => factScore(b, now) - factScore(a, now)).slice(0, limit);
}

export function experienceScore(e: Experience, now: number): number {
  const ageDays = Math.max(0, (now - e.at) / DAY_MS);
  const recency = 1 / (1 + ageDays / 7); // experiences fade faster than facts
  return e.importance * (0.5 + 0.5 * recency);
}

export function rankExperiences(list: Experience[], now: number, limit = 8): Experience[] {
  return [...list].sort((a, b) => experienceScore(b, now) - experienceScore(a, now)).slice(0, limit);
}

// ------------------------------------------------------------- experiences

export function makeExperience(
  what: string,
  now: number,
  opts: { where?: string; withWhom?: string[]; importance?: number } = {},
): Experience | null {
  const text = sanitize(what, 200);
  if (!text) return null;
  return {
    id: `exp_${now.toString(36)}_${hashString(text).toString(36)}`,
    what: text,
    where: opts.where ? sanitize(opts.where, 40) : undefined,
    at: now,
    importance: clamp01(opts.importance ?? 0.6),
    withWhom: opts.withWhom?.map((w) => sanitize(w, 30)).filter(Boolean),
    lastReferencedAt: now,
    referenceCount: 0,
  };
}

/** Add an experience, collapsing near-duplicates rather than stacking them. */
export function addExperience(list: Experience[], incoming: Experience, cap = 80): Experience[] {
  const same = list.findIndex((e) => e.what.toLowerCase() === incoming.what.toLowerCase());
  if (same !== -1) {
    const out = [...list];
    out[same] = {
      ...out[same],
      at: incoming.at,
      referenceCount: out[same].referenceCount + 1,
      importance: clamp01(out[same].importance + 0.05),
    };
    return out;
  }
  return [...list, incoming].slice(-cap);
}

// --------------------------------------------------------- human formatting

/** "your person: favorite color = blue" - for the prompt and Settings list. */
export function describeFact(f: Fact): string {
  const who = f.subject === 'person' ? 'your person' : f.subject;
  const what = f.key.replace(/_/g, ' ');
  return `${who}: ${what} = ${f.value}`;
}
