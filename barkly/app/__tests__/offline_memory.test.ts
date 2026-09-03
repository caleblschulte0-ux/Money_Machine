/**
 * WHAT HE KEEPS WHEN THERE IS NO BRAIN.
 *
 * Every stranger who opens the web playtest gets the offline path -- no model
 * is configured there -- so this is the code that has to carry the product's
 * whole promise during validation. Before 2026-09-03 it carried a NAME and
 * nothing else: you could tell him your favourite food and he would answer,
 * warmly and in character, and then have no idea what you said thirty seconds
 * later. Worse, asking him about it produced a confident non-answer ("I know
 * exactly what Favorite is. I'm choosin' not to say"), which reads as a
 * chatbot bluffing rather than a dog who does not know yet.
 */

import { personalFactFrom, parseFactStatement } from '../src/barkly/facts';

describe('personal facts the offline brain keeps', () => {
  const kept: [string, string][] = [
    // Underscore keys are the store's convention (see prompts.ts examples);
    // a spaced key silently degrades to an unstructured note.
    ['my favorite food is pizza', 'favorite_food = pizza'],
    ['my favourite colour is blue', 'favourite_colour = blue'],
    ['I love sharks', 'likes = sharks'],
    ['i hate mushrooms', 'dislikes = mushrooms'],
  ];
  for (const [said, want] of kept) {
    it(`keeps "${said}"`, () => {
      expect(personalFactFrom(said)).toBe(want);
    });
  }

  /*
   * The refusals matter more than the captures. A question stored as a fact
   * is how he ends up "remembering" that your favourite food is the words
   * "what is my favorite food".
   */
  const refused = [
    'what is my favorite food',
    'what is my favorite food?',
    'do you remember my favorite food',
    'is my favorite food pizza',
    'hello',
    'good boy',
  ];
  for (const said of refused) {
    it(`refuses to store "${said}"`, () => {
      expect(personalFactFrom(said)).toBeNull();
    });
  }

  it('produces a string the existing fact parser already understands', () => {
    // Not a new fact format -- the same `key = value` shape every other
    // caller uses, so it merges and ranks identically.
    const line = personalFactFrom('my favorite food is pizza');
    const fact = parseFactStatement(line!, Date.now());
    expect(fact).not.toBeNull();
    expect(fact!.value.toLowerCase()).toContain('pizza');
    // Structured, not a fallback note keyed by content hash -- a note is
    // stored but unfindable, which is worse than not storing it.
    expect(fact!.key).toBe('favorite_food');
  });
});

describe('he brings a taught cue up himself', () => {
  const { pickThought } = require('../src/world/thoughts');

  it('sometimes thinks about a cue you taught him', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      seen.add(pickThought('home', 12, seed, ['IRS']));
    }
    expect([...seen].some((t) => t.includes('IRS'))).toBe(true);
  });

  it('does not nag — most idle thoughts are still about the world', () => {
    let aboutCue = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      if (pickThought('home', 12, seed, ['IRS']).includes('IRS')) aboutCue += 1;
    }
    expect(aboutCue).toBeLessThan(20);
  });

  it('never mentions a cue when nothing has been taught', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      expect(pickThought('home', 12, seed, [])).not.toContain('“');
    }
  });
});
