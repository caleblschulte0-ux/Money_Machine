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
