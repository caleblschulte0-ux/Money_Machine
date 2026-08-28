/**
 * Building a reply, rather than choosing one.
 *
 * The old offline brain SELECTED: seven keyword buckets of 2–4 lines each, and
 * a four-line pool for everything else. Every conversation that wasn't about
 * food, walks or the other dogs got one of those four. That is why it felt
 * like four lines — it was.
 *
 * This COMPOSES. A reply is assembled from parts:
 *
 *     [ opener that uses YOUR word ] + [ his verdict on it ] + [ an aside ]
 *
 * The verdict comes from barkly/opinions, which is the load-bearing idea: he
 * has a permanent stance on every possible word, so "do you like the rain"
 * gets a rain answer, the same rain answer's stance every time, and a
 * different phrasing each time. The aside is drawn from what is actually true
 * right now — the toy in his mouth, the dog standing next to him, the hour,
 * how hungry he is, what he dug up — so the same stance lands differently in
 * different moments.
 *
 * With ~6 stances × 5 shapes × 3 reasons × openers × asides, and the subject
 * being any word in the language, the space is effectively unbounded. More
 * importantly it is ABOUT something: he says your word back to you.
 *
 * Pure. No React, no storage, no clock. The `seed` decides phrasing, and a
 * `recent` list keeps him from repeating himself.
 */

import { opinionOn, Stance, stanceOn, STANCE_MOOD } from './opinions';
import { Feeling, looksLikePerson, Understanding } from './understand';

/**
 * A recurring dog he has real history with, keyed by lowercased name in
 * `ComposeContext.bonds`. The label is the ladder rung ("best friend",
 * "nemesis") so a reply can say where the relationship actually stands.
 */
export interface ComposeBond {
  kind: 'friend' | 'rival';
  encounters: number;
  label: string;
}

export interface ComposeContext {
  /**
   * Lines he has said lately. Asides are checked against it: without this the
   * same "also it is extremely night right now" landed on three replies out of
   * ten, which kills the trick faster than repeating a whole line would.
   */
  avoid?: string[];
  personName?: string;
  location?: string;
  npcsPresent?: string[];
  toy?: string;
  treasures?: string[];
  hour?: number;
  cues?: string[];
  stats?: { mood: number; energy: number; hunger: number; affection: number; curiosity: number };
  /** The raw utterance, for disambiguation (Biscuit the friend vs a biscuit to eat). */
  text?: string;
  /**
   * WHO HE IS RIGHT NOW — the character record, flattened for a composer that
   * cannot read a prompt. Without these, weeks of Pack Book history composed
   * exactly like day one: a best friend got the stranger's "I've decided I
   * like them just now" line, because the composer had never been told.
   */
  bonds?: Record<string, ComposeBond>;
  favoriteTreasure?: string;
  obsession?: string;
  grievance?: { who: string; what: string };
  favoriteFriend?: string;
}

export interface Composed {
  speech: string;
  reaction?: string;
  actions: string[];
}

const at = <T>(list: T[], seed: number): T => list[Math.abs(Math.trunc(seed)) % list.length];

/**
 * Sentence case for a subject that starts a line. Echoing the player's word
 * back is the point, but "rain. Go on." reads as a typo rather than a dog.
 * Words the player capitalised themselves (a name) are left alone.
 */
const opening = (word: string): string =>
  word.charAt(0) === word.charAt(0).toUpperCase() ? word : word.charAt(0).toUpperCase() + word.slice(1);

// ------------------------------------------------------------------ openers

const OPENER: Record<Stance, string[]> = {
  adore: ['%s!', 'Oh, %s.', '%s. Yes.', 'Say %s again.'],
  approve: ['%s.', 'Hm. %s.', '%s, alright.', 'Okay — %s.'],
  suspicious: ['%s...', '%s. Interesting.', 'Hold on. %s?', '%s. Go on.'],
  against: ['%s.', 'Ugh. %s.', '%s? Really?', 'We are doing %s now?'],
  baffled: ['%s?', 'Hm — %s.', '%s. Okay.', '%s, you say.'],
  obsessed: ['%s!!', '%s. %s!', 'Did you say %s?', '%s. Finally.'],
};

const openerFor = (stance: Stance, subject: string, seed: number): string =>
  at(OPENER[stance], seed / 2).split('%s').join(opening(subject));

/**
 * Glue an opener to an opinion without stuttering. Both halves can start with
 * the player's word, and "Hold on. Bike? Bike? We're watching bike." is what
 * that looks like — so when they collide, the opener is dropped.
 */
function join(opener: string, body: string): string {
  const head = (t: string) => t.replace(/^[^a-z0-9]*/i, '').split(/[\s.,!?]+/)[0].toLowerCase();
  return head(opener) === head(body) ? body : `${opener} ${body}`;
}

// ------------------------------------------------------------------- asides

/** Things that are true right now. Used sparingly so they stay interesting. */
function asides(c: ComposeContext): string[] {
  const out: string[] = [];
  // His inner life leaks into ordinary sentences the way it does for anyone
  // with an obsession — as an aside, never a status report. These read from
  // the character record, so a Barkly with a duck rock and a Duke problem
  // sounds like that Barkly even when you asked him about the weather.
  if (c.obsession) out.push(`Unrelated: I have thought about ${c.obsession} nine times since you started talking.`);
  if (c.grievance) out.push(`Also, ${c.grievance.who} and I are in a dispute right now. ${c.grievance.who} knows what ${c.grievance.who} did.`);
  if (c.favoriteTreasure) out.push(`Status report nobody asked for: ${c.favoriteTreasure} is still the best thing I own.`);
  if (c.toy) out.push(`I'm saying all this with a ${c.toy.toLowerCase()} in my mouth, by the way.`);
  if (c.npcsPresent?.length) out.push(`${c.npcsPresent[0]} is pretending not to listen. ${c.npcsPresent[0]} is listening.`);
  if (c.treasures?.length) out.push(`Anyway I own ${c.treasures[c.treasures.length - 1]} now, so my week is going well.`);
  if (c.location) out.push(`Hard to concentrate — we're ${c.location} and it smells like a whole situation.`);
  if (c.hour !== undefined && (c.hour >= 21 || c.hour < 6)) out.push('Also it is extremely night right now.');
  if (c.hour !== undefined && c.hour >= 6 && c.hour < 10) out.push('It is morning and I have already had several thoughts.');
  if (c.stats && c.stats.hunger > 70) out.push("I'd think about it harder if I weren't this hungry.");
  if (c.stats && c.stats.energy < 25) out.push('I am running on about four percent, so take that as you will.');
  if (c.stats && c.stats.affection > 75) out.push("You're my favourite, which is why I tell you these things.");
  if (c.cues?.length) out.push(`You could also just say "${c.cues[0]}" and I'd do the thing.`);
  return out;
}

/** A question back. A conversation is two-directional or it is a broadcast. */
function questionBack(subject: string, c: ComposeContext, seed: number): string {
  const pool = [
    `Do YOU like ${subject}? Be honest.`,
    `How long have you felt this way about ${subject}?`,
    `Is ${subject} why you came over here?`,
    `What made you think of ${subject}?`,
    `Do we need to do something about ${subject}?`,
  ];
  if (c.personName) pool.push(`${c.personName}. Seriously. ${subject}?`);
  return at(pool, seed);
}

// ------------------------------------------------------------------ feelings

const FEELING_REPLY: Record<Feeling, string[]> = {
  sad: [
    "Okay. Come here. I'm not good at this but I'm very warm.",
    "That's rubbish. I'm going to sit against your leg until it's less rubbish.",
    "I don't have advice. I have a whole side of me you can lean on.",
  ],
  happy: [
    "GOOD. I'm doing a tail thing about it. Look at the tail thing.",
    "See, this is my favourite kind of news. Tell me the whole thing.",
    "Excellent. I'm taking partial credit. I was here.",
  ],
  tired: [
    'Then we lie down. That is the entire plan and it is a good plan.',
    "Tired is just pre-nap. I'm an expert. Follow me.",
    "Rest. I'll keep watch. I'll probably fall asleep first, but I'll mean it.",
  ],
  bored: [
    "Bored? I've got a stick, a hole, and no supervision. Pick one.",
    "Throw something. Anything. I'll do the rest.",
    "Boredom is just an unthrown ball. That's not a saying but it should be.",
  ],
  angry: [
    "Who. Give me a name. I'll bark at a general direction.",
    "Fair. Be angry. I'll be angry next to you, at nothing in particular.",
    "Okay. Deep breath. Then we go and look at something loudly.",
  ],
  scared: [
    "I'm right here. I'm small but I'm extremely committed.",
    "Nothing gets past me. I've been practising on the vacuum.",
    "Whatever it is, we'll be scared of it together. That's basically bravery.",
  ],
  sick: [
    "Then you're staying still and I'm staying on you. Those are the rules.",
    "No. Lie down. I'll be a very heavy blanket about it.",
    "Get better. I have things planned for you and they require you upright.",
  ],
};

// ------------------------------------------------------------ pack history

/**
 * A dog he has HISTORY with. This must outrank both the person branch and the
 * hashed stance: "Established Barkly" had nine hangouts with Biscuit on
 * record and still answered "biscuit?" with the stranger's "I've decided I
 * like them just now" — because the mention routed to personReply, which
 * knows nothing. The reply is built from the ladder rung, so a best friend, a
 * buddy and a nemesis are three different conversations.
 */
function bondReply(name: string, bond: ComposeBond, c: ComposeContext, seed: number): Composed {
  const who = opening(name);
  const label = bond.label;
  let shapes: string[];
  if (bond.kind === 'friend') {
    shapes =
      bond.encounters >= 6
        ? [
            `${who}? That's my ${label}. Took me ${bond.encounters} hangouts to admit it and I'm not doing it twice.`,
            `${who} is my ${label}. We have history. Most of it involves sticks.`,
            `You know ${who} is my ${label}. Everyone knows. ${who} will not stop mentioning it.`,
            `${who}. My ${label}. We don't say it out loud. I'm saying it out loud once.`,
          ]
        : bond.encounters >= 3
          ? [
              `${who}? That's an ${label} now. It's official. There was no ceremony, but it's official.`,
              `${who} and I are at ${bond.encounters} hangouts. That's a real friendship. I keep count.`,
              `${who} is alright. More than alright. We're ${label} level. Don't make it a thing.`,
            ]
          : [
              `${who}. I know that dog. Not well. But I know that dog.`,
              `${who}? We've met. I'm still deciding how embarrassing to be about it.`,
            ];
    return { speech: at(shapes, seed), reaction: 'happy', actions: ['TAIL_WAG', 'EAR_PERK'] };
  }
  const beef = c.grievance && c.grievance.who.toLowerCase() === name.toLowerCase() ? ` Latest: ${c.grievance.who} ${c.grievance.what}.` : '';
  shapes =
    bond.encounters >= 6
      ? [
          `${who}. My ${label}. ${bond.encounters} incidents on record. I keep the record.${beef}`,
          `${who}? We're past rival. That is a full ${label} situation and honestly I'm thrilled.${beef}`,
          `Do not say ${who} like it's a normal name. That's my ${label}.${beef}`,
        ]
      : bond.encounters >= 3
        ? [
            `${who} is an ${label}. There are receipts. I am the receipts.${beef}`,
            `${who}. ${bond.encounters} incidents and counting. This is official now.${beef}`,
          ]
        : [
            `${who}. I'm not saying that dog is a problem. I'm saying I have started noticing.`,
            `${who}? On thin ice. The file is open.`,
          ];
  return { speech: at(shapes, seed), reaction: 'annoyed', actions: ['EAR_PERK', 'HEAD_TILT'] };
}

/**
 * Whether the subject word means a dog from the pack rather than something
 * else. The only real collision is Biscuit vs a biscuit you eat — when the
 * sentence is plainly about food, the treat wins and the friend stays out of
 * it.
 */
function bondOn(subject: string, c: ComposeContext): ComposeBond | undefined {
  const bond = c.bonds?.[subject.trim().toLowerCase()];
  if (!bond) return undefined;
  if (subject.trim().toLowerCase() === 'biscuit' && /\b(eat|eats|ate|eating|treat|treats|snack|snacks|food|hungry|feed|tasty|crunchy|bake|baked)\b/i.test(c.text ?? '')) {
    return undefined;
  }
  return bond;
}

/**
 * Somebody the player cares about. Never a hashed verdict — the hash put
 * "sister" on `against` and had him say her name was bad history.
 */
function personReply(who: string, c: ComposeContext, seed: number): Composed {
  const shapes = [
    `${who}? Any friend of yours is a friend of mine. Provisionally. Pending a sniff.`,
    `Oh, ${who}. I like ${who}. I've decided that just now and I'm sticking with it.`,
    `${who} is welcome here. Tell ${who} I said that, but make it sound casual.`,
    `Tell me more about ${who}. I'm building a file and it's a NICE file.`,
    `${who}. Good. More people should be ${who}, in my opinion.`,
    `I've got a lot of time for ${who}, and I've never met ${who}.`,
  ];
  const line = at(shapes, seed);
  return {
    speech: c.personName && Math.abs(Math.trunc(seed / 5)) % 4 === 0 ? `${line} You have good taste, ${c.personName}.` : line,
    reaction: 'happy',
    actions: ['TAIL_WAG', 'EAR_PERK'],
  };
}

// -------------------------------------------------------------- intent shapes

function defineReply(subject: string, seed: number): string {
  const shapes = [
    `${subject} is, as far as I can tell, a thing that happens near me and doesn't explain itself.`,
    `I know exactly what ${subject} is. I'm choosing not to say. It's a whole thing.`,
    `${subject}? That's a human word for something that's either food or not food. I've narrowed it down.`,
    `Everything is either ${subject} or not ${subject}. I've built a whole system on it.`,
    `I could tell you what ${subject} is but you'd only ask a follow-up.`,
  ];
  return at(shapes, seed);
}

function whyReply(subject: string, seed: number): string {
  const shapes = [
    `Because of ${subject}. That's my answer and I'm sticking to it.`,
    `Nobody knows. I've asked. Mostly I've asked ${subject} directly and got nothing.`,
    `Why anything? Why ${subject}? Why is the fence a suggestion? These are the real questions.`,
    `It's a ${subject} thing. You wouldn't get it. I don't get it either.`,
    `I've got a theory about ${subject} and it is not a good theory.`,
  ];
  return at(shapes, seed);
}

function abilityReply(subject: string | undefined, seed: number): string {
  const s = subject ?? 'that';
  const shapes = [
    `Can I ${s}? I can do anything for approximately four seconds.`,
    `I've done ${s}. Allegedly. There were no witnesses and I deny everything.`,
    `Once. It went badly and we've all agreed not to discuss ${s} again.`,
    `Probably. My track record with ${s} is what I'd call "mixed and heroic".`,
    `Watch me. Actually don't watch me. ${s} is better unobserved.`,
  ];
  return at(shapes, seed);
}

/** "Tell me a story" is a request, not a subject. He tells one. */
const STORIES = [
  'Once, there was a dog. Extremely handsome. Some say the best. He found a stick. The end.',
  "Okay. So there's a door, right, and behind it — a delivery man. I barked. I WON. That's the story.",
  'There was a squirrel. It went up a tree. I have been waiting at the bottom ever since. Still going, actually.',
  "One time I found a sock that wasn't mine. It's mine now. That's the whole arc.",
  'A ball went under the sofa. Nobody has seen it since. I think about it most days.',
  "There was a bath. I don't want to talk about the bath. Different story.",
];

function tellReply(subject: string, seed: number): string {
  if (/^stor(y|ies)$/i.test(subject)) return at(STORIES, seed);
  const shapes = [
    `${subject}. Right. So there was a day, and ${subject} was involved, and I came out of it changed.`,
    `The ${subject} story is long and I get emotional. Short version: I was correct.`,
    `I'll tell you about ${subject} but you have to sit down. It's a sitting-down story.`,
    `${subject}? I've got THREE stories about ${subject} and two of them are the same story.`,
    `Once, ${subject}. That's the whole story. It's better if you don't ask questions.`,
  ];
  return at(shapes, seed);
}

const AGREE = [
  'Right? Right.',
  'Exactly. Glad we agree. We do agree, right?',
  "Mm. I'll allow it.",
  "That's the spirit. Whatever that was.",
  'Correct. Continue.',
];

const EMPTY = [
  'Was that a word? Do it again with more consonants.',
  "I heard a noise and I've decided it was for me.",
  'Say more. Or say less. Either way, say it at me.',
  "That was nothing. I loved it. Again.",
];

const GREETING = [
  "Oh. It's you. I mean — hey. Took you long enough.",
  'Hey. I was busy staring at a wall. You are marginally better.',
  'You came back. I had a whole speech prepared. Forgot it.',
  'Hello. I have been extremely brave in your absence.',
  'There you are. I was about to start making decisions on my own.',
  'Hey. Nothing happened. I checked everywhere. Twice.',
];

// ------------------------------------------------------------------- compose

export function compose(u: Understanding, c: ComposeContext, seed: number): Composed {
  const you = c.personName;
  // Asides rotate on their OWN seed and only land a third of the time. The
  // first cut used the same divisor as the shape, so three replies running
  // offered the same "you could just say spin" line and the trick died fast.
  // Asides rotate on their OWN seed, land a third of the time, and skip
  // anything he has used recently.
  const recentlySaid = c.avoid ?? [];
  const aside = asides(c).filter((a) => !recentlySaid.some((r) => r.includes(a)));
  const useAside = aside.length > 0 && Math.abs(Math.trunc(seed / 7)) % 3 === 0;
  const tail = useAside ? ' ' + at(aside, seed * 31 + 7) : '';

  // Order matters and got this wrong first time: "hi" and "i had a bad day"
  // are made ENTIRELY of stopwords, so the empty check fired before the
  // greeting and feeling ones and he answered a greeting with "was that a
  // word?". Intent decides first; empty is the true last resort.
  if (u.intent === 'greeting') {
    const hi = at(GREETING, seed);
    return { speech: you && seed % 2 === 0 ? `${you}. ${hi}` : hi, reaction: 'happy', actions: ['TAIL_WAG'] };
  }

  if (u.intent === 'feeling' && u.feeling) {
    const line = at(FEELING_REPLY[u.feeling], seed);
    const warm = u.feeling === 'happy' ? 'excited' : u.feeling === 'tired' ? 'sleepy' : 'happy';
    return {
      speech: you && Math.abs(seed) % 3 === 0 ? `${you}. ${line}` : line,
      reaction: warm,
      actions: u.feeling === 'happy' ? ['EXCITED', 'TAIL_WAG'] : ['EAR_PERK', 'HEAD_TILT'],
    };
  }

  if (u.intent === 'agree') return { speech: at(AGREE, seed) + tail, actions: ['EAR_PERK'] };

  if (u.empty) return { speech: at(EMPTY, seed), actions: ['HEAD_TILT'] };

  const subject = u.subject;
  if (!subject) {
    // No noun to work with, but still not one of four lines: react to the
    // SHAPE of what they said instead.
    const shapeless = [
      "I'm going to need a noun. Any noun. Throw me one.",
      'You said a lot of words and none of them were about food. Bold.',
      "I'm nodding like I understood that. I did not understand that.",
      'Go on. I have literally nothing else scheduled.',
    ];
    return { speech: at(shapeless, seed) + tail, actions: ['HEAD_TILT'] };
  }

  // Recorded history FIRST. A dog he has a bond with must never fall through
  // to the generic person branch (whose "I've decided I like them just now"
  // is only true for strangers) or to a hashed stance verdict. Specific
  // beats generic, always — this ordering is the rule.
  const bond = bondOn(subject, c);
  if (bond) {
    const b = bondReply(subject, bond, c, seed);
    // No aside that names the same dog the reply is already about — "Duke.
    // My nemesis." followed by "Also, Duke and I are in a dispute" reads as
    // a dog with a short memory, which is the opposite of the point.
    const clean = tail.toLowerCase().includes(subject.toLowerCase()) ? '' : tail;
    return { ...b, speech: b.speech + clean };
  }

  if (u.person) return personReply(opening(subject), c, seed);

  const stance = stanceOn(subject);
  const mood = STANCE_MOOD[stance];

  if (u.intent === 'opinion') {
    const { speech } = opinionOn(subject, seed);
    return { speech: join(openerFor(stance, subject, seed), speech) + tail, reaction: mood.reaction, actions: mood.actions };
  }

  if (u.intent === 'define') return { speech: defineReply(opening(subject), seed) + tail, ...moodOf(stance) };
  if (u.intent === 'why') return { speech: whyReply(subject, seed) + tail, ...moodOf(stance) };
  if (u.intent === 'ability') return { speech: abilityReply(subject, seed) + tail, ...moodOf(stance) };
  if (u.intent === 'tell') return { speech: tellReply(opening(subject), seed) + tail, ...moodOf(stance) };

  // A plain statement. Echo the subject, give the verdict, and every so often
  // hand the conversation back instead of ending it.
  const { speech } = opinionOn(subject, seed);
  const back = Math.abs(Math.trunc(seed / 11)) % 4 === 0 ? ' ' + questionBack(subject, c, seed) : tail;
  return { speech: join(openerFor(stance, subject, seed), speech) + back, reaction: mood.reaction, actions: mood.actions };
}

function moodOf(stance: Stance): { reaction?: string; actions: string[] } {
  const m = STANCE_MOOD[stance];
  return { reaction: m.reaction, actions: m.actions };
}
