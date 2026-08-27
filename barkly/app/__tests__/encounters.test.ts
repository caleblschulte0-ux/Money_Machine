import {
  adjustSocialBond,
  freshCharacter,
  noteSocialChoice,
  withFriend,
  withGrievance,
  withTreasure,
} from '../src/barkly/character';
import { deriveSocialEncounter, shouldOfferEncounter } from '../src/barkly/encounters';
import { emptyMemory } from '../src/barkly/memory';
import { mergeTrainingRules } from '../src/barkly/training';

const NOW = 1_000_000_000_000;

describe('choice-driven social encounters', () => {
  it('lets a Duke scene either escalate or cool the feud', () => {
    let character = freshCharacter();
    character = withGrievance(character, 'Duke', 'stole the ball', NOW);
    character = withGrievance(character, 'Duke', 'looked smug', NOW + 1);
    character = withTreasure(character, 'duck-shaped rock', NOW + 2);

    const encounter = deriveSocialEncounter({ npcId: 'duke', character, memory: emptyMemory() });
    expect(encounter.title).toContain('treasure');
    expect(encounter.choices.some((choice) => choice.bondDelta > 0)).toBe(true);
    expect(encounter.choices.some((choice) => choice.bondDelta < 0)).toBe(true);
  });

  it('pulls a real learned routine into later social gameplay', () => {
    const memory = emptyMemory();
    const merged = mergeTrainingRules(
      [],
      [{
        cue: 'showtime',
        instruction: 'spin, sit, then play dead',
        speech: 'Showtime.',
        actions: ['EXCITED'],
        routine: [
          { speech: 'Spin.', actions: ['EXCITED'] },
          { speech: 'Sit.', actions: ['SIT'] },
        ],
      }],
      NOW,
    );
    memory.trainingRules = [{ ...merged.rules[0], timesTriggered: 5 }];

    let character = freshCharacter();
    character = withFriend(character, 'Biscuit', NOW);
    character = withFriend(character, 'Biscuit', NOW + 1);
    const encounter = deriveSocialEncounter({ npcId: 'biscuit', character, memory });

    expect(encounter.prompt).toContain('showtime');
    expect(encounter.choices.some((choice) => choice.routineCue === 'showtime')).toBe(true);
  });

  it('can cool a rivalry without allowing the relationship count below zero', () => {
    let character = freshCharacter();
    character = adjustSocialBond(character, 'Duke', 'rival', 1, NOW);
    character = adjustSocialBond(character, 'Duke', 'rival', -50, NOW + 1);
    expect(character.socialBonds?.Duke.encounters).toBe(0);
  });

  it('paces authored chapters independently from bond strength', () => {
    let character = freshCharacter();
    character = adjustSocialBond(character, 'Duke', 'rival', 2, NOW);
    expect(shouldOfferEncounter(character, 'duke')).toBe(true);

    character = noteSocialChoice(character, 'Duke');
    character = adjustSocialBond(character, 'Duke', 'rival', -1, NOW + 1);
    expect(shouldOfferEncounter(character, 'duke')).toBe(false);

    character = adjustSocialBond(character, 'Duke', 'rival', 4, NOW + 2);
    expect(shouldOfferEncounter(character, 'duke')).toBe(true);
  });
});
