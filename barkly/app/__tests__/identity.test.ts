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
    // 'the park' normalises to 'Park' -- see the merging test below.
    expect(a.preferences.some((p) => p.kind === 'place' && p.subject === 'Park')).toBe(true);
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

  /*
   * ONE SPELLING FOR ONE PLACE.
   *
   * `where` arrived in three shapes: 'park' from a preset, 'Park' from
   * LOCATIONS[...].name in live play, and one hand-written 'the beach' in the
   * wave-chasing reward. Grouping on the raw string filed them as separate
   * places holding a fraction of the evidence each, so somewhere he genuinely
   * lives could sit under the two-visit bar forever with four visits on file.
   * The source now writes one spelling; this keeps the engine robust anyway,
   * because the next hand-written `where` is one commit away.
   */
  test('one place is one place however the visit spelled it', () => {
    const memory = emptyMemory();
    const spellings = ['the beach', 'Beach', 'beach', 'The Beach'];
    memory.experiences = spellings.map((where, i) => ({
      id: `beach-${i}`,
      what: `Barked at the sea ${i}`,
      where,
      at: i,
      importance: 0.6,
      lastReferencedAt: i,
      referenceCount: 1,
    }));
    const identity = deriveBarklyIdentity({ memory, character: freshCharacter(), stats });
    const places = identity.preferences.filter((p) => p.kind === 'place');
    expect(places).toHaveLength(1);
    expect(places[0].subject).toBe('Beach');
    expect(places[0].evidence).toBe(4);
  });

  test("a dog's name is his name, not the key his bond happens to be filed under", () => {
    // A bond is stored under whichever spelling arrived first -- 'Duke' from
    // live play, 'duke' from a preset -- and identity printed that key straight
    // into the system prompt: his nemesis was called "duke".
    const character = freshCharacter();
    character.socialBonds = {
      duke: { kind: 'rival', encounters: 14, firstSeenAt: 1, lastSeenAt: 9 },
      biscuit: { kind: 'friend', encounters: 30, firstSeenAt: 1, lastSeenAt: 9 },
    };
    const identity = deriveBarklyIdentity({ memory: emptyMemory(), character, stats });
    const subjects = identity.preferences.map((p) => p.subject);
    expect(subjects).toContain('Duke');
    expect(subjects).toContain('Biscuit');
    expect(subjects).not.toContain('duke');
    const receipts = identity.receipts.join(' ');
    // "Duke is a generational feud" -- the top rung of each ladder names the
    // RELATIONSHIP, not the dog, so it can never follow "<name> is a".
    expect(receipts).not.toMatch(/is an? (?:generational feud|pack family)/);
    expect(receipts).toContain('Barkly and Duke: generational feud');
    expect(receipts).toContain('Barkly and Biscuit: pack family');
  });

  test('a maxed-out Barkly is still a specific Barkly', () => {
    /*
     * Every axis clamped to 100 BEFORE sorting, so a long save with four maxed
     * axes tied and fell through to `a.id.localeCompare(b.id)`: the summary
     * "collector, dramatic, social" was alphabetical order, not this dog. Two
     * players with completely different histories read the same sentence, at
     * exactly the point they had invested most.
     */
    const character = freshCharacter();
    character.treasuresFound = 40;
    character.favoriteTreasure = 'duck rock';
    character.socialBonds = { biscuit: { kind: 'friend', encounters: 60, firstSeenAt: 1, lastSeenAt: 9 } };
    const memory = emptyMemory();
    memory.trainingRules = Array.from({ length: 6 }, (_, i) => ({
      id: `t${i}`, normalizedCue: `t${i}`, cue: `t${i}`, instruction: 'x',
      speech: 'x', actions: [], learnedAt: 1, updatedAt: 9, timesTriggered: 30,
    }));
    const identity = deriveBarklyIdentity({ memory, character, stats });
    const maxed = identity.axes.filter((a) => a.score === 100);
    expect(maxed.length).toBeGreaterThan(2);
    // Trained-ish carries the most evidence by a distance -- 6 rules and 180
    // triggers -- so it must still lead once four axes all display 100.
    // Alphabetical order would have put 'collector' first.
    expect(identity.axes[0].id).toBe('trained');
    expect(identity.axes[0].score).toBe(100);
    expect(identity.summary).toMatch(/^This Barkly has become trained-ish,/);
  });
});