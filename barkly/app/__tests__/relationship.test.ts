import { adjustSocialBond, freshCharacter, withFriend, withGrievance, withTreasure } from '../src/barkly/character';
import { emptyMemory } from '../src/barkly/memory';
import { buildRelationshipProfile, describeRelationship } from '../src/barkly/relationship';
import { freshSnapshot } from '../src/barkly/state';
import { mergeTrainingRules } from '../src/barkly/training';

const NOW = 1_000_000_000_000;

function base() {
  return {
    memory: emptyMemory(),
    stats: freshSnapshot(NOW).stats,
    stashCount: 0,
    character: freshCharacter(),
  };
}

describe('Relationship DNA', () => {
  it('starts as a blank relationship rather than assigning fake personality', () => {
    const profile = buildRelationshipProfile(base());
    expect(profile.stage.label).toBe('Just Met');
    expect(profile.archetype).toBe('Fresh Pack');
    expect(profile.traits).toHaveLength(0);
    expect(profile.rituals).toHaveLength(0);
    expect(profile.lore).toHaveLength(0);
  });

  it('becomes trainer-shaped from actual taught behavior', () => {
    const input = base();
    const merged = mergeTrainingRules(
      [],
      [
        { cue: 'showtime', instruction: 'spin then sit', speech: 'Showtime.', actions: ['EXCITED'] },
        { cue: 'freeze', instruction: 'sit still', speech: 'Fine.', actions: ['SIT'] },
      ],
      NOW,
    );
    input.memory.trainingRules = merged.rules.map((rule) => ({ ...rule, timesTriggered: 4 }));

    const profile = buildRelationshipProfile(input);
    expect(profile.traits[0].id).toBe('trainer');
    expect(profile.traits[0].score).toBeGreaterThan(50);
  });

  it('turns repeated taught cues into private rituals, then signature rituals', () => {
    const input = base();
    const merged = mergeTrainingRules(
      [],
      [{ cue: 'intruder alert', instruction: 'act terrified', speech: 'NOPE.', actions: ['EAR_PERK'] }],
      NOW,
    );
    input.memory.trainingRules = [{ ...merged.rules[0], timesTriggered: 6 }];

    const profile = buildRelationshipProfile(input);
    expect(profile.rituals).toHaveLength(1);
    expect(profile.rituals[0].title).toContain('intruder alert');
    expect(profile.rituals[0].signature).toBe(true);
  });

  it('turns repeated NPC encounters into visible social lore', () => {
    const input = base();
    let character = freshCharacter();
    for (let i = 0; i < 6; i++) character = adjustSocialBond(character, 'Biscuit', 'friend', 1, NOW + i);
    for (let i = 0; i < 6; i++) character = adjustSocialBond(character, 'Duke', 'rival', 1, NOW + 20 + i);
    input.character = character;

    const profile = buildRelationshipProfile(input);
    expect(profile.lore.some((lore) => lore.title.includes('Biscuit: best friend'))).toBe(true);
    expect(profile.lore.some((lore) => lore.title.includes('Duke: nemesis'))).toBe(true);
  });

  it('makes treasure hunting part of Barkly identity instead of a disposable minigame', () => {
    const input = base();
    let character = freshCharacter();
    for (let i = 0; i < 5; i++) character = withTreasure(character, `weird rock ${i}`, NOW + i);
    input.character = character;
    input.stashCount = 5;

    const profile = buildRelationshipProfile(input);
    expect(profile.traits.some((trait) => trait.id === 'collector' && trait.score >= 75)).toBe(true);
    expect(profile.lore.some((lore) => lore.kind === 'treasure')).toBe(true);
  });

  it('relationship context is prompt-ready texture, not raw score narration', () => {
    const profile = buildRelationshipProfile(base());
    const lines = describeRelationship(profile).join(' ');
    expect(lines).toContain('Relationship stage: Just Met');
    expect(lines).not.toContain('Emergent traits:');
    expect(lines).toContain('Do not recite scores');
  });
});

describe('a stamp is a receipt, so it has to be earned', () => {
  const DAY = 86_400_000;
  const experience = (at: number) => ({
    id: `e${at}`, what: 'we did a thing', at, importance: 3, lastReferencedAt: at, referenceCount: 0,
  });

  it('does not hand out "Velcro dog" for showing up once', () => {
    // Measured on a real fresh launch: the Pack Book printed "Velcro dog —
    // built by showing up enough that Barkly has decided personal space is
    // mostly theoretical" about four minutes after they met. The score read
    // `affection - 45` and a new Barkly starts at 50, so five points of it
    // were a gift and one feed carried the rest.
    const input = base();
    input.stats = { ...input.stats, affection: 68 };
    input.memory = { ...input.memory, experiences: Array.from({ length: 8 }, (_, i) => experience(NOW + i * 1000)) };
    expect(buildRelationshipProfile(input).traits.map((t) => t.id)).not.toContain('velcro');
  });

  it('gives it to somebody who keeps coming back', () => {
    const input = base();
    input.stats = { ...input.stats, affection: 62 };
    input.memory = { ...input.memory, experiences: [0, 1, 2].map((d) => experience(NOW + d * DAY)) };
    expect(buildRelationshipProfile(input).traits.map((t) => t.id)).toContain('velcro');
  });

  it('counts days, not entries: one long session is one day', () => {
    const input = base();
    input.stats = { ...input.stats, affection: 70 };
    input.memory = {
      ...input.memory,
      experiences: Array.from({ length: 30 }, (_, i) => experience(NOW + i * 60_000)),
    };
    expect(buildRelationshipProfile(input).traits.map((t) => t.id)).not.toContain('velcro');
  });

  it('does not hand out "Actually trained" for the cue the tutorial teaches', () => {
    // The onboarding teaches exactly one cue, and one rule used to score 20 —
    // the emergence threshold — so every player was given the stamp before
    // they had used it once. Its own text says "and turning them into running
    // bits", so a trigger is what carries it.
    const input = base();
    const merged = mergeTrainingRules([], [{ cue: 'pickle', instruction: 'play dead', speech: 'I have tragically passed away.', actions: ['SLEEP' as const] }], NOW);
    input.memory = { ...input.memory, trainingRules: merged.rules };
    expect(buildRelationshipProfile(input).traits.map((t) => t.id)).not.toContain('trainer');
  });
});
