/**
 * THE BRAIN A STRANGER ACTUALLY MEETS.
 *
 * The published web build has no model, so `scripted` is Barkly for everyone
 * who opens the link. Every case below is a line that really shipped, found by
 * playing a thirty-turn first session as a new player would and reading what
 * came back — not by reasoning about the code.
 */

import { createScriptedDialogue } from '../src/providers/dialogue/scripted';
import { compose } from '../src/barkly/compose';
import { understand } from '../src/barkly/understand';
import { personalFactFrom } from '../src/barkly/facts';

const ctx = (over: Partial<any> = {}): any => ({
  state: 'idle',
  personName: 'Caleb',
  location: 'at home',
  hour: 14,
  stats: { mood: 60, energy: 70, hunger: 40, affection: 55, curiosity: 50 },
  npcsPresent: [],
  facts: [],
  bonds: {},
  treasures: [],
  ...over,
});

const say = async (text: string, c: any) =>
  JSON.parse(await createScriptedDialogue().complete({ userText: text, context: c, history: [] } as any));

describe('being told something is the moment the product is about', () => {
  it('files a new fact instead of pretending to have an old opinion about it', async () => {
    // Shipped: "We are doing Pizza now? I have been very clear about pizza and
    // yet here we are. I have a whole file." He was performing history about a
    // thing he had been told four words earlier.
    const r = await say('my favorite food is pizza', ctx());
    expect(r.speech.toLowerCase()).toContain('pizza');
    expect(r.speech).not.toMatch(/we are doing|I have been very clear|and yet here we are/i);
    expect(r.remember.facts).toContain('favorite_food = pizza');
  });

  it('notices when the answer CHANGES, and says both', async () => {
    const r = await say('my favorite food is noodles', ctx({ facts: ['favorite_food = pizza'] }));
    expect(r.speech.toLowerCase()).toContain('pizza');
    expect(r.speech.toLowerCase()).toContain('noodles');
  });

  it('says so when it is already on file', async () => {
    const r = await say('my favorite food is pizza', ctx({ facts: ['favorite_food = pizza'] }));
    expect(r.speech.toLowerCase()).toMatch(/you told me|still|know/);
  });

  it('keeps the name of somebody they introduce', () => {
    // "I have a sister named Mia" was answered warmly and then forgotten.
    expect(personalFactFrom('i have a sister named Mia')).toBe('sister = Mia');
    expect(personalFactFrom("my dog's name is Rex")).toBe('dog = Rex');
  });

  it('answers an introduction once, not twice', async () => {
    // Shipped: the prefix AND a composed person-branch reply about the same
    // name, in his very first line to a new player.
    const r = await say('my name is Caleb', ctx({ personName: undefined }));
    expect(r.speech).toContain('Caleb');
    expect(r.speech).not.toMatch(/More people should be like/);
    expect(r.remember.facts).toContain('name = Caleb');
  });
});

describe('the questions a stranger asks in the first two minutes', () => {
  it('answers "do you remember me" from what he actually holds', async () => {
    // Shipped: "I'm nodding like I understood that. I did not understand that."
    const r = await say('do you remember me', ctx({ facts: ['favorite_food = pizza', 'sister = Mia'] }));
    expect(r.speech).toContain('Caleb');
    expect(r.speech).toMatch(/2 things/);
  });

  it('is honest when he has nothing yet', async () => {
    const r = await say('do you remember me', ctx({ personName: undefined, facts: [] }));
    expect(r.speech).toMatch(/not yet/i);
  });

  it('answers "do you like me"', async () => {
    // Shipped: "I'm going to need a noun. Any noun. Throw me one."
    const r = await say('do you like me', ctx({ stats: { ...ctx().stats, affection: 90 } }));
    expect(r.speech).not.toMatch(/need a noun|did not understand/i);
  });

  it('has favourites of his own', async () => {
    const r = await say("what's your favorite color", ctx());
    // Shipped: "I could tell you what Favorite is but you'd only ask a
    // follow-up." — the qualifier had become the subject.
    expect(r.speech).not.toMatch(/\bFavorite\b/);
    expect(r.speech.toLowerCase()).toContain('cheese');
  });

  it('treats leaving as a goodbye, not as a noun', async () => {
    // Shipped: "Do NOT get me started on bye. Too late. Let me tell you about bye."
    const r = await say('bye', ctx());
    expect(r.speech).not.toMatch(/get me started on bye|about bye/i);
  });

  it('does not repeat itself when told it is loved twice', async () => {
    const d = createScriptedDialogue();
    const seen = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      const r = JSON.parse(await d.complete({ userText: 'i love you', context: ctx(), history: [] } as any));
      seen.add(r.speech);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('somebody upset them', () => {
  it('takes their side instead of cheerfully filing the insult', async () => {
    // Shipped, in two different ways: "Teacher. Good. More people should be
    // Teacher, in my opinion." and later "Mean. Right. I'll remember that
    // longer than you will."
    const r = await say('my teacher is mean', ctx());
    expect(r.speech).not.toMatch(/More people should be|Good\./);
    expect(r.speech).not.toMatch(/^Mean\./);
  });

  it('still records what happened', async () => {
    const r = await say('my teacher is mean', ctx());
    expect(r.remember.facts).toContain('teacher = mean');
  });

  it('never says a relationship word without the possessive', () => {
    // Shipped: "Then teacher is wrong." and "Teacher is welcome here." A name
    // drops into a sentence; a relationship word needs the "your" the player
    // used themselves. Every mention has to carry it.
    for (let i = 0; i < 60; i += 1) {
      for (const line of ['my teacher is being unfair', 'my teacher is really kind']) {
        const { speech } = compose(understand(line), { personName: 'Caleb' }, i);
        for (const m of speech.matchAll(/\bteacher\b/gi)) {
          expect(speech.slice(Math.max(0, (m.index ?? 0) - 5), m.index).toLowerCase()).toContain('your');
        }
      }
    }
  });

  it('agrees its verb with a plural relationship word', () => {
    // "Your friends is welcome here" is the same mistake one step further on.
    for (let i = 0; i < 60; i += 1) {
      const { speech } = compose(understand('my friends are really kind'), { personName: 'Caleb' }, i);
      expect(speech).not.toMatch(/friends is\b/i);
    }
  });
});

describe('nothing is capitalised in the middle of a sentence', () => {
  // A capital letter mid-line is the clearest tell that a machine assembled
  // it: "Say Park again", "Oh, Sing.", "what Favorite is".
  const LOWER = ['rain', 'park', 'homework', 'thunder', 'broccoli'];
  it('holds across every shape the composer can reach', () => {
    for (const word of LOWER) {
      const Word = word.charAt(0).toUpperCase() + word.slice(1);
      for (let seed = 0; seed < 60; seed += 1) {
        for (const line of [
          `do you like ${word}`,
          `what is ${word}`,
          `why is ${word} like that`,
          `tell me about ${word}`,
          `can you do ${word}`,
          `${word} happened today`,
        ]) {
          const { speech } = compose(understand(line), { personName: 'Caleb', location: 'at home' }, seed);
          // A capital is CORRECT at the start of each sentence, so the check is
          // per sentence with its own first character removed.
          for (const part of speech.split(/(?<=[.!?])\s+/)) {
            expect(part.slice(1)).not.toContain(Word);
          }
        }
      }
    }
  });
});

describe('the way children actually type', () => {
  it('does not turn a missing apostrophe into the subject', async () => {
    // Shipped: "Whats is, as far as I can tell, a thing that happens near me
    // and doesn't explain itself." and "If youre comes up again I'm leaving
    // the room."
    const a = await say('whats up', ctx());
    expect(a.speech).not.toMatch(/\bwhats\b/i);
    const b = await say('youre so silly', ctx());
    expect(b.speech).not.toMatch(/\byoure\b/i);
  });

  it('hears "actually ..." as a correction, which is when corrections happen', async () => {
    // Every fact pattern is anchored to the start of the sentence, so the one
    // word a child uses to change their mind defeated all of them.
    const r = await say('actually my favorite food is tacos', ctx({ facts: ['favorite_food = pizza'] }));
    expect(r.speech.toLowerCase()).toContain('pizza');
    expect(r.speech.toLowerCase()).toContain('tacos');
    expect(r.remember.facts).toContain('favorite_food = tacos');
  });

  it('uses the name in "my friend jake", not the word "friend"', async () => {
    // Children do not capitalise names, so the name was invisible and the
    // relationship word won.
    // One shape in the pool deliberately names nobody ("I'd have barked"), so
    // the assertion is over the pool: the name is used, the category word
    // never is.
    let named = 0;
    for (let i = 0; i < 30; i += 1) {
      const r = await say('my friend jake is annoying', ctx());
      if (r.speech.includes('Jake')) named += 1;
      expect(r.speech).not.toMatch(/your friend/i);
      expect(r.remember.facts).toContain('friend = Jake');
    }
    expect(named).toBeGreaterThan(0);
  });

  it('never answers a sentence about a person with a canned line about a dog', async () => {
    // Shipped: "my friend jake is annoying" -> "Biscuit's alright. Biscuit
    // gets it. Biscuit is also very slow." The topic pool matched the word
    // "friend" and buried the person entirely.
    for (let i = 0; i < 30; i += 1) {
      const r = await say('my friend jake is annoying', ctx());
      expect(r.speech).not.toMatch(/Biscuit|Duke|complicated social life/i);
    }
  });

  it('turns an untaught command into the offer to teach it', async () => {
    // Shipped: "Stop is my entire personality and I won't be apologising."
    // A taught cue never reaches the provider -- useBarkly performs it -- so
    // this is only ever the "I don't know that one" case.
    const r = await say('sit', ctx());
    expect(r.speech).toMatch(/teach|don't know|nobody's taught|can't\. yet/i);
  });

  it('answers with the value they last gave, not the one they replaced', async () => {
    const r = await say('what is my favorite food', ctx({ facts: ['favorite_food = pizza', 'favorite_food = tacos'] }));
    expect(r.speech.toLowerCase()).toContain('tacos');
  });
});

describe('what is worth keeping forever', () => {
  it('does not file a mood as a permanent fact about you', () => {
    // "my day was terrible" fits the possessive shape exactly and was kept
    // alongside their name, forever, and counted in "things I have on file".
    expect(personalFactFrom('my day was terrible')).toBeNull();
    expect(personalFactFrom('my week was long')).toBeNull();
    // The things that ARE durable still are.
    expect(personalFactFrom('my favorite color is green')).toBe('favorite_color = green');
    expect(personalFactFrom('my school is called Oakridge')).toBe('school = Oakridge');
  });
});
