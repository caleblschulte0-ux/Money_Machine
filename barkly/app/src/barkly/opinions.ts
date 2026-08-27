/**
 * Barkly has an opinion about everything, and it never changes.
 *
 * This is the thing that was missing. The offline brain matched your sentence
 * against seven keyword buckets and, failing that, served one of FOUR generic
 * lines — so every real conversation ("do you like the rain", "I had a bad
 * day", "what's a helicopter") landed in the same tiny pool. Four lines is
 * exactly what it felt like, because it was four lines.
 *
 * A bigger list of canned lines would not have fixed it; it would have made
 * the loop longer. What fixes it is that he RESPONDS TO THE WORD YOU SAID.
 *
 * So: every word he ever hears is hashed to a stance, permanently. Rain is
 * always the same kind of problem to him. Cheese is always the same kind of
 * miracle. Ask him about your cousin Dave twice a week apart and you get the
 * same verdict, because the stance is a function of the word and nothing
 * else — no storage, no state, no drift. That is what makes it feel like
 * discovering a specific dog's opinions rather than shuffling a deck: the
 * opinions are already there, waiting, and they hold.
 *
 * Pure and deterministic. `seed` only picks the phrasing.
 */

export type Stance = 'adore' | 'approve' | 'suspicious' | 'against' | 'baffled' | 'obsessed';

export const STANCES: Stance[] = ['adore', 'approve', 'suspicious', 'against', 'baffled', 'obsessed'];

/**
 * A small, stable string hash (FNV-1a). Not for security — for making sure
 * "rain" lands on the same stance today, tomorrow, and on someone else's
 * phone, without storing a single byte.
 */
export function hashWord(word: string): number {
  let h = 0x811c9dc5;
  const w = word.toLowerCase().trim();
  for (let i = 0; i < w.length; i++) {
    h ^= w.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Things a dog is contractually obliged to have strong feelings about. */
const FIXED: Record<string, Stance> = {
  cheese: 'obsessed',
  treat: 'obsessed',
  treats: 'obsessed',
  ball: 'obsessed',
  food: 'obsessed',
  dinner: 'obsessed',
  bacon: 'obsessed',
  walk: 'adore',
  walks: 'adore',
  park: 'adore',
  stick: 'adore',
  sticks: 'adore',
  bed: 'adore',
  naps: 'adore',
  nap: 'adore',
  bath: 'against',
  baths: 'against',
  vet: 'against',
  cat: 'against',
  cats: 'against',
  squirrel: 'against',
  squirrels: 'against',
  vacuum: 'against',
  mailman: 'against',
  postman: 'against',
  thunder: 'against',
  fireworks: 'against',
  bird: 'suspicious',
  birds: 'suspicious',
  pigeon: 'suspicious',
  pigeons: 'suspicious',
  rain: 'suspicious',
  water: 'suspicious',
  duke: 'against',
  biscuit: 'adore',
  pepper: 'approve',
};

/** His verdict on a word. Same word, same verdict, forever. */
export function stanceOn(word: string): Stance {
  const key = word.toLowerCase().trim();
  if (FIXED[key]) return FIXED[key];
  return STANCES[hashWord(key) % STANCES.length];
}

/** Sentence shapes per stance. `%s` is the word, exactly as they said it. */
const OPINION: Record<Stance, string[]> = {
  adore: [
    '%s is the correct answer to almost every question.',
    'Oh, %s is a YES from me. A loud one.',
    "%s? Finally, someone with taste. Yours, but I'll allow it.",
    'I would defend %s. Physically. With my whole body.',
    '%s is one of the good ones. Put it on the list.',
  ],
  approve: [
    "%s is fine. I'm not going to make a fuss about %s, but it's fine.",
    'Yeah, %s. Sure. %s can stay.',
    'No notes on %s. That is rare and you should enjoy it.',
    "%s? Acceptable. I've seen worse. I've BEEN worse.",
    "I don't dislike %s, and coming from me that's basically a hug.",
  ],
  suspicious: [
    "I've got my eye on %s. I'm not saying more than that.",
    '%s has never explained itself to me. Not once.',
    "Something about %s is up. I can't prove it yet.",
    "%s? We're watching %s. That's all I'll say.",
    "I have concerns about %s, and I'm not ready to share them.",
  ],
  against: [
    '%s and I have history. It is not good history.',
    "Absolutely not. Next word. I'm not doing %s today.",
    'I have been very clear about %s and yet here we are.',
    '%s is a problem the world refuses to take seriously.',
    "If %s comes up again I'm leaving the room. Slowly. Dramatically.",
  ],
  baffled: [
    "I have thought about %s for a long time and gotten precisely nowhere.",
    "%s? I've stopped trying to understand %s. It was making me worse.",
    'Nobody has ever successfully explained %s to me.',
    '%s exists and I have simply decided not to think about it.',
    "Every time I get close to understanding %s, a bird happens.",
  ],
  obsessed: [
    'Do NOT get me started on %s. Too late. Let me tell you about %s.',
    "%s is my entire personality and I won't be apologising.",
    "You said %s. You said it out loud. Now we're doing this.",
    "I think about %s more than is reasonable for anyone.",
    '%s. Sorry — I need a second. %s.',
  ],
};

/** A trailing clause, sometimes. This is what stops the shapes reading as shapes. */
const BECAUSE: Record<Stance, string[]> = {
  adore: ['It smells like being right.', 'No further questions.', 'That is just science.'],
  approve: ['Low drama. I respect low drama.', "It's never wronged me.", 'Solid. Unremarkable. Safe.'],
  suspicious: ['Nothing that quiet is innocent.', "It's too calm about itself.", 'I know what I know.'],
  against: ['We do not speak of it.', 'I have a whole file.', 'One day I will win.'],
  baffled: ['I blame everyone.', 'The world is like that sometimes.', 'It keeps happening.'],
  obsessed: ['I am unwell about it.', 'This is who I am now.', 'I have no off switch for this.'],
};

export const STANCE_MOOD: Record<Stance, { reaction?: string; actions: string[] }> = {
  adore: { reaction: 'happy', actions: ['TAIL_WAG', 'EAR_PERK'] },
  approve: { actions: ['EAR_PERK'] },
  suspicious: { reaction: 'annoyed', actions: ['LOOK_LEFT', 'HEAD_TILT'] },
  against: { reaction: 'annoyed', actions: ['LOOK_LEFT'] },
  baffled: { actions: ['HEAD_TILT', 'BLINK'] },
  obsessed: { reaction: 'excited', actions: ['EXCITED', 'TAIL_WAG'] },
};

/**
 * What he thinks about `word`, in words. The stance is fixed; the phrasing
 * varies with the seed so asking twice does not print the same sentence.
 */
export function opinionOn(word: string, seed: number): { speech: string; stance: Stance } {
  const stance = stanceOn(word);
  const shapes = OPINION[stance];
  const shape = shapes[Math.abs(Math.trunc(seed)) % shapes.length];
  let speech = shape.split('%s').join(word);
  // A shape that opens with the word needs sentence case, or every reply
  // starting with the player's noun reads like a typo.
  if (shape.startsWith('%s')) speech = speech.charAt(0).toUpperCase() + speech.slice(1);
  const because = BECAUSE[stance];
  // Two thirds of the time, on a different rotation to the shape, so the
  // pairing does not become predictable either.
  if (Math.abs(Math.trunc(seed)) % 3 !== 0) {
    speech += ' ' + because[Math.abs(Math.trunc(seed / 3)) % because.length];
  }
  return { speech, stance };
}
