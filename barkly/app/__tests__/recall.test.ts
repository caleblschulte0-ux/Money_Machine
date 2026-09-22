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


describe('what did we do yesterday -- recall from TIME, not from a noun', () => {
  // Every other branch needs a subject. The question a stranger types in the
  // first two minutes has none, and it fell through to the offline composer,
  // which answered the product's central claim with "I did not understand
  // that" on the Fresh and Duke Nemesis playtest slots (2026-09-22).
  const DAY = 86_400_000;
  const dated = (id: string, what: string, daysAgo: number, importance = 5) =>
    ({ id, what, at: NOW - daysAgo * DAY, importance, lastReferencedAt: NOW, referenceCount: 0 }) as never;
  const timeline = [
    dated('t1', 'Duke called the good stick a twig in front of everyone.', 30),
    dated('t2', 'Won the fetch duel at the park. Duke has not mentioned it since.', 9, 8),
    dated('t3', 'Dug up half a tennis ball. Kept it.', 1),
  ];
  const askAt = (text: string, over: Record<string, unknown> = {}) =>
    recall({ text, facts, experiences: timeline, character, seed: 3, now: NOW, ...over } as never);

  it('answers "yesterday" with the thing from yesterday', () => {
    const r = askAt('do you remember what we did yesterday?');
    expect(r).not.toBeNull();
    expect(r!.speech).toContain('tennis ball');
  });

  it('answers without the word "remember" at all', () => {
    expect(askAt('what did we do yesterday?')!.speech).toContain('tennis ball');
    expect(askAt('anything new?')!.speech).toContain('tennis ball');
  });

  it('is honest about an empty window and offers the newest thing WITH its age', () => {
    const r = askAt('what did we do today?');
    expect(r).not.toBeNull();
    expect(r!.speech).toMatch(/nothing|not today/i);
    expect(r!.speech).toContain('tennis ball');
    expect(r!.speech).toMatch(/yesterday/);
  });

  it('phrases an older miss with a day count, so the record is checkable', () => {
    const r = askAt('what did we do yesterday?', { experiences: timeline.slice(0, 2) });
    expect(r!.speech).toMatch(/9 days ago/);
    expect(r!.speech).toContain('fetch duel');
  });

  it('"tell me a story about us" picks the most important memory, not the newest', () => {
    expect(askAt('tell me a story about us')!.speech).toContain('fetch duel');
  });

  it('a Fresh Barkly says nothing has happened yet, and how to change that', () => {
    const r = askAt('what do you remember?', { experiences: [] });
    expect(r).not.toBeNull();
    expect(r!.speech).toMatch(/nothing yet|haven't done anything|nothing's happened/i);
    expect(r!.speech).not.toMatch(/understand/);
  });

  it('never outranks a question with a precise subject', () => {
    expect(askAt('what happened with Duke yesterday')!.speech).toMatch(/Duke/);
  });

  it('stays out of a plain statement about the past', () => {
    expect(askAt('we went to the park and it was fun')).toBeNull();
  });
});


describe('a blank experience is not a memory', () => {
  // The store never writes a blank experience (makeExperience returns null
  // for one), but presets and imports hand `experiences` in directly. A blank
  // that reached the timeline would put " That was today. I keep a diary." in
  // his mouth -- a sentence with a hole where the memory goes.
  const DAY = 86_400_000;
  const blank = { id: 'b', what: '   ', at: NOW - 1000, importance: 9, lastReferencedAt: NOW, referenceCount: 0 } as never;
  const real = { id: 'r', what: 'Dug up a bottle cap collection at the park.', at: NOW - DAY, importance: 5, lastReferencedAt: NOW, referenceCount: 0 } as never;

  it('is skipped in favour of a real one', () => {
    const r = recall({ text: 'what did we do?', facts, experiences: [blank, real], character, seed: 3, now: NOW } as never);
    expect(r!.speech).toContain('bottle cap');
    expect(r!.speech).not.toMatch(/^\s|\.\s+That was today/);
  });

  it('counts as nothing when it is all there is', () => {
    const r = recall({ text: 'what did we do today?', facts, experiences: [blank], character, seed: 3, now: NOW } as never);
    expect(r!.speech).toMatch(/nothing yet|haven't done anything|nothing's happened/i);
  });
});
