import { emptyMemory } from '../src/barkley/memory';
import { buildSystemPrompt, parseReply } from '../src/barkley/prompts';
import { freshSnapshot } from '../src/barkley/state';

describe('buildSystemPrompt', () => {
  it('includes identity, mood, and memories', () => {
    const prompt = buildSystemPrompt({
      snapshot: freshSnapshot(0),
      memory: {
        ...emptyMemory(),
        userFacts: ["Your person's name is Caleb."],
        barkleyMemories: ['Caleb promised to play yesterday.'],
        sessionSummary: 'Person: talked about school',
      },
    });
    expect(prompt).toContain('You are Barkley');
    expect(prompt).toContain('appropriate for children');
    expect(prompt).toContain('Right now you are');
    expect(prompt).toContain("Your person's name is Caleb.");
    expect(prompt).toContain('Caleb promised to play yesterday.');
    expect(prompt).toContain('talked about school');
  });

  it('reflects hunger in the mood line', () => {
    const snapshot = freshSnapshot(0);
    snapshot.stats.hunger = 90;
    const prompt = buildSystemPrompt({ snapshot, memory: emptyMemory() });
    expect(prompt).toContain('hungry');
  });
});

describe('parseReply', () => {
  it('parses the full JSON contract', () => {
    const reply = parseReply(JSON.stringify({
      speech: 'You said we would play yesterday. I remember things, dude.',
      reaction: 'annoyed',
      actions: ['HEAD_TILT', 'LOOK_LEFT'],
      remember: { user_facts: ['Caleb has a soccer game Friday.'], barkley_memories: ['We joked about the mailman again.'] },
    }));
    expect(reply.speech).toContain('I remember things');
    expect(reply.reaction).toBe('annoyed');
    expect(reply.actions).toEqual(['HEAD_TILT', 'LOOK_LEFT']);
    expect(reply.newUserFacts).toHaveLength(1);
    expect(reply.newBarkleyMemories).toHaveLength(1);
  });

  it('handles JSON wrapped in a markdown fence', () => {
    const reply = parseReply('```json\n{"speech": "Hey.", "actions": ["TAIL_WAG"]}\n```');
    expect(reply.speech).toBe('Hey.');
    expect(reply.actions).toEqual(['TAIL_WAG']);
  });

  it('falls back to treating plain prose as speech (never fails the turn)', () => {
    const reply = parseReply('Hey. I chewed a sock. No regrets.');
    expect(reply.speech).toBe('Hey. I chewed a sock. No regrets.');
    expect(reply.actions).toEqual([]);
  });

  it('drops invalid reactions and unknown actions', () => {
    const reply = parseReply(JSON.stringify({
      speech: 'ok',
      reaction: 'ROCKET_LAUNCH',
      actions: ['TAIL_WAG', 'BACKFLIP', 42],
    }));
    expect(reply.reaction).toBeUndefined();
    expect(reply.actions).toEqual(['TAIL_WAG']);
  });

  it('handles braces inside speech strings', () => {
    const reply = parseReply('{"speech": "I made a face like this: :} and it was great", "actions": []}');
    expect(reply.speech).toContain(':}');
  });
});
