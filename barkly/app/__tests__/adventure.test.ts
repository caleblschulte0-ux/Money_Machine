import { freshCharacter, withFriend, withGrievance } from '../src/barkly/character';
import { emptyMemory } from '../src/barkly/memory';
import { mergeTrainingRules } from '../src/barkly/training';
import { createAdventure, progressAdventure } from '../src/game/adventure';

const NOW = Date.UTC(2026, 7, 27, 12);

function base() {
  return {
    character: freshCharacter(),
    memory: emptyMemory(),
    xp: 220,
    now: NOW,
  };
}

describe("Barkly's Plan", () => {
  it('creates exactly three session goals with no streak state', () => {
    const plan = createAdventure(base());
    expect(plan.goals).toHaveLength(3);
    expect(plan.rewarded).toBe(false);
    expect(plan.completedAt).toBeUndefined();
    expect(plan.day).toBe('2026-08-27');
  });

  it('uses this Barkly history as goal material', () => {
    const input = base();
    input.character = withGrievance(input.character, 'Duke', 'was annoying', NOW);
    input.character = withFriend(input.character, 'Biscuit', NOW + 1);
    const merged = mergeTrainingRules(
      [],
      [{ cue: 'showtime', instruction: 'perform the routine', speech: 'Showtime.', actions: ['EXCITED'] }],
      NOW,
    );
    input.memory.trainingRules = [{ ...merged.rules[0], timesTriggered: 5 }];

    const plan = createAdventure(input);
    const text = plan.goals.map((goal) => `${goal.label} ${goal.detail}`).join(' ');
    expect(text).toMatch(/Duke|Biscuit|showtime/i);
  });

  it('only completes a targeted NPC goal for the correct dog', () => {
    const plan = {
      ...createAdventure(base()),
      goals: [{ id: 'duke', kind: 'npc' as const, target: 'duke', label: 'See Duke', detail: '', done: false }],
    };
    const wrong = progressAdventure(plan, { kind: 'npc', target: 'Biscuit' }, NOW + 1);
    expect(wrong.changed).toBe(false);

    const right = progressAdventure(plan, { kind: 'npc', target: 'Duke' }, NOW + 2);
    expect(right.changed).toBe(true);
    expect(right.justCompleted).toBe(true);
  });

  it('signals completion once and cannot farm the same finished plan', () => {
    const plan = {
      ...createAdventure(base()),
      goals: [
        { id: 'talk', kind: 'talk' as const, label: 'Talk', detail: '', done: false },
        { id: 'play', kind: 'play' as const, label: 'Play', detail: '', done: false },
      ],
    };
    const first = progressAdventure(plan, { kind: 'talk' }, NOW + 1);
    expect(first.justCompleted).toBe(false);
    const second = progressAdventure(first.state, { kind: 'play' }, NOW + 2);
    expect(second.justCompleted).toBe(true);
    const repeat = progressAdventure(second.state, { kind: 'play' }, NOW + 3);
    expect(repeat.changed).toBe(false);
    expect(repeat.justCompleted).toBe(false);
  });

  it('rolls to a new day without punishing an unfinished plan', () => {
    const today = createAdventure(base());
    const tomorrow = createAdventure({ ...base(), now: NOW + 86_400_000 });
    expect(today.day).not.toBe(tomorrow.day);
    expect(tomorrow.goals.every((goal) => !goal.done)).toBe(true);
  });
});
