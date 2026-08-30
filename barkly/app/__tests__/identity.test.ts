import { freshCharacter } from '../src/barkly/character';
import { deriveBarklyIdentity } from '../src/barkly/identity';
import { emptyMemory } from '../src/barkly/memory';

const stats = { mood: 70, energy: 70, hunger: 30, affection: 82, curiosity: 75 };

describe('Barkly Identity Engine', () => {
  test('two histories produce different Barklys without a personality picker', () => {
    const parkLife = emptyMemory();
    parkLife.experiences = Array.from({ length: 5 }, (_, i) => ({
      id: `park-${i}`,
      what: `Played outside ${i}`,
      where: 'the park',
      at: i,
      importance: 0.7,
      lastReferencedAt: i,
      referenceCount: 1,
    }));
    const social = freshCharacter();
    social.socialBonds = {
      Biscuit: { kind: 'friend', encounters: 8, firstSeenAt: 1, lastSeenAt: 8 },
    };

    const homeLife = emptyMemory();
    homeLife.trainingRules = [{
      id: 'showtime', normalizedCue: 'showtime', cue: 'showtime', instruction: 'spin then sit',
      speech: 'Fine.', actions: [], learnedAt: 1, updatedAt: 9, timesTriggered: 9,
    }];
    const collector = freshCharacter();
    collector.treasuresFound = 8;
    collector.favoriteTreasure = 'duck rock';
    collector.treasureAffinities = {
      'duck rock': { score: 8, discoveries: 2, firstSeenAt: 1, lastSeenAt: 10 },
    };

    const a = deriveBarklyIdentity({ memory: parkLife, character: social, stats });
    const b = deriveBarklyIdentity({ memory: homeLife, character: collector, stats });

    expect(a.summary).not.toEqual(b.summary);
    expect(a.preferences.some((p) => p.kind === 'place' && p.subject === 'the park')).toBe(true);
    expect(a.preferences.some((p) => p.kind === 'friend' && p.subject === 'Biscuit')).toBe(true);
    expect(b.preferences.some((p) => p.kind === 'ritual' && p.subject === 'showtime')).toBe(true);
    expect(b.preferences.some((p) => p.kind === 'treasure' && p.subject === 'duck rock')).toBe(true);
  });

  test('one visit is not enough to manufacture a favorite place', () => {
    const memory = emptyMemory();
    memory.experiences = [{
      id: 'beach-1', what: 'Went to the beach', where: 'the beach', at: 1,
      importance: 0.8, lastReferencedAt: 1, referenceCount: 0,
    }];
    const identity = deriveBarklyIdentity({ memory, character: freshCharacter(), stats });
    expect(identity.preferences.some((p) => p.kind === 'place')).toBe(false);
  });

  test('repeated history becomes an opinion Barkly can act on', () => {
    const memory = emptyMemory();
    const character = freshCharacter();
    character.socialBonds = {
      Duke: { kind: 'rival', encounters: 7, firstSeenAt: 1, lastSeenAt: 7 },
    };
    const identity = deriveBarklyIdentity({ memory, character, stats });
    const duke = identity.opinions.find((o) => o.subject === 'Duke');
    expect(duke?.stance).toBe('feuding');
    expect(duke?.line).toMatch(/file/i);
  });

  test('identity receipts expose evidence instead of fake labels', () => {
    const memory = emptyMemory();
    memory.experiences = [0, 1, 2].map((i) => ({
      id: `town-${i}`, what: 'Town trip', where: 'town', at: i,
      importance: 0.6, lastReferencedAt: i, referenceCount: 0,
    }));
    const identity = deriveBarklyIdentity({ memory, character: freshCharacter(), stats });
    expect(identity.receipts[0]).toMatch(/3 receipts/);
  });
});
