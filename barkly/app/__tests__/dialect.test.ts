/**
 * The accent runs over every word he says, so the risk is damage, not taste.
 *
 * This transform sits at the speaking funnel, which means it also runs over
 * text it did not write: your NAME, the word you just typed at him, the name
 * of a treasure he dug up. A dialect rule that reaches inside words would turn
 * Matthew into Maddew and Heather into Header, and it would do it to a child's
 * own name, in a toy, permanently.
 *
 * So the tests here are mostly adversarial. Taste is checked by ear; this is
 * checked by machine:
 *
 *   NOTHING IS MANGLED   real names, real words that merely contain the
 *                        letters of a rule, and every treasure in the game
 *   MEANING IS STABLE    a rule may change spelling, never sense — nothing is
 *                        negated, nothing is added that asserts anything
 *   IT IS DETERMINISTIC  the same sentence sounds the same every time, which
 *                        is the difference between a character and a shuffler
 *   IT IS BOUNDED        strong markers are capped, or he becomes a parody
 */

import { bronx, splitLeadingName } from '../src/barkly/dialect';
import { TREASURES } from '../src/world/stash';

describe('it never damages a word it was not aiming at', () => {
  const NAMES = [
    'Matthew', 'Heather', 'Thomas', 'Ruth', 'Athena', 'Theo', 'Bethany',
    'Nathan', 'Catherine', 'Arthur', 'Yousef', 'Yourke', 'Thibault',
  ];
  for (const name of NAMES) {
    it(`leaves ${name} alone`, () => {
      expect(bronx(`Hello ${name}, good to see you.`)).toContain(name);
    });
  }

  const WORDS = ['thing', 'king', 'ring', 'string', 'bring', 'nothingness', 'author', 'python', 'thistle'];
  for (const w of WORDS) {
    it(`does not chew up "${w}"`, () => {
      // Either untouched, or changed by a rule that legitimately owns the word.
      const out = bronx(`I found a ${w} today.`);
      expect(out).toMatch(new RegExp(`\\b${w}\\b|\\b${w.replace(/ing$/, "in'")}\\b`, 'i'));
    });
  }

  it('leaves every treasure name recognisable', () => {
    for (const t of TREASURES) {
      const out = bronx(`I found ${t.name}.`);
      // The distinctive noun in each treasure name survives.
      // Skip modifiers — "a very old sandwich" legitimately becomes "a real
      // old sandwich", and picking "very" as the noun tests the wrong word.
      const SKIP = new Set(['very', 'that', 'this', 'with', 'from', 'some', 'good', 'half']);
      const noun = t.name
        .replace(/[^a-z ]/gi, ' ')
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 3 && !SKIP.has(w.toLowerCase()))[0];
      if (noun) expect(out.toLowerCase()).toContain(noun.toLowerCase().slice(0, 4));
    }
  });

  it('does not touch a user word it is quoting back', () => {
    expect(bronx('Skateboard? Skateboard is a real word?')).toContain('Skateboard');
  });
});

describe('it changes how he sounds, never what he means', () => {
  it('never negates a sentence', () => {
    const positives = ['I love this.', 'I am happy.', 'That is the best thing.', 'I will do it.'];
    for (const p of positives) {
      const out = bronx(p);
      // "ain't" only ever replaces an existing negative, so a line with no
      // negation in it must not come back with one.
      expect(out).not.toMatch(/\bain't\b/);
      // The SENTENCE, not the garnish. "I'm not gonna lie to ya." is a fixed
      // opener that happens to contain the word; it modifies nothing after it.
      // Checking the whole string here made this test pass or fail on which
      // opener a hash happened to pick, which is not what it is for.
      const body = out.replace(/^I'm not gonna lie to ya\. /, '');
      expect(body).not.toMatch(/\bnot\b/);
    }
  });

  it("only turns an existing negative into ain't", () => {
    expect(bronx('That is not a stick.')).toMatch(/ain't/);
    expect(bronx('It is a stick.')).not.toMatch(/ain't/);
  });

  it('adds nothing that makes a claim', () => {
    // Every garnish is a discourse marker: it carries tone, not information.
    const seen = new Set<string>();
    for (let i = 0; i < 400; i += 1) seen.add(bronx(`Line number ${i} about a ball.`));
    const added = [...seen].join(' ');
    expect(added).not.toMatch(/\bnever\b|\balways\b|\bpromise\b|\bhate\b/i);
  });

  it('stays clean — it is a children\'s app', () => {
    const all = Array.from({ length: 300 }, (_, i) => bronx(`He looked at the ${i} thing and thought about it.`)).join(' ');
    expect(all).not.toMatch(/damn|hell|crap|stupid|idiot|shut up/i);
  });
});

describe('it is deterministic and bounded', () => {
  it('the same line always sounds the same', () => {
    const line = 'That is the thing about this park, you know.';
    const first = bronx(line);
    for (let i = 0; i < 25; i += 1) expect(bronx(line)).toBe(first);
  });

  it('caps the strong markers, so he is an accent and not an impression', () => {
    // A line stuffed with every trigger word must not come back as all of them.
    const stuffed = 'The that this these those them there you your the that this.';
    const out = bronx(stuffed);
    const markers = (out.match(/\b(da|dat|dis|dese|doze|dem|dere|ya)\b/gi) ?? []).length;
    expect(markers).toBeLessThanOrEqual(2);
  });

  it('adds at most one garnish, never an opener AND a closer', () => {
    for (let i = 0; i < 200; i += 1) {
      const out = bronx(`Something happened on day ${i}.`);
      // Non-capturing: a capture group makes `.match` return [full, group]
      // and every single match counts as two.
      const openers = /^(?:Ay\.|Yo\.|Ay, yo\.|Lemme tell ya\.|I'm not gonna lie to ya\.)/.test(out) ? 1 : 0;
      const closers = /(?:awright\?|I'm just sayin'\.|Capisce\?)$/.test(out) ? 1 : 0;
      expect(openers + closers).toBeLessThanOrEqual(1);
    }
  });

  it('leaves his lowercase inner voice lowercase', () => {
    // Thoughts are overheard, not spoken — a capitalised "Ay." breaks that.
    for (let i = 0; i < 60; i += 1) {
      const out = bronx(`the ${i} squirrel is back and i am furious about it.`);
      expect(out[0]).toBe(out[0].toLowerCase());
    }
  });

  /**
   * Idempotence, tested against a corpus rather than two examples.
   *
   * The two-example version of this test passed while 51 of his 146 real lines
   * failed — a repeated greeting collected a second opener and a third marker
   * each time it came back round. It was the pre-recorded voice bank that
   * caught it, because the bank is keyed on the spoken form and a line that
   * will not settle has no stable key. Two lines is not a corpus.
   */
  it('running it twice changes nothing more, over every line in the game', () => {
    const corpus = [
      ...TREASURES.map((t) => `I found ${t.name} and I am not sorry.`),
      'That is not going to work, you know.',
      'I have to tell you something.',
      'There you are. I was about to start making decisions on my own.',
      'The park. There are BIRDS there.',
      'i can hear the fridge thinking about opening.',
      'Boredom is just an unthrown ball. That is not a saying but it should be.',
      'Oh. It is you. I mean — hey. Took you long enough.',
      'Town. Loads of people. Loads of them have food.',
      'what if treats… but bigger',
    ];
    for (const line of corpus) {
      const once = bronx(line);
      expect(bronx(once)).toBe(once);
    }
  });

  it('settles no matter what you throw at it', () => {
    // Generated sentences reach this function too, so the property has to hold
    // for text nobody has read.
    const words = ['there', 'you', 'the', 'that', 'this', 'going to', 'is not', 'waiting',
      'thing', 'ball', 'yes', 'very', 'them', 'your', 'a', 'dog'];
    for (let i = 0; i < 500; i += 1) {
      let line = '';
      for (let j = 0; j < 6; j += 1) line += `${words[(i * 7 + j * 13) % words.length]} `;
      line = `${line.trim()} ${i}.`;
      const once = bronx(line[0].toUpperCase() + line.slice(1));
      expect(bronx(once)).toBe(once);
    }
  });

  it('handles empty and whitespace without throwing', () => {
    expect(bronx('')).toBe('');
    expect(bronx('   ')).toBe('   ');
  });
});

/**
 * The grammar traps, each of which shipped once and was caught by reading the
 * app's real output rather than by unit tests. They are cheap to reintroduce
 * and embarrassing in a toy, so they are pinned.
 */
describe('the person he is talking to is not part of his accent', () => {
  const BODY = 'Ask me something. Or feed me. Your call, honestly.';

  it('sounds the same whoever you are', () => {
    // The garnish is chosen by hashing the line. With the name inside that
    // hash, "Mateo. Ask me somethin'." picked up a closer that "Caleb. Ask me
    // somethin'." did not — his accent varying by what a child is called, and
    // the recording of the body matching for only some of them.
    const alone = bronx(BODY);
    for (const name of ['Caleb', 'Ava', 'Mateo', 'Zoe', 'Thibault', 'Heather', 'Xavier']) {
      expect(splitLeadingName(bronx(`${name}. ${BODY}`))[1]).toBe(alone);
    }
  });

  it('knows a name from a word that means something', () => {
    expect(splitLeadingName('Caleb. Lie down.')[0]).toBe('Caleb');
    for (const word of ['No', 'Exactly', 'Yo', 'Right', 'Oh', 'Wait', 'Anyway']) {
      expect(splitLeadingName(`${word}. Lie down.`)[0]).toBeNull();
    }
  });

  it('recognises a name that is not spelled in ASCII', () => {
    // An ASCII-only pattern quietly stopped seeing these, and a child called
    // Zoë or José lost the recorded voice on every line he greets them by
    // name — the one place the app says who you are.
    for (const name of ['Zoë', 'José', 'Søren', 'Aísha']) {
      expect(splitLeadingName(`${name}. Lie down.`)[0]).toBe(name);
    }
  });

  it('leaves a line with no name in front of it alone', () => {
    expect(splitLeadingName('Lie down. I have decided.')).toEqual([null, 'Lie down. I have decided.']);
    expect(splitLeadingName('')).toEqual([null, '']);
  });
});

describe('it never produces broken English', () => {
  it('does not write "ya are"', () => {
    // `you` → `ya` in front of an auxiliary is not an accent, it is an error.
    expect(bronx('You are marginally better.')).not.toMatch(/\bya are\b/i);
    expect(bronx('You are marginally better.')).toMatch(/you're/i);
  });

  it('does not write "ya\u2019re"', () => {
    // `\byou\b` matches inside "you're", because an apostrophe is a
    // non-word character.
    expect(bronx("You're going to like this.")).not.toMatch(/ya're/i);
  });

  it('does not contract a stressed "you are"', () => {
    // "There you are" cannot become "there you're" — and it is the line he
    // greets you with, so it was the first thing he ever said wrong.
    const out = bronx('There you are.');
    expect(out).not.toMatch(/you're/i);
    expect(out).toMatch(/ya are/i);
  });

  it('never doubles an apostrophe', () => {
    // `\bsomething\b` matches inside "Something's", because the boundary sits
    // right before the apostrophe — and the replacement ends in one. He shipped
    // "Somethin''s gone from my head" to the voice recorder before anyone
    // noticed. Any rule whose replacement ends in an apostrophe has this trap.
    for (const line of [
      "Something's gone from my head.",
      "Nothing's here.",
      "Everything's fine and the waiting's over.",
      "That thing's mine.",
    ]) {
      expect(bronx(line)).not.toMatch(/''|\u2019\u2019|'\u2019|\u2019'/);
    }
    expect(bronx("Something's gone.")).toMatch(/Somethin's/);
    expect(bronx("Nothing's here.")).toMatch(/Nuttin's/);
  });

  it('does not write "you\u2019ll not"', () => {
    // A vicar, not a dog from the Bronx. The negative has to contract first.
    const out = bronx('You will not believe what I found.');
    expect(out).not.toMatch(/'ll not/i);
    expect(out).toMatch(/won't/i);
  });
});

describe('it actually does the job', () => {
  it('voices a plain line', () => {
    const out = bronx('You are not going to believe this thing.');
    expect(out).toMatch(/ain't|gonna/);
  });

  it('clips -ing endings', () => {
    expect(bronx('I am waiting and watching.')).toBe(
      bronx('I am waiting and watching.'),
    );
    expect(bronx('I am waiting and watching.')).toMatch(/waitin'/);
  });
});

describe('an auxiliary at the end of a clause does not contract', () => {
  // Shipped on the SECOND thing he says to a new player: "I'll remember that
  // longer than you will." came out "...longer than you'll." The file already
  // handled "there you are" as a one-off phrase; this is the rule that phrase
  // was an instance of.
  it('leaves a stressed verb whole', () => {
    expect(bronx('I will remember that longer than you will.')).toContain('than you will.');
    expect(bronx('That is exactly what you are.')).toContain('what you are.');
    expect(bronx('I know how much you have.')).toContain('much you have.');
    expect(bronx('Say it again and see how brave you are')).toMatch(/you are$/);
  });

  it('still contracts in the middle of a clause', () => {
    expect(bronx('you are the best')).toContain("you're");
    expect(bronx('you will see')).toContain("you'll");
    expect(bronx('you have a stick')).toContain("you've");
  });

  it('leaves the negatives alone, which are right either way', () => {
    expect(bronx('I do not.')).toContain("don't.");
    expect(bronx('It is not.')).toContain("ain't.");
  });
});
