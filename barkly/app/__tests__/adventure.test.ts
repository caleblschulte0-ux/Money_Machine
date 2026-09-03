import { freshCharacter, withFriend, withGrievance } from '../src/barkly/character';
import { emptyMemory } from '../src/barkly/memory';
import { mergeTrainingRules } from '../src/barkly/training';
import { adventureDay, createAdventure, progressAdventure } from '../src/game/adventure';

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

  it('defines today from the device calendar instead of UTC serialization', () => {
    const local = new Date(2026, 7, 27, 23, 55, 0);
    const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
    expect(adventureDay(local.getTime())).toBe(expected);
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

describe('the plan is the on-ramp for a player with no history', () => {
  /*
   * Every other NPC goal hangs off a bond that already exists, so before this
   * a brand-new player's plan never left the room -- and "Barkly holds a
   * grudge for days" is a third of the product pitch with nothing pointing at
   * it. Found by scoring the shipped first session as a stranger, 2026-09-03.
   */
  it('sends a player who has met nobody to meet a dog', () => {
    const plan = createAdventure(base());
    const first = plan.goals[0];
    expect(first.id).toBe('first-dog');
    expect(first.kind).toBe('npc');
    expect(first.target).toBe('duke');
  });

  it('pins it, so it cannot be rotated out on an unlucky day', () => {
    // The rotation offset is a hash of the calendar day; across a month of
    // days the on-ramp must appear every single time, not most of the time.
    for (let d = 1; d <= 28; d += 1) {
      const plan = createAdventure({ ...base(), now: Date.UTC(2026, 7, d, 12) });
      expect(plan.goals.some((g) => g.id === 'first-dog')).toBe(true);
    }
  });

  it('disappears the moment they have actually met someone', () => {
    const input = base();
    input.character = withFriend(input.character, 'Biscuit', NOW);
    const plan = createAdventure(input);
    expect(plan.goals.some((g) => g.id === 'first-dog')).toBe(false);
  });

  it('still produces three goals, and does not crowd out the rest', () => {
    const plan = createAdventure(base());
    expect(plan.goals).toHaveLength(3);
    expect(new Set(plan.goals.map((g) => g.id)).size).toBe(3);
  });
});
