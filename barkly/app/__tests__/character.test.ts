import {
  describeCharacter,
  expireCharacter,
  freshCharacter,
  INITIATIVE_COOLDOWN_MS,
  noteInitiative,
  pickInitiative,
  withFriend,
  withGrievance,
  withTreasure,
} from '../src/barkly/character';
import { makeExperience, makeFact } from '../src/barkly/facts';
import { freshSnapshot } from '../src/barkly/state';

const NOW = 1_000_000_000_000;

const ctx = (over: Partial<Parameters<typeof pickInitiative>[0]> = {}) => ({
  snapshot: freshSnapshot(NOW),
  facts: [],
  experiences: [],
  openThreads: [],
  character: freshCharacter(),
  location: 'Home',
  npcsPresent: [] as string[],
  now: NOW,
  rng: () => 0.99, // suppress the random-gated candidates unless a test wants them
  ...over,
});

describe('Barkly starts conversations himself', () => {
  it('raises an unkept promise above everything else', () => {
    const promise = makeExperience("Your person said: I'll play with you tomorrow", NOW - 2 * 86_400_000)!;
    const i = pickInitiative(ctx({ experiences: [promise] }));
    expect(i?.kind).toBe('promise');
    expect(i?.line).toMatch(/remember things/i);
  });

  it('uses his person by name when he knows it', () => {
    const name = makeFact({ key: 'name', value: 'Caleb' }, NOW)!;
    const promise = makeExperience("Your person said: we'll play later", NOW - 86_400_000)!;
    const i = pickInitiative(ctx({ facts: [name], experiences: [promise] }));
    expect(i?.line).toContain('Caleb');
  });

  it('mentions being hungry when he actually is', () => {
    const snapshot = freshSnapshot(NOW);
    snapshot.stats.hunger = 85;
    const i = pickInitiative(ctx({ snapshot }));
    expect(i?.kind).toBe('hungry');
  });

  it('calls back to something he was told hours ago', () => {
    const pref = makeFact({ key: 'favorite_car', value: 'the blue one' }, NOW - 12 * 3_600_000)!;
    const i = pickInitiative(ctx({ facts: [pref] }));
    expect(i?.kind).toBe('callback');
    expect(i?.line).toContain('the blue one');
  });

  it('brings up a grievance with his rival', () => {
    const character = withGrievance(freshCharacter(), 'Duke', 'was being insufferable', NOW);
    const i = pickInitiative(ctx({ character }));
    expect(i?.kind).toBe('grievance');
    expect(i?.line).toContain('Duke');
  });

  it('stays quiet during the cooldown — he is a dog, not a notification', () => {
    const snapshot = freshSnapshot(NOW);
    snapshot.stats.hunger = 95;
    const character = { ...freshCharacter(), lastInitiativeAt: NOW - 1000 };
    expect(pickInitiative(ctx({ snapshot, character }))).toBeNull();

    const later = { ...character, lastInitiativeAt: NOW - INITIATIVE_COOLDOWN_MS - 1 };
    expect(pickInitiative(ctx({ snapshot, character: later }))).not.toBeNull();
  });

  it('says nothing at all when there is nothing worth saying', () => {
    expect(pickInitiative(ctx())).toBeNull();
  });

  it('avoids repeating the kind he just used', () => {
    const snapshot = freshSnapshot(NOW);
    snapshot.stats.hunger = 85; // hungry candidate
    const pref = makeFact({ key: 'favorite_color', value: 'blue' }, NOW - 12 * 3_600_000)!;
    let character = freshCharacter();
    character = noteInitiative(character, 'callback', NOW - INITIATIVE_COOLDOWN_MS - 1);
    const i = pickInitiative(ctx({ snapshot, facts: [pref], character }));
    expect(i?.kind).not.toBe('callback');
  });
});

describe('character continuity', () => {
  it('a new treasure becomes his favorite and his obsession', () => {
    const c = withTreasure(freshCharacter(), 'a rock that looks like a duck', NOW);
    expect(c.favoriteTreasure).toContain('duck');
    expect(c.obsession?.topic).toContain('duck');
    expect(describeCharacter(c)).toContain('duck');
  });

  it('obsessions and grievances expire on their own', () => {
    let c = withTreasure(freshCharacter(), 'the good stick', NOW);
    c = withGrievance(c, 'Duke', 'took the ball', NOW);
    const muchLater = NOW + 10 * 86_400_000;
    const expired = expireCharacter(c, muchLater);
    expect(expired.obsession).toBeUndefined();
    expect(expired.grievance).toBeUndefined();
    // A favorite possession is not a passing mood — it stays.
    expect(expired.favoriteTreasure).toBe('the good stick');
  });

  it('describes who he currently is for the prompt', () => {
    const c = withFriend(withGrievance(freshCharacter(), 'Duke', 'hogged the fence', NOW), 'Biscuit');
    const line = describeCharacter(c);
    expect(line).toContain('Duke');
    expect(line).toContain('Biscuit');
  });

  it('an empty character contributes nothing to the prompt', () => {
    expect(describeCharacter(freshCharacter())).toBe('');
  });
});
