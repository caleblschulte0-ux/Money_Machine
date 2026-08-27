import { adjustSocialBond, freshCharacter, withFriend } from '../src/barkly/character';
import { emptyMemory } from '../src/barkly/memory';
import { buildSystemPrompt, parseReply } from '../src/barkly/prompts';
import { freshSnapshot } from '../src/barkly/state';

describe('buildSystemPrompt', () => {
  it('includes identity, mood, memories, and relationship identity', () => {
    const prompt = buildSystemPrompt({
      snapshot: freshSnapshot(0),
      memory: {
        ...emptyMemory(),
        userFacts: ["Your person's name is Caleb."],
        barklyMemories: ['Caleb promised to play yesterday.'],
        sessionSummary: 'Person: talked about school',
      },
    });
    expect(prompt).toContain('You are Barkly');
    expect(prompt).toContain('appropriate for children');
    expect(prompt).toContain('Right now you are');
    expect(prompt).toContain("Your person's name is Caleb.");
    expect(prompt).toContain('Caleb promised to play yesterday.');
    expect(prompt).toContain('talked about school');
    expect(prompt).toContain('Relationship stage: Just Met');
    expect(prompt).toContain('Fresh Pack');
  });

  it('feeds evolved recurring-dog lore into the conversation texture', () => {
    let character = freshCharacter();
    for (let i = 0; i < 6; i++) character = adjustSocialBond(character, 'Biscuit', 'friend', 1, i);
    character = withFriend(character, 'Biscuit', 6);
    const prompt = buildSystemPrompt({
      snapshot: freshSnapshot(10),
      memory: emptyMemory(),
      character,
    });
    expect(prompt).toContain('Biscuit');
    expect(prompt).toContain('best friend');
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
      remember: { user_facts: ['Caleb has a soccer game Friday.'], barkly_memories: ['We joked about the mailman again.'] },
    }));
    expect(reply.speech).toContain('I remember things');
    expect(reply.reaction).toBe('annoyed');
    expect(reply.actions).toEqual(['HEAD_TILT', 'LOOK_LEFT']);
    expect(reply.newUserFacts).toHaveLength(1);
    expect(reply.newBarklyMemories).toHaveLength(1);
  });

  it('parses an ordered model-taught routine', () => {
    const reply = parseReply(JSON.stringify({
      speech: 'I learned showtime.',
      actions: ['EAR_PERK'],
      teach: [{
        cue: 'showtime',
        instruction: 'spin then sit then play dead',
        speech: 'Showtime.',
        actions: ['EXCITED'],
        routine: [
          { speech: 'Spin.', reaction: 'excited', actions: ['EXCITED', 'TAIL_WAG'] },
          { speech: 'Sit.', actions: ['SIT'] },
          { speech: 'Gone.', reaction: 'sleepy', actions: ['SLEEP'] },
        ],
      }],
    }));
    expect(reply.learnedTraining).toHaveLength(1);
    expect(reply.learnedTraining?.[0].routine?.map((beat) => beat.actions)).toEqual([
      ['EXCITED', 'TAIL_WAG'],
      ['SIT'],
      ['SLEEP'],
    ]);
  });

  it('drops invalid routine beats rather than inventing choreography', () => {
    const reply = parseReply(JSON.stringify({
      speech: 'Okay.',
      teach: [{
        cue: 'broken',
        instruction: 'do impossible stuff then sit',
        speech: 'Broken.',
        actions: ['SIT'],
        routine: [
          { speech: 'Nope.', actions: ['BACKFLIP'] },
          { speech: 'Sit.', actions: ['SIT'] },
        ],
      }],
    }));
    expect(reply.learnedTraining?.[0].routine).toBeUndefined();
  });

  it('handles JSON wrapped in a markdown fence', () => {
    const reply = parseReply('```json\n{"speech": "Hey.", "actions": ["TAIL_WAG"]}\n```');
    expect(reply.speech).toBe('Hey.');
    expect(reply.actions).toEqual(['TAIL_WAG']);
  });

  it('falls back to treating plain prose as speech', () => {
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
