import { freshCharacter } from '../src/barkly/character';
import { emptyMemory } from '../src/barkly/memory';
import { advanceStory, freshStoryState, storyPromptTexture, syncStoryState } from '../src/barkly/storyV2';

const NOW = 1_000_000;

function dukeTreasureLife() {
  const character = freshCharacter();
  character.favoriteTreasure = 'duck rock';
  character.treasureAffinities = { 'duck rock': { score: 7, discoveries: 1, firstSeenAt: 1, lastSeenAt: 2 } };
  character.socialBonds = { Duke: { kind: 'rival', encounters: 7, firstSeenAt: 1, lastSeenAt: 2 } };
  return character;
}

describe('Story Engine v2', () => {
  test('earned history starts a persistent saga', () => {
    const state = syncStoryState(freshStoryState(), { character: dukeTreasureLife(), memory: emptyMemory(), now: NOW });
    expect(state.active?.title).toMatch(/Duke/i);
    expect(state.active?.chapters).toHaveLength(1);
    expect(state.active?.choices.map((c) => c.id)).toContain('end-the-beef');
  });

  test('a player choice changes the route and creates a chapter', () => {
    const started = syncStoryState(freshStoryState(), { character: dukeTreasureLife(), memory: emptyMemory(), now: NOW });
    const result = advanceStory(started, 'guard-it', NOW + 1)!;
    expect(result.story.route).toBe('protected');
    expect(result.story.chapters).toHaveLength(2);
    expect(result.story.chapters[1].consequence).toMatch(/possession over peace/i);
    expect(result.state.active?.choices.some((c) => c.id === 'guard-it')).toBe(false);
  });

  test('a finale archives the saga and it does not instantly respawn', () => {
    const character = dukeTreasureLife();
    const memory = emptyMemory();
    const started = syncStoryState(freshStoryState(), { character, memory, now: NOW });
    const ended = advanceStory(started, 'end-the-beef', NOW + 1)!.state;
    expect(ended.active).toBeUndefined();
    expect(ended.archive[0].status).toBe('resolved');
    expect(ended.archive[0].route).toBe('reconciled');
    const resynced = syncStoryState(ended, { character, memory, now: NOW + 2 });
    expect(resynced.active).toBeUndefined();
    expect(resynced.archive).toHaveLength(1);
  });

  test('resolved decisions become promptable history, not forgotten UI state', () => {
    const character = dukeTreasureLife();
    const started = syncStoryState(freshStoryState(), { character, memory: emptyMemory(), now: NOW });
    const ended = advanceStory(started, 'end-the-beef', NOW + 1)!.state;
    expect(storyPromptTexture(ended).join(' ')).toMatch(/do not restart/i);
    expect(storyPromptTexture(ended).join(' ')).toMatch(/reconciled/i);
  });
});

/*
 * How the ledger READS, which is the half a player sees. Found by running a
 * saga end to end and looking at the output rather than at the code.
 */
describe('a saga a player can follow', () => {
  const NOW = 1_700_000_000_000;
  const character: any = {
    ...freshCharacter(),
    favoriteTreasure: 'a rock that looks like a duck',
    socialBonds: { duke: { kind: 'rival', encounters: 5, warmth: 0, firstMetAt: 1, lastSeenAt: 2 } },
  };
  const start = () => syncStoryState(freshStoryState(), { character, memory: emptyMemory(), now: NOW });

  it('names later chapters after the decision, not after a number', () => {
    // The opening chapter's title is authored by the arc and carries its own
    // heading ("Chapter II . Bad Vibes Around the Treasure"), so numbering the
    // next one produced "Chapter 2" directly under it: two chapters both
    // claiming to be the second, one written and one counted.
    const first = start();
    const after = advanceStory(first, 'guard-it', NOW + 1000)!;
    const titles = after.story.chapters.map((c) => c.title);
    expect(titles[1]).toBe('Guard the treasure');
    expect(titles[1]).not.toMatch(/^Chapter \d/);
    const done = advanceStory(after.state, 'end-the-beef', NOW + 2000)!;
    expect(done.story.chapters[2].title).toBe('Finale \u00b7 Try to end the beef');
  });

  it('does not double the full stop when it recalls how a saga ended', () => {
    const first = start();
    const done = advanceStory(first, 'end-the-beef', NOW + 1000)!;
    const texture = storyPromptTexture(done.state).join('\n');
    expect(texture).toContain('do not restart it');
    expect(texture).not.toMatch(/\.\./);
  });

  it('keeps the chapters already written when history intensifies', () => {
    // The whole reason the ledger exists: a rivalry deepening must not reset
    // the saga to Chapter I and throw away the decision you made in it.
    const first = start();
    const after = advanceStory(first, 'guard-it', NOW + 1000)!;
    const hotter: any = {
      ...character,
      socialBonds: { duke: { kind: 'rival', encounters: 14, warmth: 0, firstMetAt: 1, lastSeenAt: 2 } },
    };
    const synced = syncStoryState(after.state, { character: hotter, memory: emptyMemory(), now: NOW + 2000 });
    expect(synced.active?.chapters).toHaveLength(2);
    expect(synced.active?.chapters[1].title).toBe('Guard the treasure');
    expect(synced.active?.intensity).toBe(4);
    expect(synced.active?.route).toBe('protected');
  });
});
