import {
  describeCharacter,
  expireCharacter,
  freshCharacter,
  friendshipStage,
  INITIATIVE_COOLDOWN_MS,
  noteInitiative,
  pickInitiative,
  rivalryStage,
  adjustSocialBond,
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
  rng: () => 0.99,
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

  it('stays quiet during the cooldown', () => {
    const snapshot = freshSnapshot(NOW);
    snapshot.stats.hunger = 95;
    const character = { ...freshCharacter(), lastInitiativeAt: NOW - 1000 };
    expect(pickInitiative(ctx({ snapshot, character }))).toBeNull();

    const later = { ...character, lastInitiativeAt: NOW - INITIATIVE_COOLDOWN_MS - 1 };
    expect(pickInitiative(ctx({ snapshot, character: later }))).not.toBeNull();
  });

  it('says nothing when there is nothing worth saying', () => {
    expect(pickInitiative(ctx())).toBeNull();
  });

  it('avoids repeating the kind he just used', () => {
    const snapshot = freshSnapshot(NOW);
    snapshot.stats.hunger = 85;
    const pref = makeFact({ key: 'favorite_color', value: 'blue' }, NOW - 12 * 3_600_000)!;
    let character = freshCharacter();
    character = noteInitiative(character, 'callback', NOW - INITIATIVE_COOLDOWN_MS - 1);
    const i = pickInitiative(ctx({ snapshot, facts: [pref], character }));
    expect(i?.kind).not.toBe('callback');
  });
});

describe('character continuity', () => {
  it('a new treasure becomes his favorite, obsession and collection history', () => {
    let c = withTreasure(freshCharacter(), 'a rock that looks like a duck', NOW);
    c = withTreasure(c, 'the good stick', NOW + 1);
    expect(c.favoriteTreasure).toBe('the good stick');
    expect(c.obsession?.topic).toBe('the good stick');
    expect(c.treasuresFound).toBe(2);
  });

  it('obsessions and grievances expire but durable social history does not', () => {
    let c = withTreasure(freshCharacter(), 'the good stick', NOW);
    c = withGrievance(c, 'Duke', 'took the ball', NOW);
    const muchLater = NOW + 10 * 86_400_000;
    const expired = expireCharacter(c, muchLater);
    expect(expired.obsession).toBeUndefined();
    expect(expired.grievance).toBeUndefined();
    expect(expired.favoriteTreasure).toBe('the good stick');
    expect(expired.socialBonds?.Duke.encounters).toBe(1);
  });

  it('played-through moments evolve a dog from acquaintance into best friend', () => {
    let c = freshCharacter();
    // adjustSocialBond is the promoting path: an encounter choice, a settled
    // duel — something the player was present for.
    for (let i = 0; i < 6; i++) c = adjustSocialBond(c, 'Biscuit', 'friend', 1, NOW + i);
    c = { ...c, favoriteFriend: 'Biscuit' };
    expect(c.socialBonds?.Biscuit.encounters).toBe(6);
    expect(friendshipStage(6).label).toBe('best friend');
    expect(describeCharacter(c)).toContain('best friend');
  });

  it('played-through bad encounters create an actual nemesis', () => {
    let c = freshCharacter();
    for (let i = 0; i < 6; i++) c = adjustSocialBond(c, 'Duke', 'rival', 1, NOW + i);
    c = { ...c, grievance: { who: 'Duke', what: 'stole the ball', since: NOW } };
    expect(c.socialBonds?.Duke.encounters).toBe(6);
    expect(rivalryStage(6).label).toBe('nemesis');
    expect(describeCharacter(c)).toContain('nemesis');
  });

  it('casual taps alone can never manufacture a nemesis', () => {
    let c = freshCharacter();
    // withGrievance is the casual path — one tap on Duke in the park. Twenty
    // of them must NOT produce a feud; that promotion belongs to a moment the
    // player actually played.
    for (let i = 0; i < 20; i++) c = withGrievance(c, 'Duke', 'stole the ball', NOW + i);
    expect(c.socialBonds?.Duke.encounters).toBe(2); // held one short of rung 2
    expect(rivalryStage(c.socialBonds!.Duke.encounters).label).toBe('annoying dog');
  });

  it('casual friendliness stalls at the edge too, but keeps the history', () => {
    let c = freshCharacter();
    for (let i = 0; i < 20; i++) c = withFriend(c, 'Biscuit', NOW + i);
    expect(c.socialBonds?.Biscuit.encounters).toBe(2);
    expect(c.socialBonds?.Biscuit.firstSeenAt).toBe(NOW);
    expect(c.socialBonds?.Biscuit.lastSeenAt).toBe(NOW + 19);
  });

  it('describes current friend and rival lore for the prompt', () => {
    let c = withGrievance(freshCharacter(), 'Duke', 'hogged the fence', NOW);
    c = withFriend(c, 'Biscuit', NOW + 1);
    const line = describeCharacter(c);
    expect(line).toContain('Duke');
    expect(line).toContain('Biscuit');
  });

  it('an empty character contributes nothing to the prompt', () => {
    expect(describeCharacter(freshCharacter())).toBe('');
  });
});
