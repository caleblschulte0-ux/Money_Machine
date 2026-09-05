import { DialogueEngine } from '../src/barkly/dialogue';
import { BarklyMemory } from '../src/barkly/memory';
import { freshSnapshot } from '../src/barkly/state';
import {
  looksLikeTrainingInstruction,
  matchTrainingRule,
  mergeTrainingRules,
  normalizeCue,
  parseLocalTrainingInstruction,
} from '../src/barkly/training';
import { createScriptedDialogue } from '../src/providers/dialogue/scripted';
import { createInMemoryStore } from '../src/storage/inMemoryStore';

const candidate = (cue: string, instruction: string, speech = 'Got it.') => ({
  cue,
  instruction,
  speech,
  reaction: 'excited' as const,
  actions: ['EXCITED' as const],
});

describe('Barkly training', () => {
  it('only treats explicit teaching language as a training moment', () => {
    expect(looksLikeTrainingInstruction('When I say intruder alert, act terrified.')).toBe(true);
    expect(looksLikeTrainingInstruction('Learn this routine: when I say showtime, spin then sit.')).toBe(true);
    expect(looksLikeTrainingInstruction('What is an intruder alert?')).toBe(false);
    expect(looksLikeTrainingInstruction('Tell me something funny.')).toBe(false);
  });

  it('understands one-beat tricks locally', () => {
    const local = parseLocalTrainingInstruction('When I say intruder alert, act terrified.');
    expect(local?.cue).toBe('intruder alert');
    expect(local?.actions).toEqual(['LOOK_LEFT', 'LOOK_RIGHT', 'EAR_PERK']);
    expect(local?.routine).toBeUndefined();
    expect(parseLocalTrainingInstruction('When I say homework, solve my maths.')).toBeNull();
  });

  it('turns explicit choreography into an ordered routine', () => {
    const local = parseLocalTrainingInstruction(
      'When I say showtime, spin, sit, then play dead.',
    );
    expect(local?.cue).toBe('showtime');
    expect(local?.routine).toHaveLength(3);
    expect(local?.routine?.map((beat) => beat.actions)).toEqual([
      ['EXCITED', 'TAIL_WAG'],
      ['SIT'],
      ['SLEEP'],
    ]);
  });

  it('refuses a whole routine if one beat is not representable', () => {
    expect(parseLocalTrainingInstruction('When I say genius, spin, solve my maths, then sit.')).toBeNull();
  });

  it('normalizes punctuation without making substring matches', () => {
    expect(normalizeCue(' “Intruder Alert!” ')).toBe('intruder alert');
    const merged = mergeTrainingRules([], [candidate('sit', 'sit down')], 100);
    expect(matchTrainingRule(merged.rules, 'sit please')?.cue).toBe('sit');
    expect(matchTrainingRule(merged.rules, 'what a situation')).toBeUndefined();
  });

  it('reteaching the same cue updates one rule instead of duplicating it', () => {
    const first = mergeTrainingRules([], [candidate('intruder alert', 'spin around', 'OH NO.')], 100);
    const second = mergeTrainingRules(
      first.rules,
      [candidate('Intruder Alert!', 'play dead', 'I am definitely asleep.')],
      200,
    );
    expect(second.rules).toHaveLength(1);
    expect(second.rules[0].instruction).toBe('play dead');
    expect(second.rules[0].speech).toBe('I am definitely asleep.');
    expect(second.rules[0].learnedAt).toBe(100);
    expect(second.updated).toEqual([first.rules[0].id]);
  });

  it('prefers the longest deliberately taught cue', () => {
    const merged = mergeTrainingRules(
      [],
      [candidate('intruder alert', 'panic'), candidate('intruder alert red', 'hide')],
      100,
    );
    expect(matchTrainingRule(merged.rules, 'intruder alert red now')?.instruction).toBe('hide');
  });

  it('persists rules and lets Settings deletion remove one without wiping memory', async () => {
    const store = createInMemoryStore();
    const first = new BarklyMemory(store, 'default', () => 100);
    await first.load();
    await first.remember(['name = Caleb'], []);
    await first.learnTraining([candidate('freeze', 'stand very still', '...')]);

    const second = new BarklyMemory(store, 'default', () => 200);
    const state = await second.load();
    expect(state.trainingRules).toHaveLength(1);
    expect(second.getFact('name')?.value).toBe('Caleb');

    await second.forgetFact(state.trainingRules[0].id);
    expect(second.snapshot().trainingRules).toHaveLength(0);
    expect(second.getFact('name')?.value).toBe('Caleb');
  });

  it('executes an already learned cue without calling the model again', async () => {
    const store = createInMemoryStore();
    const memory = new BarklyMemory(store, 'default', () => 100);
    await memory.load();
    await memory.learnTraining([
      candidate('intruder alert', 'act alarmed', 'INTRUDER. I was not prepared for this.'),
    ]);

    let calls = 0;
    const provider = {
      name: 'should-not-run',
      isAvailable: () => true,
      complete: async () => {
        calls += 1;
        return '{"speech":"wrong","actions":[],"remember":{"facts":[],"experiences":[]},"teach":[]}';
      },
    };

    const engine = new DialogueEngine(provider, memory);
    const result = await engine.converse('Barkly, intruder alert!', freshSnapshot(100));
    expect(calls).toBe(0);
    expect(result.reply.speech).toBe('INTRUDER. I was not prepared for this.');
    expect(memory.snapshot().trainingRules[0].timesTriggered).toBe(1);
  });

  it('can teach and trigger a simple physical trick with zero model calls', async () => {
    const memory = new BarklyMemory(createInMemoryStore(), 'default', () => 100);
    await memory.load();
    let calls = 0;
    const provider = {
      name: 'offline-proof',
      isAvailable: () => true,
      complete: async () => {
        calls += 1;
        return '{"speech":"provider should not be needed","actions":[]}';
      },
    };
    const engine = new DialogueEngine(provider, memory);

    const taught = await engine.converse('When I say intruder alert, act terrified.', freshSnapshot(100));
    expect(calls).toBe(0);
    expect(taught.reply.speech).toContain('intruder alert');
    expect(memory.snapshot().trainingRules).toHaveLength(1);

    const triggered = await engine.converse('intruder alert', freshSnapshot(200));
    expect(calls).toBe(0);
    expect(triggered.reply.actions).toEqual(['LOOK_LEFT', 'LOOK_RIGHT', 'EAR_PERK']);
    expect(memory.snapshot().trainingRules[0].timesTriggered).toBe(1);
  });

  it('learns and later returns the exact ordered routine without the model', async () => {
    const memory = new BarklyMemory(createInMemoryStore(), 'default', () => 100);
    await memory.load();
    let calls = 0;
    const provider = {
      name: 'offline-routine-proof',
      isAvailable: () => true,
      complete: async () => {
        calls += 1;
        return '{"speech":"provider should not be needed","actions":[]}';
      },
    };
    const engine = new DialogueEngine(provider, memory);

    const taught = await engine.converse(
      'When I say showtime, spin, sit, then play dead.',
      freshSnapshot(100),
    );
    expect(calls).toBe(0);
    expect(taught.reply.speech).toMatch(/whole routine/i);
    expect(memory.snapshot().trainingRules[0].routine).toHaveLength(3);

    const triggered = await engine.converse('okay Barkly, showtime!', freshSnapshot(200));
    expect(calls).toBe(0);
    expect(triggered.reply.routine?.map((beat) => beat.actions)).toEqual([
      ['EXCITED', 'TAIL_WAG'],
      ['SIT'],
      ['SLEEP'],
    ]);
    expect(memory.snapshot().trainingRules[0].timesTriggered).toBe(1);
  });
});

/*
 * HOW A CHILD ACTUALLY TYPES.
 *
 * The parser demanded a comma or the word "then" as the boundary between the
 * cue and the trick, so the flagship feature of this app failed on the phrasing
 * a seven-year-old is most likely to produce. Measured across twenty realistic
 * sentences, every comma-less one was refused -- and the app's own hint tells
 * you to write one WITH a comma, which a child on a phone will not do.
 */
describe('teaching without punctuation', () => {
  const cueOf = (text: string) => parseLocalTrainingInstruction(text)?.cue ?? null;

  it('learns the same trick with or without the comma', () => {
    for (const [withComma, without] of [
      ['when I say spin, you spin around', 'when i say spin you spin around'],
      ['when I say bedtime, play dead', 'when i say bedtime play dead'],
      ['if I say freeze, sit down', 'if i say freeze sit down'],
      ['whenever I say up, you jump', 'whenever i say up you jump'],
      ['when you hear me say hello, wag your tail', 'when you hear me say hello wag your tail'],
      ['when I say goodnight, go to sleep', 'when i say goodnight you go to sleep'],
    ]) {
      const a = parseLocalTrainingInstruction(withComma);
      const b = parseLocalTrainingInstruction(without);
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(b!.cue).toBe(a!.cue);
      expect(b!.actions).toEqual(a!.actions);
    }
  });

  it('finds the end of a multi-word cue instead of taking the first word', () => {
    // The remainder has to BEGIN with something he can perform, or it is not a
    // split. Searching loosely would cut "good boy sit down" at "good",
    // because "boy sit down" contains "sit" somewhere inside it.
    expect(cueOf('when I say good boy sit down')).toBe('good boy');
    expect(cueOf('when i say the magic word you play dead')).toBe('the magic word');
    expect(cueOf('when i say dinner time you spin and then sit')).toBe('dinner time');
  });

  it('does not let a "then" inside the routine eat the cue', () => {
    // "then" used to be a top-level separator, so this split at the FIRST one:
    // cue "showtime you spin", and a two-beat routine out of three.
    const rule = parseLocalTrainingInstruction('when i say showtime you spin then sit then play dead');
    expect(rule?.cue).toBe('showtime');
    expect(rule?.routine).toHaveLength(3);
    // Identical to the punctuated form, which always worked.
    expect(rule?.routine).toEqual(
      parseLocalTrainingInstruction('when I say showtime, spin then sit then play dead')?.routine,
    );
  });

  it('still refuses what he genuinely cannot perform', () => {
    // The contract is unchanged: never pretend to have learned a move that has
    // no performance behind it. There is no roll-over animation.
    expect(parseLocalTrainingInstruction('when i say roll over roll over')).toBeNull();
    expect(parseLocalTrainingInstruction('when i say hush you do nothing')).toBeNull();
    expect(parseLocalTrainingInstruction('when i say hello')).toBeNull();
  });

  it('says so out loud when a teach does not land', async () => {
    /*
     * Reaching the provider at all is the proof it failed: the engine learns a
     * parseable rule and returns before any provider call. Before this the miss
     * fell through to the composer, which answered about a word out of the
     * middle of the sentence -- "Around. Interesting. I've got my eye on
     * around." A published web build has no model behind it to catch that.
     */
    const memory = new BarklyMemory(createInMemoryStore(), 'default', () => 100);
    await memory.load();
    const engine = new DialogueEngine(createScriptedDialogue(), memory);
    const result = await engine.converse('when i say roll over roll over', freshSnapshot(100));
    expect(result.reply.speech).toMatch(/sit|spin|wag|play dead/i);
    expect(memory.snapshot().trainingRules).toHaveLength(0);
  });

  it('and learns it, silently and correctly, when it does', async () => {
    const memory = new BarklyMemory(createInMemoryStore(), 'default', () => 100);
    await memory.load();
    const engine = new DialogueEngine(createScriptedDialogue(), memory);
    await engine.converse('when i say bedtime play dead', freshSnapshot(100));
    const rules = memory.snapshot().trainingRules;
    expect(rules).toHaveLength(1);
    expect(rules[0].cue).toBe('bedtime');
    // ...and the cue fires afterwards, with no provider involved.
    const fired = await engine.converse('bedtime', freshSnapshot(100));
    expect(fired.reply.actions).toContain('SLEEP');
  });
});