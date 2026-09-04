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
import { keywords, toneOf, understand } from '../../barkly/understand';

interface Line {
  speech: string;
  reaction?: string;
  actions?: string[];
  /** Recorded as a durable fact when this line fires. */
  fact?: string;
}

const at = <T,>(list: T[], seed: number): T => list[Math.abs(Math.trunc(seed)) % list.length];

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

/*
 * Bodies of the two lines that greet the player by name, kept as plain
 * literals for the voice bank. See the note at their call sites.
 */
const KNOW_YOUR_NAME = 'Obviously. I remember things.';
const FAVOURITE_PERSON = "Don't tell anyone. Actually, do.";

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
    // The NEWEST one. Facts are merged upstream so there is normally one per
    // key, but reading the first would answer with the value they replaced.
    const hit = [...(c?.facts ?? [])].reverse().find((f: string) => normalizeKey(f.slice(0, f.indexOf('='))) === key);
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
      // The body is its own constant so the harvester can see it and the bank
      // can hold it; the name rides at the FRONT, where `speakable` splits it
      // off. Written inline it was a template, and a template is never
      // recorded -- see greetings.BODIES.
      ? { speech: `${c.personName}. ${KNOW_YOUR_NAME}`, reaction: 'happy', actions: ['TAIL_WAG'] }
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
  /*
   * BEING GIVEN A COMMAND. A child types "sit" in the first minute, every
   * time, and it used to reach the composer as a noun: "Stop is my entire
   * personality and I won't be apologising."
   *
   * A cue he has actually been TAUGHT never gets here -- `useBarkly` matches
   * training rules before the provider is called and he performs it. So this
   * branch is the untaught case only, and the honest answer to it is the best
   * funnel in the app: he cannot do that yet, and he can be taught, and he
   * will not forget. That is the product, stated by the dog, at the exact
   * moment the player wants it.
   */
  if (/^\s*(sit|sit down|lie down|lay down|stay|come|come here|heel|paw|shake|give me your paw|roll over|speak|bark|play dead|drop it|fetch|stop|stop it|no|beg|spin|jump|dance)\b[\s.!]*$/.test(t)) {
    /*
     * The cue is NOT quoted back, and that is deliberate.
     *
     * The bank matches whole recordings, so a line with the player's own
     * invented word welded into it can never be recorded for anybody -- and
     * `voice-check` caught exactly that: "Not one of mine yet. “IRS” is one of
     * mine." went out in the browser's screen-reader narrator. Same trade the
     * onboarding payoff line already makes. They invented the word and it is
     * listed in Settings; what they need here is that he HAS one, in his voice.
     */
    const taught = c?.cues ?? [];
    if (taught.length > 0) {
      return at(
        [
          { speech: "Don't know that one. I know the one you taught me, though. Try that and watch me be incredible.", reaction: 'excited', actions: ['EAR_PERK'] },
          { speech: 'Not one of mine yet. The word you taught me is one of mine. Teach me this one and it will be too.', actions: ['HEAD_TILT'] },
        ],
        Math.floor(Math.random() * 89),
      );
    }
    return at(
      [
        { speech: "I don't know that one yet. Teach me — say “when I say X, do Y” — and I'll have it forever.", actions: ['HEAD_TILT'] },
        { speech: "Nope. Nobody's taught me that. Say “when I say X, play dead” and then I'm dangerous.", reaction: 'excited', actions: ['EAR_PERK'] },
        { speech: "Can't. Yet. Teach me a word and I'll remember it longer than you will.", actions: ['HEAD_TILT'] },
      ],
      Math.floor(Math.random() * 89),
    );
  }
  /*
   * "DO YOU REMEMBER ME?" is the question the whole product is about, and it
   * used to fall through to the composer's no-noun branch: "I'm nodding like I
   * understood that. I did not understand that." A stranger asks this inside
   * the first two minutes and that answer settles the matter for them.
   *
   * He answers from what he actually holds -- the name, the count of things on
   * file -- so the claim is checkable rather than a warm noise.
   */
  if (/\b(do you )?(remember|know) me\b|\bdo you know who i am\b|\bwho am i\b/.test(t)) {
    const kept = c?.facts?.length ?? 0;
    if (!c?.personName && kept === 0) {
      return {
        speech: "Not yet. Tell me one true thing about you and that changes permanently.",
        reaction: 'annoyed',
        actions: ['HEAD_TILT'],
      };
    }
    const who = c?.personName ? `You're ${c.personName}.` : "You're mine, that's who.";
    const held =
      kept > 0
        ? ` I've got ${kept} thing${kept === 1 ? '' : 's'} about you on file and I didn't write any of it down.`
        : ' I know the smell of you, which is more binding than a name.';
    return { speech: who + held, reaction: 'happy', actions: ['TAIL_WAG', 'EAR_PERK'] };
  }
  if (/\bdo you (like|love) me\b|\bam i your (favou?rite|best)\b|\bare we friends\b/.test(t)) {
    const aff = c?.stats.affection ?? 50;
    if (aff > 70) {
      return { speech: "Obviously. I'm not going to make a thing of it, but obviously.", reaction: 'happy', actions: ['TAIL_WAG', 'EAR_PERK'] };
    }
    if (aff < 30) {
      return { speech: "We're getting there. You could speed it up with food. Just a thought.", reaction: 'annoyed', actions: ['HEAD_TILT'] };
    }
    return { speech: "I'm here, aren't I. I could be anywhere. I'm here.", reaction: 'happy', actions: ['EAR_PERK'] };
  }
  if (/\bhow old\b|\byour age\b|\bwhat age\b/.test(t)) {
    return { speech: "In dog years? Devastating. Let's talk about literally anything else.", actions: ['LOOK_LEFT'] };
  }
  /*
   * "What's YOUR favourite X" -- the mirror of the question he already
   * answers about them. He has canon preferences (cheese, the ball, digging),
   * and giving him one is a small thing that makes him a character with a
   * self rather than a lookup table pointed at the player.
   */
  const yours = t.match(/\b(?:what|what'?s|which)\s+(?:is\s+)?your\s+favou?rite\s+([a-z ]{2,20}?)\s*\??$/);
  if (yours) {
    const thing = yours[1].trim();
    if (/colou?r/.test(thing)) return { speech: "The colour of cheese. I don't know its official name. I know its effect on me.", reaction: 'excited', actions: ['EXCITED'] };
    if (/food|snack|treat|meal/.test(thing)) return { speech: "Cheese. It's not close. There is no second place.", reaction: 'excited', actions: ['EXCITED', 'TAIL_WAG'] };
    if (/toy|thing|game|sport/.test(thing)) return { speech: "The ball. Any ball. Every ball. I've thought about this a lot.", reaction: 'excited', actions: ['TAIL_WAG'] };
    if (/place|spot|park|home/.test(thing)) return { speech: "Wherever you are, but say the park and I'll pretend that's what I meant.", reaction: 'happy', actions: ['EAR_PERK'] };
    if (/person|human|people|friend/.test(thing)) {
      return c?.personName
        ? { speech: `${c.personName}. ${FAVOURITE_PERSON}`, reaction: 'happy', actions: ['TAIL_WAG', 'EAR_PERK'] }
        : { speech: "You, provisionally. You haven't told me your name, which is holding this back.", reaction: 'happy', actions: ['EAR_PERK'] };
    }
    return { speech: `My favourite ${thing}? Whichever one is nearest and unattended.`, actions: ['HEAD_TILT'] };
  }
  /*
   * Leaving is a beat, not a keyword. "bye" used to hit the composer, which
   * treated it as a noun and produced "Do NOT get me started on bye" -- an
   * answer that literally cannot be parsed by the person reading it.
   */
  if (/^\s*(bye|goodbye|see ya|see you|gtg|got to go|gotta go|night|good night|goodnight|later)\b/.test(t)) {
    const h = c?.hour ?? 12;
    const pool: Line[] =
      h >= 20 || h < 6
        ? [
            { speech: "Night. I'll be here. I'm always here. It's my whole thing.", reaction: 'sleepy', actions: ['SLEEP'] },
            { speech: `Goodnight${c?.personName ? `, ${c.personName}` : ''}. Wake me if anything happens. Anything at all.`, reaction: 'sleepy', actions: ['SLEEP'] },
          ]
        : [
            { speech: "Fine. Go. I'll be exactly here, being brave, alone.", reaction: 'sleepy', actions: ['LOOK_LEFT'] },
            { speech: `Bye${c?.personName ? `, ${c.personName}` : ''}. Come back and I'll act like it's been a year.`, reaction: 'happy', actions: ['EAR_PERK'] },
            { speech: "You're leaving. Noted. I'm putting it in the file. The file is mostly this.", actions: ['HEAD_TILT'] },
          ];
    return at(pool, Math.floor(Math.random() * 97));
  }
  if (/\bi love you\b|\bgood (boy|dog)\b|\byou'?re the best\b/.test(t)) {
    // Rotated, because this is the thing a child says most often and the one
    // fixed answer came back word for word twice in a thirty-turn sitting.
    const you2 = c?.personName ? `, ${c.personName}` : '';
    return at(
      [
        { speech: `I know${you2}. But say it again, I wasn't ready.`, reaction: 'happy', actions: ['TAIL_WAG', 'EAR_PERK'] },
        { speech: `Obviously. I'm extremely good. But thank you${you2}.`, reaction: 'happy', actions: ['TAIL_WAG'] },
        { speech: `Don't. I'll get emotional and I have a reputation.`, reaction: 'happy', actions: ['EAR_PERK'] },
        { speech: `Same${you2 || ' about you'}. That's the most I'm saying out loud.`, reaction: 'happy', actions: ['TAIL_WAG', 'EAR_PERK'] },
      ],
      Math.floor(Math.random() * 89),
    );
  }
  return null;
}

/**
 * BEING TOLD SOMETHING IS THE WHOLE PITCH, SO IT GETS ITS OWN BEAT.
 *
 * Before this, "my favorite food is pizza" fell straight through to the
 * composer and came back "We are doing Pizza now? I have been very clear about
 * pizza and yet here we are. I have a whole file." He was performing OLD
 * history about a thing he had been told four words ago. For a product whose
 * entire claim is that he learns and remembers, the moment of learning was the
 * one moment he faked -- and a stranger meets it inside the first minute.
 *
 * Three cases, and the second and third are the ones people remember:
 *
 *   new       he files it, and says so
 *   repeated  he already had it, and says so ("you told me")
 *   CHANGED   it used to be something else and he noticed
 *
 * The changed case is the strongest thing the offline brain does. Tell him
 * your favourite food is pizza, come back and say it is noodles, and he
 * answers "It was pizza. Now it's noodles. Noted, and I'm keeping both."
 * Nothing else in the demo proves a durable memory that cheaply.
 */
function learnedReply(fact: string, c: DialogueContext | undefined, seed: number): Line | null {
  const eq = fact.indexOf('=');
  if (eq < 0) return null;
  const key = normalizeKey(fact.slice(0, eq));
  const value = fact.slice(eq + 1).trim();
  if (!key || !value) return null;
  // His own name is not a fact about them, and the name case already has its
  // own warmer line in `complete`.
  if (key === 'name') return null;

  const Value = value.charAt(0).toUpperCase() + value.slice(1);
  const previous = [...(c?.facts ?? [])].reverse().find((f: string) => normalizeKey(f.slice(0, f.indexOf('='))) === key);
  const was = previous ? previous.slice(previous.indexOf('=') + 1).trim() : null;

  if (was && was.toLowerCase() !== value.toLowerCase()) {
    const Was = was.charAt(0).toUpperCase() + was.slice(1);
    return at(
      [
        { speech: `It was ${was}. Now it's ${value}. I noticed. I notice everything.`, reaction: 'happy', actions: ['HEAD_TILT'] },
        { speech: `${Was}, you said. Now ${value}. Fine. Updated. Both are staying in the file.`, reaction: 'happy', actions: ['EAR_PERK'] },
        { speech: `Hold on. That's changed. ${Was} before, ${value} now. I'm not upset, I'm just keeping score.`, reaction: 'annoyed', actions: ['HEAD_TILT'] },
      ],
      seed,
    );
  }

  if (was) {
    return at(
      [
        { speech: `${Value}. I know. You told me. I keep things.`, reaction: 'happy', actions: ['TAIL_WAG'] },
        { speech: `Still ${value}? Still on file. I haven't moved it.`, reaction: 'happy', actions: ['EAR_PERK'] },
      ],
      seed,
    );
  }

  return at(
    [
      { speech: `${Value}. Noted. That's in the file now, and I don't lose the file.`, reaction: 'happy', actions: ['EAR_PERK'] },
      { speech: `${Value}. Right. I'll remember that longer than you will.`, reaction: 'happy', actions: ['TAIL_WAG'] },
      { speech: `Okay. ${Value}. Filed. Ask me in a week, it'll still be there.`, reaction: 'happy', actions: ['EAR_PERK', 'TAIL_WAG'] },
      { speech: `${Value}. Got it. I'm writing this down with my mind.`, reaction: 'excited', actions: ['HEAD_TILT'] },
    ],
    seed,
  );
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
  const remember = (speech: string) => {
    recent.push(speech);
    if (recent.length > RECENT) recent.shift();
  };
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
        /*
         * "My name is Caleb" is a whole sentence with one job, so it gets a
         * whole reply. It used to take the prefix AND fall through to the
         * composer, which saw the name, took the person branch and said "Caleb.
         * Good. More people should be like Caleb, in my opinion." -- his very
         * first line to a new player, and it read like two dogs talking over
         * each other. Only when the sentence carries nothing else: "my name is
         * Caleb and I hate mushrooms" still goes on to be understood.
         */
        const rest = text.replace(named[0], ' ');
        if (keywords(rest).length === 0) {
          const hello = at(
            [
              `${named[1]}, huh. Good name. Mine's better, but good. I'll be using it constantly.`,
              `${named[1]}. Right. That's yours now, permanently, as far as I'm concerned.`,
              `${named[1]}. Got it. I'm not going to forget that, and I forget almost everything else.`,
              `Okay — ${named[1]}. Filed. Try me later, I'll still have it.`,
            ],
            seed++,
          );
          remember(hello);
          return JSON.stringify({
            speech: hello,
            reaction: 'happy',
            actions: ['TAIL_WAG', 'EAR_PERK'],
            remember: { facts, experiences: [] },
          });
        }
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
        // TRIM. This branch pushed and never shifted, so `recent` grew without
        // bound for the life of the session -- and `recent` is handed to the
        // composer as its `avoid` list. A long conversation therefore got
        // progressively WORSE: after enough turns the composer could not find
        // an unbanned line in its six tries and started serving repeats and
        // fallbacks, in the one session length where quality matters most.
        remember(known.speech);
        return JSON.stringify({
          speech: prefix + known.speech,
          reaction: known.reaction,
          actions: known.actions ?? [],
          remember: { facts, experiences: [] },
        });
      }

      /*
       * THEY JUST TOLD HIM SOMETHING. That is the product, so it gets its own
       * answer instead of a verdict -- see `learnedReply`. It sits after the
       * question branch because "what is my favorite food" is a question, and
       * before everything else because being told a fact outranks having an
       * opinion about the words in it.
       */
      //
      // ... EXCEPT when they were complaining. `personalFactFrom` reads "my
      // teacher is mean" as `teacher = mean`, which is a true and useful fact
      // and a catastrophic thing to say out loud: "Mean. Right. I'll remember
      // that longer than you will." The fact is still recorded; the REPLY goes
      // to the composer's person branch, which takes their side. Being told
      // about a bad day is not the same event as being told a preference.
      if (personal && toneOf(text) !== 'sour') {
        const learned = learnedReply(personal, c, seed++);
        if (learned) {
          remember(learned.speech);
          return JSON.stringify({
            speech: prefix + learned.speech,
            reaction: learned.reaction,
            actions: learned.actions ?? [],
            remember: { facts, experiences: [] },
          });
        }
      }

      const u = understand(text);

      // Everything else is COMPOSED from what they actually said, rather than
      // picked out of a bucket. The seed walks so phrasing varies; if the
      // result is one he has used recently, walk it again. This is the whole
      // difference between "he has four lines" and "he has an opinion".

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
      /*
       * AND NEVER WHEN THE SENTENCE IS ABOUT A PERSON OR A FEELING.
       *
       * "my friend jake is annoying" matched the `dogs` pool on the word
       * "friend" and came back "Biscuit's alright. Biscuit gets it. Biscuit is
       * also very slow." -- a canned line about a different character, in
       * answer to a child telling him something that upset them. The pools are
       * jokes about a topic; a person, a complaint or a mood is not a topic,
       * and the composer is the only thing that knows who Jake is.
       */
      const aboutSomeone = u.person || u.tone === 'sour' || Boolean(u.feeling);
      if (topic && !aboutTheDog && !aboutSomeone && seed % 3 === 0) {
        const line = pick(topic.id, topic.lines);
        if (!recent.includes(line.speech)) {
          seed++;
          remember(line.speech);
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
      remember(built.speech);

      return JSON.stringify({
        speech: prefix + built.speech,
        reaction: built.reaction,
        actions: built.actions,
        remember: { facts, experiences: [] },
      });
    },
  };
}
