/**
 * Working out what was actually said.
 *
 * The offline brain used to test the whole sentence against seven regexes and
 * give up. "I'm going to the store later" matched `walk` on the word "go" and
 * got an excited OUTSIDE?! line that answered nothing; "do you like the rain"
 * matched nothing at all and fell into a four-line generic pool.
 *
 * This does the small amount of parsing that makes a reply able to be ABOUT
 * something: pull the content words out, notice what kind of sentence it is,
 * notice how the person feels. No model, no dependencies — just enough
 * structure that the composer has a subject to talk about.
 */

export type Intent =
  | 'greeting'
  | 'opinion' // "do you like X", "what do you think of X"
  | 'define' // "what is X"
  | 'why' // "why is X"
  | 'ability' // "can you X", "have you ever X"
  | 'feeling' // "i'm sad", "i had a great day"
  | 'tell' // "tell me about X", "tell me a story"
  | 'agree' // "yes", "no", "ok", "lol"
  | 'statement'; // everything else that has a subject

export type Feeling = 'sad' | 'happy' | 'tired' | 'bored' | 'angry' | 'scared' | 'sick';

export interface Understanding {
  intent: Intent;
  /** The thing the sentence is about, in the person's own words. */
  subject?: string;
  /** True when the subject is somebody — family, a friend, a name. */
  person?: boolean;
  feeling?: Feeling;
  /** True when there was nothing to go on — a grunt, an emoji, punctuation. */
  empty: boolean;
}

/**
 * Words that are never what a sentence is ABOUT. Deliberately long: the
 * quality of every reply downstream depends on the subject being a real noun
 * and not "really" or "think".
 */
const STOP = new Set(
  (
    'a an the and or but if then than that this these those there here it its it\'s is am are was were be been being ' +
    'do does did doing done have has had having will would shall should can could may might must ' +
    'i me my mine myself you your yours yourself we us our ours they them their he she him her his hers ' +
    'what who whom whose which when where why how not no yes yeah yep nope ok okay sure ' +
    'to of in on at by for with about from into over under up down out off again once ' +
    'so very really just quite too also only even still much more most some any all both each few other ' +
    'everything anything something nothing everyone anyone someone nobody everybody somebody ' +
    'everywhere anywhere somewhere always never sometimes often maybe probably ' +
    'get got go goes going went come comes coming make makes made take takes took see sees saw look looks looked ' +
    'know knows knew think thinks thought say says said tell tells told want wants wanted like likes liked ' +
    'remember remembers remembered forget forgets forgot feel feels felt need needs needed try tries tried ' +
    'give gives gave put puts keep keeps kept let lets find finds found ask asks asked work works worked ' +
    'call calls called seem seems talk talks talked turn turns hear hears heard leave leaves left ' +
    'mean means meant show shows showed start starts started run runs ran move moves moved live lives ' +
    'believe believes stay stays played playing ' +
    'time day today tomorrow yesterday now later thing things stuff lot lots bit ' +
    'good bad nice great okay fine well right wrong sorry please thanks thank hi hello hey ' +
    'am\'t don\'t doesn\'t didn\'t can\'t won\'t isn\'t aren\'t wasn\'t weren\'t haven\'t hasn\'t'
  ).split(/\s+/),
);

/**
 * Words that mean A PERSON the player cares about.
 *
 * This is not polish, it is a content rule. Stances are hashed, and the hash
 * happily made "sister" and "grandma" land on `against` — so he answered
 * "my grandma sent a card" with "Grandma and I have history. It is not good
 * history." In a children's app he does not get to dislike your family.
 * People route to their own warm branch and never to a hashed verdict.
 */
const PEOPLE = new Set(
  ('mum mom mummy mommy mother dad daddy father parents sister brother sibling ' +
   'grandma grandad grandpa granny nan nana grandmother grandfather ' +
   'aunt auntie uncle cousin nephew niece baby family friend friends bestie ' +
   'teacher teachers classmate classmates neighbour neighbours neighbor neighbors ' +
   'coach babysitter mate mates pal buddy'
  ).split(/\s+/),
);

/**
 * True for a relationship word, or for a capitalised word in the middle of a
 * sentence — which is almost always somebody's name.
 */
export function looksLikePerson(word: string, sentence: string): boolean {
  if (PEOPLE.has(word.toLowerCase())) return true;
  const m = sentence.match(new RegExp(`(^|[^.!?]\\s)\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i'));
  if (!m) return false;
  const found = m[2];
  // Capitalised, not the first word of the sentence, not shouting.
  return /^[A-Z][a-z]+$/.test(found) && sentence.trim().indexOf(found) > 0;
}

const FEELINGS: { feeling: Feeling; re: RegExp }[] = [
  { feeling: 'sad', re: /\b(sad|upset|down|crying|cried|lonely|miss(ing)?|hurt|bad day|rough day|awful day)\b/i },
  { feeling: 'happy', re: /\b(happy|great|amazing|excited|good day|best day|glad|proud|won|passed)\b/i },
  { feeling: 'tired', re: /\b(tired|exhausted|sleepy|knackered|worn out|long day)\b/i },
  { feeling: 'bored', re: /\b(bored|boring|nothing to do|meh)\b/i },
  { feeling: 'angry', re: /\b(angry|mad|annoyed|furious|frustrated|hate this)\b/i },
  { feeling: 'scared', re: /\b(scared|afraid|nervous|worried|anxious|frightened)\b/i },
  { feeling: 'sick', re: /\b(sick|ill|unwell|poorly|hurts|headache|sore)\b/i },
];

/** Content words, longest first — the longest word is usually the point. */
export function keywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)].sort((a, b) => b.length - a.length);
}

/**
 * The subject, in the SPEAKER'S casing where possible — echoing back the word
 * they typed is most of what makes a reply feel heard.
 */
function subjectFrom(text: string): string | undefined {
  const words = keywords(text);
  if (words.length === 0) return undefined;
  // A sentence with a PERSON in it is about that person. "my sister is
  // annoying" picked "annoying" (the longest word) and missed the person
  // branch entirely, so he gave a verdict on the adjective.
  const named = words.find((w) => looksLikePerson(w, text) && /^[A-Z][a-z]+$/.test(cased(w, text) ?? ''));
  const person = words.find((w) => looksLikePerson(w, text));
  const best = named ?? person ?? complementOf(text, words) ?? words[0];
  return cased(best, text) ?? best;
}

/**
 * "my favorite food is PIZZA" is about pizza.
 *
 * `keywords` sorts longest-first, so a sentence introducing something the
 * player cares about got a verdict on whichever qualifier happened to be
 * longest: telling him "my favorite food is pizza" produced "Hm. Favorite.
 * Favorite is fine... do we need to do somethin' about favorite?" -- the exact
 * moment a stranger decides he is not really listening. Found by playing the
 * shipped first session as a new player would, 2026-09-03.
 *
 * In a copula sentence the point is the COMPLEMENT, so take the first content
 * word after the verb. This sits BELOW the person rules on purpose: "my
 * sister is annoying" is still about the sister, not about being annoying.
 */
function complementOf(text: string, words: string[]): string | undefined {
  const m = text.match(/\b(?:my|our|his|her|their|the)\b[^.?!]*?\b(?:is|are|was|were)\b\s+(.+)$/i);
  if (!m) return undefined;
  const tail = keywords(m[1]);
  if (tail.length === 0) return undefined;
  // Whichever complement word survives the stoplist, in SENTENCE order rather
  // than longest-first -- "is a really good stick" is about the stick.
  const ordered = m[1]
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => tail.includes(w));
  const pick = ordered[ordered.length - 1] ?? tail[0];
  return words.includes(pick) ? pick : undefined;
}

/** The word as the speaker typed it, so his echo matches their sentence. */
function cased(word: string, text: string): string | undefined {
  const m = text.match(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
  return m ? m[0] : undefined;
}

export function understand(text: string): Understanding {
  const raw = text.trim();
  const t = raw.toLowerCase();
  const subject = subjectFrom(raw);
  const person = subject ? looksLikePerson(subject, raw) : false;
  const feeling = FEELINGS.find((f) => f.re.test(t))?.feeling;

  // Intent first, THEN emptiness. Getting this the other way round is what
  // made "hi" and "i had a bad day" — both made entirely of stopwords — come
  // back as "nothing to go on". Empty means: no content words AND no shape
  // worth answering.
  const intent = readIntent(t, feeling);
  // A question mark or a wh-word means they asked something, even when every
  // word in it is a stopword ("how?", "what should we do today").
  const asked = /\?/.test(raw) || /\b(what|why|how|who|where|when|can|do|does|did|are|is|will|would|should)\b/.test(t);
  const empty = raw.length === 0 || (keywords(raw).length === 0 && intent === 'statement' && !asked);

  return { intent, subject, person, feeling, empty };
}

function readIntent(t: string, feeling: Feeling | undefined): Intent {
  // Order matters: the more specific shapes first.
  if (/^\s*(hi|hello|hey|yo|sup|hiya|morning|evening|good morning|good night)\b/.test(t)) return 'greeting';
  if (
    /\b(do|d'?you|would|did) (you|u) (like|love|hate|mind|enjoy|fancy)\b|\bwhat (do|d')? ?you think (of|about)\b|\bhow (do you feel|about)\b|\byour (opinion|thoughts)\b/.test(t)
  ) {
    return 'opinion';
  }
  if (/\btell me (about|a)\b|\bwhat about\b/.test(t)) return 'tell';
  if (/\bwhat('?s| is| are)\b|\bwhat kind of\b/.test(t)) return 'define';
  if (/\bwhy\b/.test(t)) return 'why';
  if (/\b(can|could|will|would|have|do) (you|u)\b|\bever\b/.test(t)) return 'ability';
  if (feeling && /\b(i|i'?m|im|my|me|we)\b/.test(t)) return 'feeling';
  if (/^\s*(yes|yeah|yep|no|nope|ok|okay|sure|lol|haha|hmm|maybe|k)\b[\s.!?]*$/.test(t)) return 'agree';
  return 'statement';
}
