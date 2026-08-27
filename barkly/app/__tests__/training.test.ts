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
