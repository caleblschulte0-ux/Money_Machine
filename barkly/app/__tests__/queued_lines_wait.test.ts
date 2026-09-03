/**
 * A queued line never lands on top of an answer.
 *
 * Three things queue a line for Barkly to say on his own initiative: a
 * welcome-back after an absence, a level-up, and a finished plan. The effect
 * that spoke them fired the instant the line was SET, and `speak` is the one
 * speaking lifecycle — a second call pre-empts the first. So earning a level
 * by answering a question replaced the answer:
 *
 *     you: "do you like the park?"
 *     him: "Green collar is in the shop now."
 *
 * Worse, that sentence was also the reward card's text, already on screen. The
 * shop was reading itself aloud in the dog's voice, over his actual reply.
 *
 * Two rules, checked here because neither is visible in a rendered frame:
 *   1. the queue drains only when he is free, and it is not DROPPED meanwhile;
 *   2. what he says on levelling up is his reaction, never the unlock text.
 */

declare const require: (m: string) => any;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('path') as { join: (...p: string[]) => string };

import { levelUpLine, unlockedAt } from '../src/game/progression';

const hook = readFileSync(join(__dirname, '..', 'src', 'hooks', 'useBarkly.ts'), 'utf8');

/** The effect that drains the queue. */
const drain = (() => {
  const at = hook.indexOf('if (!pendingGreeting) return;');
  expect(at).toBeGreaterThan(-1);
  return hook.slice(at, hook.indexOf('}, [', at) + 40);
})();

/**
 * The definition of "he is free" — the one shared conversation lock. The
 * drain used to check its own subset (busy + speaking), which is how a
 * level-up earned by greeting a dog landed while the NPC's bubble was still
 * up and REPLACED the conclusion of that conversation.
 */
const lock = (() => {
  const at = hook.indexOf('const conversationHeld =');
  expect(at).toBeGreaterThan(-1);
  return hook.slice(at, hook.indexOf(';', at));
})();

describe('a queued line waits its turn', () => {
  it('does not speak while a conversation holds the floor', () => {
    expect(drain).toMatch(/if \(conversationHeld\) return;/);
  });

  it('the lock covers the WHOLE conversation, not just his half', () => {
    // Each of these was a hole the operator hit live: the NPC bubble is the
    // other dog's closing line (a level-up used to talk over it); an open
    // encounter or duel is a story scene mid-beat. `busy` alone was the old,
    // failing order — these assertions fail against it.
    expect(lock).toMatch(/busy/);
    expect(lock).toMatch(/npcBubble/);
    expect(lock).toMatch(/activeEncounter/);
    expect(lock).toMatch(/pendingContest/);
    expect(lock).toMatch(/isBusy\(snapshot.state\)/);
  });

  it('ambient thoughts respect the same lock — story scenes are not interrupted', () => {
    // The thought timer used to consult only his BODY state, which reads
    // 'idle' while an encounter sheet is open — so idle thoughts popped over
    // story scenes. It must consult the shared lock, and via the ref, since
    // the timer outlives renders.
    // Matched on the CALL, not on its formatting. This assertion used to be
    // `indexOf('setThought(bronx(pickThought')` and broke the day the call
    // was wrapped across lines to take another argument -- the contract
    // (thoughts are behind the shared lock) had not changed at all. A test
    // that fails on a line break is testing the formatter.
    const at = hook.search(/setThought\(\s*\n?\s*bronx\(\s*\n?\s*pickThought/);
    expect(at).toBeGreaterThan(-1);
    const guard = hook.slice(hook.lastIndexOf('if (', at), at);
    expect(guard).toMatch(/conversationHeldRef.current/);
  });

  it('unprompted initiatives respect it too', () => {
    const at = hook.indexOf('pickInitiative({');
    expect(at).toBeGreaterThan(-1);
    const before = hook.slice(at - 600, at);
    expect(before).toMatch(/conversationHeldRef.current/);
  });

  it('pauses after he is free, so the reply can be read first', () => {
    // Draining the instant the turn ended still overwrote the answer in the
    // panel a few hundred ms later. The queued line gets a beat.
    expect(drain).toMatch(/setTimeout\(/);
    // ...and the timer is cleaned up, or a re-render leaves two racing.
    expect(drain).toMatch(/clearTimeout\(/);
  });

  it('re-runs when the conversation lets go, so the line is not lost', () => {
    // `pendingGreeting` is left SET when it bails, and the lock is a
    // dependency — that pair is what makes it a queue rather than a dropped
    // message.
    const deps = drain.slice(drain.lastIndexOf('}, ['));
    expect(deps).toMatch(/conversationHeld/);
    // The bail-out must come BEFORE the clear, or the line is thrown away.
    // Asserting the index is >= 0 first: `-1 < anything` passes vacuously when
    // the guard is missing entirely, which is exactly the regression.
    const guard = drain.indexOf('if (conversationHeld');
    const clear = drain.indexOf('setPendingGreeting(null)');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(clear).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(clear);
  });
});

describe('levelling up is a reaction, not an advert', () => {
  it('what he says is never the unlock notice text', () => {
    for (let level = 1; level <= 10; level += 1) {
      const spoken = levelUpLine(level);
      for (const unlock of unlockedAt(level)) {
        expect(spoken).not.toBe(unlock.line);
      }
      expect(spoken).not.toMatch(/in the shop now/);
    }
  });

  it('he has more than one thing to say about it', () => {
    const lines = new Set(Array.from({ length: 10 }, (_, i) => levelUpLine(i + 1)));
    expect(lines.size).toBeGreaterThan(2);
  });
});
