/**
 * The offline brain.
 *
 * The complaint that produced this file was "he still has the same four
 * lines", and it was exactly right: the old provider matched seven keyword
 * buckets and dropped everything else into a four-line pool. These tests are
 * about the property that fixes it — a reply is BUILT from the word you said,
 * so the space of replies is as large as the space of things you can say.
 */

import { createScriptedDialogue } from '../src/providers/dialogue/scripted';
import { hashWord, opinionOn, stanceOn, STANCES } from '../src/barkly/opinions';
import { compose } from '../src/barkly/compose';
import { keywords, looksLikePerson, understand } from '../src/barkly/understand';

const ctx = {
  state: 'idle',
  stats: { mood: 65, energy: 70, hunger: 40, affection: 60, curiosity: 66 },
  location: 'at the dog park',
  npcsPresent: ['Duke'],
  personName: 'Caleb',
  toy: 'Squeaky ball',
  treasures: ['the good stick'],
  hour: 15,
  cues: ['spin'],
} as never;

const say = async (p: ReturnType<typeof createScriptedDialogue>, text: string) =>
  JSON.parse(await p.complete({ systemPrompt: '', turns: [], userText: text, context: ctx })).speech as string;

describe('his opinions are permanent', () => {
  it('the same word always gets the same verdict', () => {
    for (const w of ['rain', 'helicopter', 'Tuesday', 'broccoli', 'jordan']) {
      const first = stanceOn(w);
      for (let i = 0; i < 50; i++) expect(stanceOn(w)).toBe(first);
    }
  });

  it('casing and whitespace do not change his mind', () => {
    expect(stanceOn('Rain')).toBe(stanceOn('  rain '));
    expect(hashWord('RAIN')).toBe(hashWord('rain'));
  });

  it('different words land on different verdicts — not all one stance', () => {
    const words = 'rain sky bus apple cloud phone tree hat river song glass paper stone lamp'.split(' ');
    expect(new Set(words.map(stanceOn)).size).toBeGreaterThan(2);
  });

  it('the things a dog must care about are not left to a hash', () => {
    expect(stanceOn('cheese')).toBe('obsessed');
    expect(stanceOn('walk')).toBe('adore');
    expect(stanceOn('bath')).toBe('against');
    expect(stanceOn('vacuum')).toBe('against');
  });

  it('the phrasing varies even though the verdict does not', () => {
    const said = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((s) => opinionOn('rain', s).speech));
    expect(said.size).toBeGreaterThan(4);
    for (const line of said) expect(line.toLowerCase()).toContain('rain');
  });

  it('every stance has phrasings and none leak the %s placeholder', () => {
    for (const stance of STANCES) {
      const word = Object.entries({ obsessed: 'cheese', adore: 'walk', against: 'bath' }).find(
        ([k]) => k === stance,
      )?.[1];
      const probe = word ?? 'zzqx';
      for (let s = 0; s < 8; s++) expect(opinionOn(probe, s).speech).not.toContain('%s');
    }
  });
});

describe('reading what was said', () => {
  it('finds the subject and ignores the filler', () => {
    expect(keywords('do you like the rain')).toContain('rain');
    expect(keywords('do you like the rain')).not.toContain('you');
    expect(understand('do you like the rain').subject?.toLowerCase()).toBe('rain');
  });

  it('a greeting made only of stopwords is still a greeting', () => {
    // "hi" is a stopword, so this used to come back empty and he answered a
    // hello with "was that a word?".
    expect(understand('hi').intent).toBe('greeting');
    expect(understand('hi').empty).toBe(false);
  });

  it('a bad day is a feeling, not an empty utterance', () => {
    const u = understand('i had a really bad day');
    expect(u.intent).toBe('feeling');
    expect(u.feeling).toBe('sad');
  });

  it('a question is never treated as nothing to go on', () => {
    for (const q of ['what should we do today', 'why are you like this', 'how?']) {
      expect(understand(q).empty).toBe(false);
    }
  });

  it('tells the intents apart', () => {
    expect(understand('do you like pizza').intent).toBe('opinion');
    expect(understand('what is a helicopter').intent).toBe('define');
    expect(understand('why is the sky blue').intent).toBe('why');
    expect(understand('can you do a backflip').intent).toBe('ability');
    expect(understand('tell me about school').intent).toBe('tell');
    expect(understand('yeah').intent).toBe('agree');
    expect(understand('we went camping').intent).toBe('statement');
  });
});

describe('he is never unkind about your people', () => {
  it('recognises family, friends and names', () => {
    expect(looksLikePerson('sister', 'my sister is annoying')).toBe(true);
    expect(looksLikePerson('grandma', 'my grandma sent a card')).toBe(true);
    expect(looksLikePerson('Jordan', 'my friend Jordan is here')).toBe(true);
    expect(looksLikePerson('bike', 'i got a new bike')).toBe(false);
  });

  it('a sentence with a person in it is ABOUT the person', () => {
    // "my sister is annoying" used to pick "annoying" — the longest word — and
    // hand down a verdict on the adjective instead.
    expect(understand('my sister is annoying').subject?.toLowerCase()).toBe('sister');
    expect(understand('my sister is annoying').person).toBe(true);
  });

  it('people never get a hostile reply, however the hash falls', () => {
    const hostile = /not good history|absolutely not|problem the world|leaving the room|do not speak/i;
    const people = 'sister brother mum dad grandma grandad aunt uncle cousin friend teacher baby family'.split(' ');
    for (const who of people) {
      for (let seed = 0; seed < 12; seed++) {
        const out = compose(understand(`my ${who} is here`), {}, seed);
        expect(out.speech).not.toMatch(hostile);
      }
    }
  });
});

describe('he does not have four lines', () => {
  it('forty different things to say produce forty different replies', async () => {
    const p = createScriptedDialogue();
    const said = [
      'hi', 'do you like the rain', 'what is a helicopter', 'why is the sky blue',
      'can you do a backflip', 'tell me about school', 'i got a new bike', 'do you like pizza',
      'im so tired', 'this is boring', 'we went camping', 'i won my match',
      'whats for dinner', 'do you know about dinosaurs', 'my tooth fell out', 'do you like snow',
      'we are moving house', 'why do dogs sniff everything', 'i am eating an apple', 'i made a drawing',
      'do you like music', 'the bus was late', 'i think you are silly', 'can you count',
      'what is homework', 'i am scared of the dark', 'do you like thunderstorms', 'tell me a story',
      'my bike has a bell', 'the park was busy', 'i saw a fox', 'do you like cheese',
      'we baked a cake', 'my shoes are wet', 'is it going to rain', 'i found a rock',
      'do you like the beach', 'the tv is broken', 'i have a loose tooth', 'what is a submarine',
    ];
    const replies = await Promise.all(said.map((s) => say(p, s)));
    expect(new Set(replies).size).toBeGreaterThanOrEqual(said.length - 2);
  });

  it('asking the SAME thing over and over does not loop on one line', async () => {
    const p = createScriptedDialogue();
    const replies: string[] = [];
    for (let i = 0; i < 10; i++) replies.push(await say(p, 'do you like the rain'));
    // Same stance every time (that is the character), different sentences.
    expect(new Set(replies).size).toBeGreaterThanOrEqual(5);
    for (const r of replies) expect(r.toLowerCase()).toContain('rain');
  });

  it('never repeats itself back to back', async () => {
    const p = createScriptedDialogue();
    let last = '';
    for (const text of ['tell me about the park', 'tell me about the park', 'do you like socks', 'do you like socks']) {
      const r = await say(p, text);
      expect(r).not.toBe(last);
      last = r;
    }
  });

  it('says YOUR word back to you', async () => {
    const p = createScriptedDialogue();
    for (const [text, word] of [
      ['do you like broccoli', 'broccoli'],
      ['what is a trampoline', 'trampoline'],
      ['tell me about volcanoes', 'volcanoes'],
    ] as const) {
      expect((await say(p, text)).toLowerCase()).toContain(word);
    }
  });

  it('still answers the questions it can answer honestly', async () => {
    const p = createScriptedDialogue();
    expect(await say(p, 'what is my name')).toContain('Caleb');
    expect((await say(p, 'where are we')).toLowerCase()).toContain('dog park');
    expect((await say(p, 'who is here')).toLowerCase()).toContain('duke');
    expect((await say(p, 'what should we do')).toLowerCase()).toContain('feed me');
  });

  it('emits a valid contract every time, with no placeholder leaks', async () => {
    const p = createScriptedDialogue();
    for (const text of ['hi', 'blorp', '???', 'do you like the rain', 'my sister', '😀', '']) {
      const raw = await p.complete({ systemPrompt: '', turns: [], userText: text, context: ctx });
      const parsed = JSON.parse(raw);
      expect(typeof parsed.speech).toBe('string');
      expect(parsed.speech).not.toContain('%s');
      expect(parsed.speech).not.toContain('undefined');
      expect(Array.isArray(parsed.actions)).toBe(true);
    }
  });
});

describe('the asides stay interesting', () => {
  it('does not reuse an aside he has just used', async () => {
    const p = createScriptedDialogue();
    const said: string[] = [];
    for (const t of ['do you like socks', 'what is a kite', 'tell me about mountains',
                     'do you like buses', 'why is grass green', 'what is a piano',
                     'do you like clouds', 'tell me about rivers', 'what is a comet', 'do you like hats']) {
      said.push(await say(p, t));
    }
    // Every aside sentence that appears should appear at most twice across ten
    // replies. Three in ten is what it looked like before, and it read as a tic.
    const asideish = [
      'squeaky ball in my mouth',
      'is pretending not to listen',
      'so my week is going well',
      'it smells like a whole situation',
      'extremely night right now',
      "and I'd do the thing",
    ];
    for (const a of asideish) {
      expect(said.filter((s) => s.includes(a)).length).toBeLessThanOrEqual(2);
    }
  });

  it('"everything" is not a subject worth having an opinion about', () => {
    expect(understand('why do you sniff everything').subject).not.toBe('everything');
  });
});
