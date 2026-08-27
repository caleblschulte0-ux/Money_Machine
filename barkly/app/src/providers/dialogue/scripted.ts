/**
 * Offline scripted dialogue — the zero-credential fallback.
 *
 * Exists so the whole vertical slice (talk → listen → think → speak → animate
 * → remember) runs with no API key at all. It is deliberately shallow: enough
 * in-character variety to exercise the loop, plus a tiny "my name is …"
 * extractor to prove the memory path. It is NOT the product; the Anthropic
 * adapter is.
 */

import { DialogueProvider, DialogueRequest } from '../types';

interface Scripted {
  match: RegExp;
  replies: Array<{ speech: string; reaction?: string; actions?: string[] }>;
}

const SCRIPTS: Scripted[] = [
  {
    match: /\b(hi|hello|hey|yo|sup)\b/i,
    replies: [
      { speech: "Oh. It's you. I mean — hey! Took you long enough.", reaction: 'happy', actions: ['TAIL_WAG'] },
      { speech: "Hey. I was busy staring at the wall, but you're more interesting. Barely.", reaction: 'happy', actions: ['HEAD_TILT'] },
    ],
  },
  {
    match: /\b(food|treat|hungry|eat|snack|dinner)\b/i,
    replies: [
      { speech: "Did you say treat? I heard treat. This conversation just got important.", reaction: 'excited', actions: ['EXCITED', 'TAIL_WAG'] },
      { speech: "I'm listening. Especially if this ends with food.", reaction: 'hungry', actions: ['HEAD_TILT'] },
    ],
  },
  {
    match: /\b(good (boy|dog)|love you|best)\b/i,
    replies: [
      { speech: "I know. But say it again, I wasn't ready.", reaction: 'happy', actions: ['TAIL_WAG', 'EAR_PERK'] },
    ],
  },
  {
    match: /\b(play|ball|fetch|game)\b/i,
    replies: [
      { speech: "Fetch? Throw it. Throw it right now. Why are you still talking?", reaction: 'excited', actions: ['EXCITED', 'TAIL_WAG'] },
      // `playing` is an app-owned activity state, not a model reaction. Keep
      // the offline provider on the same contract as the live model.
      { speech: "Hm. I'll play, but only because you asked. Not because I'm desperate. Throw the ball.", reaction: 'excited', actions: ['TAIL_WAG'] },
    ],
  },
  {
    match: /\b(cat|another dog|other pet)\b/i,
    replies: [
      { speech: "A cat? In OUR house? We need to talk about your choices.", reaction: 'annoyed', actions: ['LOOK_LEFT', 'HEAD_TILT'] },
    ],
  },
  {
    match: /\b(sleep|tired|bed|nap)\b/i,
    replies: [
      { speech: "Now you're speaking my language. Wake me if there's cheese.", reaction: 'sleepy', actions: ['SLEEP'] },
    ],
  },
];

const GENERIC: Array<{ speech: string; reaction?: string; actions?: string[] }> = [
  { speech: "Huh. Interesting. Well — interesting for a human thing.", actions: ['HEAD_TILT'] },
  { speech: "I was going to say something smart, but I saw a bird earlier and it's still on my mind.", actions: ['LOOK_LEFT', 'LOOK_RIGHT'] },
  { speech: "Sure. I mean, probably. Tell me more, I'm like forty percent listening.", actions: ['EAR_PERK'] },
  { speech: "That's a lot of words. None of them were 'treat', I noticed.", reaction: 'annoyed', actions: ['HEAD_TILT'] },
];

const NAME_RE = /\b(?:my name(?:'s| is)|i(?:'m| am) called|call me)\s+([A-Z][a-zA-Z]{1,20})/i;

export function createScriptedDialogue(): DialogueProvider {
  let counter = 0;
  return {
    name: 'scripted-offline',
    isAvailable: () => true,

    async complete(req: DialogueRequest): Promise<string> {
      counter += 1;
      const userFacts: string[] = [];
      const nameMatch = req.userText.match(NAME_RE);
      let prefix = '';
      if (nameMatch) {
        const name = nameMatch[1];
        userFacts.push(`Your person's name is ${name}.`);
        prefix = `${name}, huh. Good name. Mine's better, but good. `;
      }

      const script = SCRIPTS.find((s) => s.match.test(req.userText));
      const pool = script ? script.replies : GENERIC;
      const pick = pool[counter % pool.length];

      return JSON.stringify({
        speech: prefix + pick.speech,
        reaction: pick.reaction,
        actions: pick.actions ?? [],
        remember: { user_facts: userFacts, barkly_memories: [] },
        teach: [],
      });
    },
  };
}
