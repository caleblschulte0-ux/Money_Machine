import { freshCharacter, withFriend, withGrievance, withTreasure } from '../src/barkly/character';
import { emptyMemory } from '../src/barkly/memory';
import { deriveStoryArc } from '../src/barkly/story';
import { mergeTrainingRules } from '../src/barkly/training';

const NOW = 1_000_000_000_000;

describe('Barkly story engine', () => {
  it('does not invent a story before history exists', () => {
    expect(deriveStoryArc({ character: freshCharacter(), memory: emptyMemory() })).toBeUndefined();
  });

  it('turns a rival plus favorite treasure into a specific ongoing saga', () => {
    let character = withTreasure(freshCharacter(), 'the perfect stick', NOW);
    for (let i = 0; i < 6; i++) character = withGrievance(character, 'Duke', 'kept starting things', NOW + i + 1);

    const story = deriveStoryArc({ character, memory: emptyMemory() });
    expect(story?.title).toBe('The Duke Situation');
    expect(story?.chapter).toContain('Nemesis Era');
    expect(story?.premise).toContain('the perfect stick');
    expect(story?.cast).toContain('Duke');
  });

  it('turns a real friend plus rival into dog-park politics', () => {
    let character = freshCharacter();
    for (let i = 0; i < 4; i++) character = withFriend(character, 'Biscuit', NOW + i);
    for (let i = 0; i < 4; i++) character = withGrievance(character, 'Duke', 'was unbearable', NOW + 10 + i);

    const story = deriveStoryArc({ character, memory: emptyMemory() });
    expect(story?.title).toBe('Dog Park Politics');
    expect(story?.premise).toContain('Biscuit');
    expect(story?.premise).toContain('Duke');
  });

  it('lets a signature private ritual leak into the social story', () => {
    const memory = emptyMemory();
    const merged = mergeTrainingRules(
      [],
      [{ cue: 'showtime', instruction: 'spin then sit', speech: 'Showtime.', actions: ['EXCITED'] }],
      NOW,
    );
    memory.trainingRules = [{ ...merged.rules[0], timesTriggered: 9 }];
    const character = withFriend(freshCharacter(), 'Biscuit', NOW);

    const story = deriveStoryArc({ character, memory });
    expect(story?.title).toBe('The Bit Has Escaped Containment');
    expect(story?.premise).toContain('showtime');
    expect(story?.premise).toContain('Biscuit');
  });

  it('turns repeated treasure hunting into a collection saga', () => {
    let character = freshCharacter();
    for (let i = 0; i < 6; i++) character = withTreasure(character, `rock ${i}`, NOW + i);
    const story = deriveStoryArc({ character, memory: emptyMemory() });
    expect(story?.title).toBe('The Museum of Questionable Objects');
    expect(story?.chapter).toContain('Collection');
  });
});
