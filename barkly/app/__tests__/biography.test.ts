import { freshCharacter } from '../src/barkly/character';
import { deriveHomeBiography, biographyPromptTexture } from '../src/world/biography';
import { emptyMemory } from '../src/barkly/memory';

describe('home as biography', () => {
  test('the same room becomes different after a life happens', () => {
    const character = freshCharacter();
    character.favoriteTreasure = 'duck rock';
    character.treasureAffinities = { 'duck rock': { score: 7, discoveries: 1, firstSeenAt: 1, lastSeenAt: 2 } };
    character.socialBonds = {
      Biscuit: { kind: 'friend', encounters: 8, firstSeenAt: 1, lastSeenAt: 8 },
      Duke: { kind: 'rival', encounters: 7, firstSeenAt: 1, lastSeenAt: 7 },
    };
    const memory = emptyMemory();
    memory.trainingRules = [{
      id: 'showtime', normalizedCue: 'showtime', cue: 'showtime', instruction: 'spin then sit',
      speech: 'Okay.', actions: [], learnedAt: 1, updatedAt: 10, timesTriggered: 9,
    }];

    const props = deriveHomeBiography({ character, memory });
    expect(props.map((p) => p.kind)).toEqual(expect.arrayContaining(['treasure', 'photo', 'rival-dossier', 'ritual-token']));
    expect(props.find((p) => p.kind === 'treasure')?.title).toBe('duck rock');
    expect(props.find((p) => p.kind === 'rival-dossier')?.title).toMatch(/DUKE/i);
    expect(props.length).toBeLessThanOrEqual(5);
  });

  test('fresh Barkly has no fake biography props', () => {
    expect(deriveHomeBiography({ character: freshCharacter(), memory: emptyMemory() })).toEqual([]);
  });

  test('biography can be fed back into Barkly prompt texture', () => {
    const character = freshCharacter();
    character.favoriteTreasure = 'good stick';
    character.treasureAffinities = { 'good stick': { score: 5, discoveries: 1, firstSeenAt: 1, lastSeenAt: 2 } };
    const texture = biographyPromptTexture(deriveHomeBiography({ character, memory: emptyMemory() }));
    expect(texture).toContain('good stick');
    expect(texture).toMatch(/home visibly remembers/i);
  });
});
