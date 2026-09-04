/**
 * Recall answers from the record. These tests are about the two places it
 * could NOT reach, and about it still refusing to invent.
 */
import { recall } from '../src/barkly/recall';
import { adjustSocialBond, freshCharacter, withTreasure } from '../src/barkly/character';

const NOW = 1_700_000_000_000;
const exp = (id: string, what: string, over: Record<string, unknown> = {}) =>
  ({ id, what, at: NOW - 86_400_000, importance: 5, lastReferencedAt: NOW - 86_400_000, referenceCount: 0, ...over }) as never;
const fact = (id: string, key: string, value: string, refs = 0) =>
  ({ id, subject: 'person', key, value, confidence: 1, learnedAt: NOW, lastReferencedAt: NOW, referenceCount: refs, history: [] }) as never;

const facts = [fact('f1', 'name', 'Caleb'), fact('f2', 'favorite_food', 'pizza', 2), fact('f3', 'sister', 'Mia')];
const experiences = [
  exp('e1', 'Caleb threw the ball for me at the park.', { where: 'the park' }),
  exp('e3', 'Duke said my duck rock was “kind of mid”.', { withWhom: ['Duke'] }),
];
let character = withTreasure(freshCharacter(), 'a rock that looks like a duck', NOW);
for (let i = 0; i < 8; i += 1) character = adjustSocialBond(character, 'Duke', 'rival', 1, NOW + i * 60_000);

const ask = (text: string, over: Record<string, unknown> = {}) =>
  recall({ text, facts, experiences, character, seed: 3, ...over } as never);

describe('what do you remember about me', () => {
  // The most direct question anyone can ask this product, and it fell through
  // every branch to the composer — which does not read the record at all — so
  // "what do you know about me" got a joke about squirrels back. Recall
  // answered from EXPERIENCES and from dogs, and never from the FACTS, which
  // are the things the player told him about themselves.
  it('answers from the file', () => {
    const r = ask('what do you remember about me');
    expect(r).not.toBeNull();
    expect(r!.speech).toContain('pizza');
    expect(r!.speech).toContain('Mia');
  });

  it('is honest when the file is thin, rather than claiming everything', () => {
    const r = ask('what do you know about me', { facts: [fact('f1', 'name', 'Caleb')] });
    expect(r).not.toBeNull();
    expect(r!.speech).toMatch(/so far|Tell me something else/i);
    expect(r!.speech).not.toMatch(/Loads|Everything/);
  });

  it('says so plainly when it knows nothing at all', () => {
    const r = ask('what do you remember about me', { facts: [] });
    expect(r!.speech).toMatch(/nothing/i);
  });

  it('does not print the whole table', () => {
    const many = [fact('n', 'name', 'Caleb'), ...Array.from({ length: 9 }, (_, i) => fact(`k${i}`, `thing_${i}`, `value${i}`))];
    const r = ask('what do you remember about me', { facts: many });
    // Not the name — he opens with that, and it is not one of the three.
    const named = many.filter((f) => (f as { key: string }).key !== 'name' && r!.speech.includes((f as { value: string }).value));
    expect(named.length).toBeLessThanOrEqual(3);
    expect(r!.speech).toMatch(/more I'm holding back/);
  });
});

describe('a thing they told him, not a thing that happened', () => {
  it('recalls a stored fact by its key', () => {
    const r = ask('do you remember my sister');
    expect(r).not.toBeNull();
    expect(r!.speech).toContain('Mia');
    expect(r!.factIds).toContain('f3');
  });

  it('does not let the roll-call swallow a precise question', () => {
    // Dog first, then fact, then experience, then the broad one.
    expect(ask('what happened with Duke')!.speech).toContain('Duke');
    expect(ask('do you remember the park')!.speech).toContain('park');
  });
});

describe('it still refuses to invent', () => {
  it('says nothing about something that never happened', () => {
    expect(ask('do you remember the cat')).toBeNull();
    expect(ask('remember that thing')).toBeNull();
  });

  it('stays out of an ordinary sentence with no reaching-back in it', () => {
    expect(ask('my sister is here')).toBeNull();
    expect(ask('is Duke around')).toBeNull();
    // The about-me branch runs before the recall cue, so it has to be narrow.
    expect(ask('i know my sister likes you')).toBeNull();
    expect(ask('tell me about the park')).not.toBeNull();
  });
});
