/**
 * The OFFLINE brain.
 *
 * This is what answers when no model is configured or the network is gone —
 * which, for the published web demo, is always. So it is not a stub: it is
 * the Barkly most people will actually meet, and it used to be six canned
 * scripts that repeated forever regardless of anything ("he still has the
 * same basic four lines").
 *
 * It is not an LLM and does not pretend to be. What it does instead:
 *
 * - READS THE SITUATION. `req.context` carries where he is, how hungry he is,
 *   who is standing there, what he is holding, what he dug up, your name and
 *   the hour. A hungry Barkly at the beach at midnight answers differently
 *   from a full one at home in the afternoon, because he genuinely knows.
 * - NEVER REPEATS. Every pool remembers what it last said and refuses to
 *   serve it again. Repetition is the single thing that breaks the illusion.
 * - ANSWERS THE ACTUAL QUESTION where it cheaply can — his name, your name,
 *   what he's holding, where you are, how he feels, what he found.
 * - STAYS IN CHARACTER. Deadpan, blunt, a bit vain, never sappy, never an
 *   assistant.
 *
 * It is still a fallback. `npm run brain` gives him a real one.
 */

import { DialogueContext, DialogueProvider, DialogueRequest } from '../types';
import { normalizeKey, personalFactFrom } from '../../barkly/facts';
import { compose } from '../../barkly/compose';
import { understand } from '../../barkly/understand';

interface Line {
  speech: string;
  reaction?: string;
  actions?: string[];
  /** Recorded as a durable fact when this line fires. */
  fact?: string;
}

/** Remembers what each pool last served so nothing repeats back to back. */
function rotator() {
  const last = new Map<string, string>();
  return function pick(key: string, pool: Line[]): Line {
    if (pool.length === 1) return pool[0];
    const previous = last.get(key);
    const fresh = pool.filter((l) => l.speech !== previous);
    const chosen = fresh[Math.floor(Math.random() * fresh.length)] ?? pool[0];
    last.set(key, chosen.speech);
    return chosen;
  };
}

const NAME_RE = /\b(?:my name(?:'s| is)|i(?:'m| am) called|call me)\s+([A-Z][a-zA-Z]{1,20})/i;

/** Everything he can be asked that he can honestly answer from state. */
function answerQuestion(text: string, c: DialogueContext | undefined, you: string): Line | null {
  const t = text.toLowerCase();

  if (/\b(what|who)('?s| is)? (your|ur) name\b|\bwhat are you called\b/.test(t)) {
    return { speech: "Barkly. It's on the tag. Keep up.", actions: ['HEAD_TILT'] };
  }
  /*
   * "what is my favorite food" has a right answer whenever they have told
   * him one, and answering it is the single clearest proof of the whole
   * premise. Without this the question fell through to the composer, which
   * gave a verdict ON THE QUESTION -- "I know exactly what Favorite is. I'm
   * choosin' not to say." He was claiming knowledge he did not have, which
   * reads worse to a stranger than simply not knowing.
   */
  const asked = t.match(/\bwhat(?:'?s| is| are)?\s+my\s+(favou?rite\s+[a-z ]{2,24}|[a-z ]{2,24}?)\s*\??$/);
  if (asked && !/\bname\b/.test(asked[1])) {
    // Compare NORMALISED keys. Facts are stored through `normalizeKey`, so
    // "favorite food" is on file as `favorite_food` -- matching on the raw
    // spoken words found nothing, and he told a player who had just answered
    // this exact question that they had never told him.
    const key = normalizeKey(asked[1]);
    const hit = c?.facts?.find((f: string) => normalizeKey(f.slice(0, f.indexOf('='))) === key);
    if (hit) {
      const raw = hit.slice(hit.indexOf('=') + 1).trim();
      // It opens the sentence, so it gets a capital -- "pizza. You told me."
      // reads like a fragment he half-remembered.
      const value = raw.charAt(0).toUpperCase() + raw.slice(1);
      return { speech: `${value}. You told me. I keep things.`, reaction: 'happy', actions: ['TAIL_WAG'] };
    }
    return {
      speech: "You've never told me that. Tell me and I'll keep it forever, obviously.",
      reaction: 'annoyed',
      actions: ['HEAD_TILT'],
    };
  }

  if (/\b(what|who)('?s| is)? my name\b|\bdo you (know|remember) my name\b/.test(t)) {
    return c?.personName
      ? { speech: `${c.personName}. Obviously. I remember things.`, reaction: 'happy', actions: ['TAIL_WAG'] }
      : { speech: "You never told me. That's on you, not me.", reaction: 'annoyed', actions: ['HEAD_TILT'] };
  }
  if (/\bwhere are we\b|\bwhere am i\b|\bwhere is this\b|\bwhat is this place\b/.test(t)) {
    const where = c?.location ?? 'somewhere';
    return { speech: `We're ${where}. I did tell you. With my whole face.`, actions: ['LOOK_LEFT'] };
  }
  if (/\bhow (are|r) (you|u)\b|\bhow do you feel\b|\byou (ok|okay|alright)\b/.test(t)) {
    if (!c) return { speech: 'Fine. Ish. Ask me again after food.' };
    if (c.stats.hunger > 70) return { speech: "Hungry. That's the whole report.", reaction: 'hungry' };
    if (c.stats.energy < 25) return { speech: 'Tired. Structurally tired.', reaction: 'sleepy', actions: ['SLEEP'] };
    if (c.stats.affection > 70) return { speech: "Good, actually. Don't make it weird.", reaction: 'happy', actions: ['TAIL_WAG'] };
    return { speech: 'Operational. Could be improved with cheese.' };
  }
  if (/\b(are you )?(hungry|want food|want a treat)\b/.test(t)) {
    return (c?.stats.hunger ?? 50) > 45
      ? { speech: 'Yes. Next question. Actually no, act on that one.', reaction: 'hungry', actions: ['MOUTH_MOVE'] }
      : { speech: "I'm full. I have standards. Not many, but this is one.", reaction: 'happy' };
  }
  if (/\bwhat (are you|you) (holding|got)\b|\bwhat'?s that\b/.test(t) && c?.toy) {
    return { speech: `${c.toy}. Mine. Don't get ideas.`, reaction: 'excited', actions: ['EXCITED'] };
  }
  if (/\bwhat did you (find|dig)\b|\byour (stash|treasure)\b/.test(t)) {
    const best = c?.treasures?.[c.treasures.length - 1];
    return best
      ? { speech: `${best}. Found it myself. It's priceless now.`, reaction: 'excited', actions: ['TAIL_WAG'] }
      : { speech: "Nothing yet. There's a dig spot at the park with my name on it.", actions: ['EAR_PERK'] };
  }
  if (/\bwho (else )?is here\b|\bwho'?s (that|there)\b/.test(t)) {
    const dogs = c?.npcsPresent ?? [];
    return dogs.length > 0
      ? { speech: `${dogs[0]}'s here. We have history. Some of it is good.`, actions: ['EAR_PERK'] }
      : { speech: "Just us. Which is the correct number of people.", actions: ['LOOK_RIGHT'] };
  }
  if (/\bwhat time\b|\bis it (late|night|morning)\b/.test(t)) {
    const h = c?.hour ?? 12;
    return h >= 21 || h < 6
      ? { speech: "It's night. I can tell because everything smells better.", reaction: 'sleepy' }
      : { speech: "It's daytime. The birds are being smug about it.", actions: ['LOOK_LEFT'] };
  }
  if (/\bare you (a )?(robot|ai|real|computer)\b/.test(t)) {
    return { speech: "I'm a dog. You're the one talking to a dog.", reaction: 'annoyed', actions: ['HEAD_TILT'] };
  }
  if (/\bwhat (can|should) (you|i|we)\b|\bwhat do we do\b|\bwhat now\b|\bhelp\b|\bany ideas\b/.test(t)) {
    return { speech: 'Feed me, throw something, or take me somewhere. Those are the options.', actions: ['EAR_PERK'] };
  }
  if (/\bi love you\b|\bgood (boy|dog)\b|\byou'?re the best\b/.test(t)) {
    return {
      speech: `I know${c?.personName ? `, ${c.personName}` : ''}. But say it again, I wasn't ready.`,
      reaction: 'happy',
      actions: ['TAIL_WAG', 'EAR_PERK'],
    };
  }
  return null;
}

/** Topic pools. Each is a list so the rotator can keep him from repeating. */
const TOPICS: { id: string; match: RegExp; lines: Line[] }[] = [
  {
    id: 'greeting',
    match: /\b(hi|hello|hey|yo|sup|morning|evening)\b/i,
    lines: [
      { speech: "Oh. It's you. I mean — hey. Took you long enough.", reaction: 'happy', actions: ['TAIL_WAG'] },
      { speech: 'Hey. I was busy staring at a wall. You are marginally better.', reaction: 'happy', actions: ['HEAD_TILT'] },
      { speech: 'You came back. I had a whole speech prepared. Forgot it.', reaction: 'excited', actions: ['EXCITED'] },
      { speech: 'Hello. I have been extremely brave in your absence.', actions: ['EAR_PERK'] },
    ],
  },
  {
    id: 'food',
    match: /\b(food|treat|hungry|eat|snack|dinner|cheese|steak|biscuit)\b/i,
    lines: [
      { speech: 'Did you say treat? I heard treat. This conversation just got important.', reaction: 'excited', actions: ['EXCITED', 'TAIL_WAG'] },
      { speech: "I'm listening. Especially if this ends with food.", reaction: 'hungry', actions: ['HEAD_TILT'] },
      { speech: 'Food. Now. I have cleared my schedule.', reaction: 'hungry', actions: ['MOUTH_MOVE'] },
      { speech: "Cheese is a food and also a personality. Mine.", reaction: 'excited', actions: ['TAIL_WAG'] },
    ],
  },
  {
    id: 'play',
    match: /\b(play|ball|fetch|game|throw|toy|rope)\b/i,
    lines: [
      { speech: 'Fetch? Throw it. Throw it right now. Why are you still talking?', reaction: 'excited', actions: ['EXCITED', 'TAIL_WAG'] },
      { speech: "I'll play. Not because I'm desperate. Throw the ball.", actions: ['TAIL_WAG'] },
      { speech: 'Every game is a competition and I have never lost one. Officially.', reaction: 'excited', actions: ['EXCITED'] },
    ],
  },
  {
    id: 'dogs',
    match: /\b(duke|biscuit|pepper|dog|friend|rival)\b/i,
    lines: [
      { speech: 'Duke says he fetches at a national level. Duke says a lot of things.', reaction: 'annoyed', actions: ['HEAD_TILT'] },
      { speech: "Biscuit's alright. Biscuit gets it. Biscuit is also very slow.", actions: ['EAR_PERK'] },
      { speech: 'I have a complicated social life. It is mostly grudges.', actions: ['LOOK_LEFT'] },
    ],
  },
  {
    id: 'cat',
    match: /\b(cat|kitten|another dog|other pet)\b/i,
    lines: [
      { speech: 'A cat? In OUR house? We need to talk about your choices.', reaction: 'annoyed', actions: ['LOOK_LEFT', 'HEAD_TILT'] },
      { speech: 'I have no notes on cats. I have many notes on cats.', reaction: 'annoyed', actions: ['EAR_PERK'] },
    ],
  },
  {
    id: 'sleep',
    match: /\b(sleep|tired|bed|nap|night)\b/i,
    lines: [
      { speech: "Now you're speaking my language. Wake me if there's cheese.", reaction: 'sleepy', actions: ['SLEEP'] },
      { speech: 'Nap. Yes. I have made my decision and it is nap.', reaction: 'sleepy', actions: ['SLEEP'] },
    ],
  },
  {
    id: 'walk',
    match: /\b(walk|park|town|beach|outside|go|travel)\b/i,
    lines: [
      { speech: 'Outside? Say it again slowly so I can lose my mind properly.', reaction: 'excited', actions: ['EXCITED', 'TAIL_WAG'] },
      { speech: "The beach has a whole sea. I intend to bark at all of it.", reaction: 'excited', actions: ['EXCITED'] },
      { speech: "I'll go anywhere. I'll complain the entire time. Both true.", actions: ['EAR_PERK'] },
    ],
  },
];

/** How many of his own recent lines he refuses to repeat. */
const RECENT = 14;

export function createScriptedDialogue(): DialogueProvider {
  const recent: string[] = [];
  const pick = rotator();
  // A walking seed rather than Math.random: successive replies land on
  // different shapes instead of clustering, and a test can drive it.
  let seed = Math.floor(Math.random() * 997);

  return {
    name: 'scripted-offline',
    isAvailable: () => true,

    async complete(req: DialogueRequest): Promise<string> {
      const c = req.context;
      const text = req.userText;
      const you = c?.personName ?? '';
      const facts: string[] = [];

      // Learning a name still works offline — it is the first thing he does.
      let prefix = '';
      const named = text.match(NAME_RE);
      if (named) {
        facts.push(`name = ${named[1]}`);
        prefix = `${named[1]}, huh. Good name. Mine's better, but good. `;
      }

      // Anything else personal they just told him. Offline he used to keep
      // ONLY the name, so "my favorite food is pizza" was heard, answered,
      // and forgotten -- see facts.personalFactFrom.
      const personal = personalFactFrom(text);
      if (personal) facts.push(personal);

      // A question he can honestly answer from real state beats anything
      // generated — "what's my name" has a right answer and he should give it.
      const known = answerQuestion(text, c, you);
      if (known) {
        recent.push(known.speech);
        return JSON.stringify({
          speech: prefix + known.speech,
          reaction: known.reaction,
          actions: known.actions ?? [],
          remember: { facts, experiences: [] },
        });
      }

      // Everything else is COMPOSED from what they actually said, rather than
      // picked out of a bucket. The seed walks so phrasing varies; if the
      // result is one he has used recently, walk it again. This is the whole
      // difference between "he has four lines" and "he has an opinion".
      const u = understand(text);

      // The hand-written topic lines are the funniest thing he says, so they
      // are not thrown away — they are mixed IN. Roughly one matched topic in
      // three gets its bespoke line; the rest compose. (What was removed is
      // the four-line pool that everything else used to fall into.)
      //
      // EXCEPT when the sentence names a dog he has real history with and the
      // topic only matched BECAUSE of that name. The 'dogs' pool says the
      // same "Biscuit's alright" about a best friend of months, and 'food'
      // matches the word "biscuit" — both are generic lines shadowing a
      // relationship-specific one, which is the exact complaint. Strip the
      // bonded names and re-test: if the topic no longer matches, the
      // sentence was about the RELATIONSHIP, and the composer (which knows
      // the bond) must answer instead.
      const bondedNamed = Object.keys(c?.bonds ?? {}).filter((n) =>
        new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text),
      );
      const textSansDogs = bondedNamed.reduce(
        (s, n) => s.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' '),
        text,
      );
      const topic = TOPICS.find((t) => t.match.test(text));
      const aboutTheDog = topic && bondedNamed.length > 0 && !topic.match.test(textSansDogs);
      if (topic && !aboutTheDog && seed % 3 === 0) {
        const line = pick(topic.id, topic.lines);
        if (!recent.includes(line.speech)) {
          seed++;
          recent.push(line.speech);
          if (recent.length > RECENT) recent.shift();
          return JSON.stringify({
            speech: prefix + line.speech,
            reaction: line.reaction,
            actions: line.actions ?? [],
            remember: { facts, experiences: [] },
          });
        }
      }

      // The raw sentence rides along so the composer can tell Biscuit the
      // friend from a biscuit you eat — see compose.bondOn.
      const cc = { ...(c ?? {}), avoid: recent, text };
      let built = compose(u, cc, seed++);
      for (let tries = 0; tries < 6 && recent.includes(built.speech); tries++) {
        built = compose(u, cc, seed++);
      }
      recent.push(built.speech);
      if (recent.length > RECENT) recent.shift();

      return JSON.stringify({
        speech: prefix + built.speech,
        reaction: built.reaction,
        actions: built.actions,
        remember: { facts, experiences: [] },
      });
    },
  };
}
