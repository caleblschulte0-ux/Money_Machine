import { freshCharacter } from '../src/barkly/character';
import { emptyMemory } from '../src/barkly/memory';
import { deriveWorldIncident, noteIncidentChoice, noteIncidentSeen } from '../src/world/incidents';

const NOW = 10 * 86_400_000;

describe('autonomous world incidents', () => {
  test('history can make Duke start trouble without being tapped', () => {
    const character = freshCharacter();
    character.favoriteTreasure = 'duck rock';
    character.treasureAffinities = { 'duck rock': { score: 5, discoveries: 1, firstSeenAt: 1, lastSeenAt: 2 } };
    character.socialBonds = { Duke: { kind: 'rival', encounters: 7, firstSeenAt: 1, lastSeenAt: 2 } };
    const incident = deriveWorldIncident({ location: 'park', character, memory: emptyMemory(), now: NOW });
    expect(incident?.id).toBe('duke-eyes-the-treasure');
    expect(incident?.setup).toContain('duck rock');
    expect(incident?.choices.length).toBeGreaterThan(1);
  });

  test('a private routine can leak into the public world', () => {
    const memory = emptyMemory();
    memory.trainingRules = [{
      id: 'intruder', normalizedCue: 'intruder alert', cue: 'intruder alert', instruction: 'act terrified',
      speech: 'Oh no.', actions: [], learnedAt: 1, updatedAt: 2, timesTriggered: 8,
    }];
    const character = freshCharacter();
    character.socialBonds = { Pepper: { kind: 'friend', encounters: 5, firstSeenAt: 1, lastSeenAt: 2 } };
    const incident = deriveWorldIncident({ location: 'town', character, memory, now: NOW });
    expect(incident?.id).toBe('pepper-knows-the-bit');
    expect(incident?.setup).toContain('intruder alert');
  });

  test('incident cooldown prevents the world from nagging', () => {
    const character = freshCharacter();
    character.socialBonds = { Biscuit: { kind: 'friend', encounters: 5, firstSeenAt: 1, lastSeenAt: 2 } };
    const memory = emptyMemory();
    const first = deriveWorldIncident({ location: 'park', character, memory, now: NOW });
    expect(first?.id).toBe('biscuit-lost-stick');
    const ledger = noteIncidentSeen({}, first!, NOW);
    const immediate = deriveWorldIncident({ location: 'park', character, memory, ledger, now: NOW + 1000 });
    expect(immediate).toBeNull();
    const later = deriveWorldIncident({ location: 'park', character, memory, ledger, now: NOW + 3 * 86_400_000 });
    expect(later?.id).toBe('biscuit-lost-stick');
  });

  test('choice is durable in the incident ledger', () => {
    const character = freshCharacter();
    character.socialBonds = { Biscuit: { kind: 'friend', encounters: 4, firstSeenAt: 1, lastSeenAt: 2 } };
    const incident = deriveWorldIncident({ location: 'park', character, memory: emptyMemory(), now: NOW })!;
    const seen = noteIncidentSeen({}, incident, NOW);
    const chosen = noteIncidentChoice(seen, incident.id, 'help');
    expect(chosen[incident.id].timesSeen).toBe(1);
    expect(chosen[incident.id].lastChoiceId).toBe('help');
  });
});
