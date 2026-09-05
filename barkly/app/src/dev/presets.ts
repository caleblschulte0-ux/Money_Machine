/**
 * Nine Barklys, saved.
 *
 * ChatGPT is going to play this game and tell us whether it is any good. It
 * cannot do that on a dog it met four seconds ago: half of what Barkly IS only
 * exists after weeks — a Pack Book with something in it, a rivalry with Duke
 * that has history, a trick he learned from you, a room full of things you
 * bought him. Waiting six months to find out whether the six-month experience
 * lands is not a plan.
 *
 * So these are real saves. Not UI labels, not a mocked screen: each preset is
 * the JSON that goes into the actual key-value store the game hydrates from, so
 * every downstream system — prompts, the Pack Book, the store, unlocked
 * locations, story detection, his idle thoughts — reads it and behaves
 * accordingly, because as far as the app is concerned this dog really did live
 * that life.
 *
 * They are built from the real modules' own constructors and types rather than
 * hand-written JSON. A literal blob would be stale the first time a field
 * changes, and stale in the silent way: the app would hydrate it, drop what it
 * did not recognise, and present a Barkly quietly missing half his history.
 */

import { CharacterState, freshCharacter } from '../barkly/character';
import { Experience, Fact } from '../barkly/facts';
import { emptyMemory, MemoryState } from '../barkly/memory';
import { describeFact } from '../barkly/facts';
import { TrainingRule } from '../barkly/training';
import { BarklySnapshot, ChatTurn } from '../barkly/types';
import { freshWallet, Wallet } from '../game/progression';
import { AdventureState } from '../game/adventure';

import { LocationId } from '../world/locations';
import { CoauthorState, freshCoauthorState } from '../barkly/coauthor';
import { freshStoryState, StoryState } from '../barkly/storyV2';
import { IncidentLedger } from '../world/incidents';
import {
  ADVENTURE_KEY,
  CHARACTER_KEY,
  LOCATION_KEY,
  MEMORY_KEY,
  MEMORY_LEGACY_KEY,
  ONBOARDING_DONE,
  ONBOARDING_KEY,
  SNAPSHOT_KEY,
  STASH_KEY,
  INCIDENT_KEY,
  COAUTHOR_KEY,
  STORY_KEY,
  WALLET_KEY,
} from '../storage/keys';

/** A save: every key the game hydrates, JSON-encoded exactly as it writes them. */
export type Save = Record<string, string>;

export interface Preset {
  id: string;
  name: string;
  /** One line, in the menu. What this Barkly is FOR, not what is in him. */
  blurb: string;
  build(now: number): Save;
}

const DAY = 86_400_000;

/* ------------------------------------------------------------------ pieces */

/**
 * Times are relative to load, not absolute.
 *
 * A preset with hard-coded dates would age: "we did this yesterday" becomes
 * "we did this eight months ago" and his memory sounds like a stroke victim.
 * Everything here is `now - N days`, so a save is the same age every time it
 * is loaded, forever.
 */
function fact(
  now: number,
  subject: string,
  key: string,
  value: string,
  daysAgo: number,
  importance = 0.7,
  category: Fact['category'] = subject === 'person' ? 'identity' : 'opinion',
): Fact {
  const at = now - daysAgo * DAY;
  return {
    id: `pt_${subject}_${key}`,
    category,
    subject,
    key,
    value,
    confidence: 0.9,
    importance,
    learnedAt: at,
    updatedAt: at,
    lastReferencedAt: at,
    referenceCount: 2,
    source: 'user',
  };
}

function did(now: number, what: string, daysAgo: number, opts: Partial<Experience> = {}): Experience {
  const at = now - daysAgo * DAY;
  return {
    id: `pt_exp_${Math.round(at)}_${what.length}`,
    what,
    at,
    importance: 0.7,
    lastReferencedAt: at,
    referenceCount: 1,
    ...opts,
  };
}

function said(now: number, role: ChatTurn['role'], text: string, minsAgo: number): ChatTurn {
  return { role, text, at: now - minsAgo * 60_000 };
}

function trick(
  now: number,
  cue: string,
  speech: string,
  daysAgo: number,
  extra: Partial<TrainingRule> = {},
): TrainingRule {
  const at = now - daysAgo * DAY;
  return {
    id: `pt_trick_${cue.replace(/\W+/g, '_')}`,
    cue,
    normalizedCue: cue.toLowerCase().trim(),
    instruction: `when I say ${cue}`,
    speech,
    actions: ['EAR_PERK'],
    learnedAt: at,
    updatedAt: at,
    timesTriggered: 3,
    ...extra,
  };
}

/**
 * A grievance and an obsession are the things he is cross about RIGHT NOW, and
 * the app expires them — five days for a grievance, three for an obsession (see
 * character.expireCharacter). Dating them back to when the feud started felt
 * right and was wrong: hydration correctly threw them away, and "Duke Nemesis"
 * loaded a Barkly who had already got over it.
 *
 * The long history lives where long history belongs: in the social bonds and in
 * his memories, neither of which expire. What is fresh is the current beef.
 */
const GRIEVANCE_DAYS = 2;
const OBSESSION_DAYS = 1;

function bond(now: number, kind: 'friend' | 'rival', encounters: number, sinceDays: number) {
  return {
    kind,
    encounters,
    firstSeenAt: now - sinceDays * DAY,
    lastSeenAt: now - DAY,
  };
}

/** Memory, with the derived views built the way memory.ts builds them. */
function memory(parts: Partial<MemoryState>): MemoryState {
  const m: MemoryState = { ...emptyMemory(), ...parts };
  m.userFacts = m.facts.map(describeFact);
  m.barklyMemories = m.experiences.map((e) => e.what);
  return m;
}

function snapshot(now: number, over: Partial<BarklySnapshot['stats']> = {}): BarklySnapshot {
  return {
    state: 'idle',
    stats: { hunger: 34, energy: 72, mood: 68, affection: 62, curiosity: 58, ...over },
    updatedAt: now,
    settleMs: null,
  };
}

function wallet(over: Partial<Wallet> = {}): Wallet {
  return { ...freshWallet(), ...over };
}



function plan(now: number, done: number): AdventureState {
  const goals = [
    { id: 'pt_g1', kind: 'play' as const, label: 'Throw something', detail: 'He will bring it back. Probably.', done: done > 0 },
    { id: 'pt_g2', kind: 'npc' as const, label: 'Find Biscuit', detail: 'He is around here somewhere.', done: done > 1 },
    { id: 'pt_g3', kind: 'dig' as const, label: 'Dig something up', detail: 'The park owes him.', done: done > 2 },
  ];
  return {
    day: new Date(now).toISOString().slice(0, 10),
    title: "Barkly's very serious plan",
    subtitle: 'He wrote it. He stands by it.',
    goals,
    rewarded: false,
    ...(done >= 3 ? { completedAt: now - 3600_000 } : {}),
  };
}

function save(now: number, p: {
  location?: LocationId;
  snapshot?: BarklySnapshot;
  wallet?: Wallet;
  character?: CharacterState;
  memory?: MemoryState;
  stash?: string[];
  incidents?: IncidentLedger;
  canon?: CoauthorState;
  story?: StoryState;
  adventure?: AdventureState;
  name?: string;
}): Save {
  return {
    [SNAPSHOT_KEY]: JSON.stringify(p.snapshot ?? snapshot(now)),
    /**
     * BARE, like onboarding. The app writes `gate.write(LOCATION_KEY, loc)` —
     * no JSON — and hydration checks `savedLoc in LOCATIONS`, so the quoted
     * form '"park"' fails the membership test and every preset silently opened
     * at home. Duke Nemesis is staged at the park; a nemesis you have to walk
     * to is a nemesis the tester never meets.
     */
    [LOCATION_KEY]: p.location ?? 'home',
    [CHARACTER_KEY]: JSON.stringify(p.character ?? freshCharacter()),
    /**
     * A BARE STRING, which is what the app writes and reads here. Every preset
     * is onboarding-complete: nobody wants to name the dog nine times, and the
     * welcome flow is not what a tester loading "Long-Term Barkly" is testing.
     * (His NAME does not live here — it is a fact in his memory, which is where
     * nameFromFacts looks for it.)
     */
    [ONBOARDING_KEY]: ONBOARDING_DONE,
    [WALLET_KEY]: JSON.stringify(p.wallet ?? freshWallet()),
    [ADVENTURE_KEY]: JSON.stringify(p.adventure ?? plan(now, 0)),
    [MEMORY_KEY]: JSON.stringify(p.memory ?? emptyMemory()),
    // Always cleared: the v1 store is a migration path, and leaving one behind
    // would let a previous life leak into a fresh preset.
    [MEMORY_LEGACY_KEY]: '',
    [STASH_KEY]: JSON.stringify(p.stash ?? []),
    /*
     * Incidents and canon are EMPTY by default on purpose. A preset that
     * shipped a pre-fired incident ledger would hide the very thing a tester
     * loads a slot to see -- the world noticing your history on its own. An
     * empty ledger means the next eligible incident is free to fire.
     */
    [INCIDENT_KEY]: JSON.stringify(p.incidents ?? {}),
    [COAUTHOR_KEY]: JSON.stringify(p.canon ?? freshCoauthorState()),
    /*
     * The saga ledger is empty by default for the same reason, with one
     * exception below: a saga is supposed to be earned. Long-Term Barkly ships
     * one because "three to six months" is precisely the save where a story
     * having a PAST is the thing under test, and nothing else can produce that
     * in a playtest session.
     */
    [STORY_KEY]: JSON.stringify(p.story ?? freshStoryState()),
  };
}

/* ----------------------------------------------------------------- presets */

export const PRESETS: Preset[] = [
  {
    id: 'fresh',
    name: 'Fresh Barkly',
    blurb: 'Onboarding done, nothing else. The first two minutes.',
    // He knows your name and nothing else, because that is exactly what the
    // welcome flow leaves behind.
    build: (now) => save(now, { memory: memory({ facts: [fact(now, 'person', 'name', 'Caleb', 0, 1)] }) }),
  },

  {
    id: 'day3',
    name: 'Day 3',
    blurb: 'A few conversations, a ball, and the beginning of an opinion.',
    build: (now) =>
      save(now, {
        wallet: wallet({ coins: 95, xp: 55, owned: ['toy_ball'], equipped: { toy: 'toy_ball' } }),
        character: { ...freshCharacter(), treasuresFound: 1, socialBonds: { biscuit: bond(now, 'friend', 2, 2) } },
        stash: ['sock'],
        memory: memory({
          facts: [fact(now, 'person', 'name', 'Caleb', 3, 1), fact(now, 'person', 'favorite_color', 'green', 2, 0.4)],
          experiences: [did(now, 'Caleb threw the ball at the park until his arm gave out.', 2, { where: 'Park' })],
          turns: [said(now, 'user', 'do you like the park', 40), said(now, 'barkly', 'Da park is da best place. Obviously.', 39)],
        }),
        adventure: (() => plan(now, 1))(),
      }),
  },

  {
    id: 'established',
    name: 'Established Barkly',
    blurb: 'A few weeks in. Everything unlocked, a room, opinions about everyone.',
    build: (now) =>
      save(now, {
        snapshot: snapshot(now, { mood: 74 }),
        wallet: wallet({
          coins: 340,
          xp: 430,
          owned: ['toy_ball', 'toy_rope', 'collar_red', 'home_bed', 'treat_biscuit'],
          equipped: { toy: 'toy_rope', collar: 'collar_red' },
          placed: ['home_bed'],
          pantry: { treat_biscuit: 4 },
        }),
        character: {
          ...freshCharacter(),
          favoriteTreasure: 'the good stick',
          treasuresFound: 5,
          favoriteFriend: 'Biscuit',
          socialBonds: {
            biscuit: bond(now, 'friend', 9, 20),
            duke: bond(now, 'rival', 5, 18),
            pepper: bond(now, 'friend', 3, 12),
          },
          socialChoices: { biscuit: 2, duke: 1 },
        },
        stash: ['good_stick', 'sock', 'duck_rock', 'caps', 'feather'],
        memory: memory({
          sessionSummary: 'Caleb visits most days. Barkly has decided the park is his.',
          facts: [
            fact(now, 'person', 'name', 'Caleb', 21, 1),
            fact(now, 'person', 'works_at', 'a desk, apparently', 14, 0.5),
            fact(now, 'Duke', 'opinion', 'not to be trusted', 12, 0.8),
          ],
          experiences: [
            did(now, 'Found the good stick at the park. It is the best one.', 16, { where: 'Park' }),
            did(now, 'Duke said the stick was ordinary. It is not ordinary.', 12, { where: 'Park', withWhom: ['Duke'] }),
            did(now, 'Biscuit helped look for the stick and found a different stick.', 9, { withWhom: ['Biscuit'] }),
          ],
          openThreads: ['whether Duke should be forgiven'],
          trainingRules: [trick(now, 'spin', "Yeah yeah. Watch dis.", 10)],
          turns: [said(now, 'user', 'is duke around', 25), said(now, 'barkly', "Duke's around. I'm not lookin' for him.", 24)],
        }),
        adventure: plan(now, 2),
      }),
  },

  {
    id: 'longterm',
    name: 'Long-Term Barkly',
    blurb: 'Three to six months. A whole Pack Book, rituals, a saga with a history.',
    build: (now) =>
      save(now, {
        snapshot: snapshot(now, { mood: 80, energy: 64 }),
        wallet: wallet({
          coins: 820,
          xp: 1450,
          owned: ['toy_ball', 'toy_rope', 'collar_red', 'collar_green', 'home_bed', 'home_rug', 'treat_biscuit', 'treat_cheese'],
          equipped: { toy: 'toy_rope', collar: 'collar_green' },
          placed: ['home_bed', 'home_rug'],
          pantry: { treat_biscuit: 6, treat_cheese: 2 },
        }),
        character: {
          ...freshCharacter(),
          favoriteTreasure: 'a rock that looks like a duck',
          treasuresFound: 14,
          favoriteFriend: 'Biscuit',
          obsession: { topic: 'the bakery bin', since: now - OBSESSION_DAYS * DAY },
          grievance: { who: 'Duke', what: 'said the duck rock was just a rock', since: now - GRIEVANCE_DAYS * DAY },
          socialBonds: {
            biscuit: bond(now, 'friend', 31, 150),
            duke: bond(now, 'rival', 22, 140),
            pepper: bond(now, 'friend', 14, 90),
          },
          socialChoices: { biscuit: 6, duke: 5, pepper: 3 },
        },
        stash: ['duck_rock', 'good_stick', 'sock', 'tiny_duck', 'caps', 'shell', 'sea_glass', 'button', 'glove'],
        /*
         * A saga mid-run and a saga that ended. The active one matches the arc
         * this character's history derives (`treasure-rival-duke`), so
         * `syncStoryState` recognises it and keeps these chapters instead of
         * starting over at Chapter I -- which is the whole thing the ledger
         * exists to prevent, and worth having a preset that proves it.
         */
        story: {
          version: 2,
          active: {
            id: 'treasure-rival-duke',
            title: 'The Duke Situation',
            premise: 'Duke is Barkly\u2019s nemesis, and Barkly is extremely protective of a rock that looks like a duck. This combination has become a whole thing.',
            cast: ['Duke'],
            status: 'active',
            route: 'protected',
            intensity: 4,
            startedAt: now - 40 * DAY,
            updatedAt: now - 9 * DAY,
            chapters: [
              { number: 1, title: 'Chapter IV \u00b7 This Is Generational Now', happenedAt: now - 40 * DAY },
              {
                number: 2,
                title: 'Guard the treasure',
                happenedAt: now - 9 * DAY,
                decisionId: 'guard-it',
                consequence: 'Barkly chose possession over peace. The rival now knows this object matters.',
              },
            ],
            choices: [
              { id: 'let-them-see', label: 'Let the rival see it', route: 'shared', consequence: 'Barkly allowed a rival near something he loves. The feud has a crack in it now.', barklyLine: 'They may LOOK. Looking is not owning.' },
              { id: 'end-the-beef', label: 'Try to end the beef', route: 'reconciled', consequence: 'You pushed Barkly toward an actual truce instead of another incident.', barklyLine: 'I am not forgiving. I am... suspending hostilities.', resolves: true },
            ],
            nextHook: 'The next beat must honor this route: protected.',
          },
          archive: [{
            id: 'ritual-spreads-showtime',
            title: 'The Bit Has Escaped Containment',
            premise: 'The \u201cshowtime\u201d routine became a signature tradition, and Biscuit has seen it.',
            cast: ['Biscuit'],
            status: 'resolved',
            route: 'public',
            intensity: 2,
            startedAt: now - 70 * DAY,
            updatedAt: now - 52 * DAY,
            resolvedAt: now - 52 * DAY,
            chapters: [
              { number: 1, title: 'Chapter I \u00b7 Other Dogs Have Seen It', happenedAt: now - 70 * DAY },
              {
                number: 2,
                title: 'Finale \u00b7 Make it his signature',
                happenedAt: now - 52 * DAY,
                decisionId: 'make-signature',
                consequence: 'A private ritual became Barkly\u2019s public reputation.',
              },
            ],
            choices: [],
            nextHook: 'This is history now. Barkly can remember that you chose \u201cMake it his signature.\u201d',
          }],
        },
        memory: memory({
          sessionSummary:
            'Months of this. Caleb and Barkly have a routine, a nemesis, and a rock shaped like a duck that is not up for discussion.',
          facts: [
            fact(now, 'person', 'name', 'Caleb', 150, 1),
            fact(now, 'person', 'brother', 'Sam', 120, 0.8),
            fact(now, 'person', 'hates', 'mornings', 96, 0.5),
            fact(now, 'Duke', 'opinion', 'my nemesis, officially', 40, 0.9),
            fact(now, 'Biscuit', 'opinion', 'the best one, do not tell him', 88, 0.9),
          ],
          experiences: [
            did(now, 'The duck rock incident. We do not discuss it. We have procedures now.', 40, { withWhom: ['Duke'] }),
            did(now, 'Biscuit got the duck rock back. He was PROTECTING it, apparently.', 38, { withWhom: ['Biscuit'] }),
            did(now, 'First time at the beach. Barked at the entire sea. Sea unmoved.', 70, { where: 'Beach' }),
            did(now, 'Caleb was away a week. Barkly claims he was fine. He was not fine.', 22),
            did(now, 'Won the fetch duel at the park. Duke has not mentioned it since.', 15, { where: 'Park', withWhom: ['Duke'] }),
          ],
          openThreads: ['the duck rock security protocol', 'whether Duke is allowed at the beach'],
          trainingRules: [
            trick(now, 'showtime', 'Showtime. You made me learn choreography.', 60, {
              routine: [
                { speech: 'Spin. Dis is da spin.', actions: ['EXCITED'] },
                { speech: 'Sit. Easy.', actions: ['SIT'] },
                { speech: 'And... dead. I am dead. Dis is a tragedy.', actions: ['SLEEP'] },
              ],
              timesTriggered: 19,
            }),
            trick(now, 'intruder alert', 'INTRUDER. Where. WHERE.', 45, { timesTriggered: 27 }),
          ],
          turns: [
            said(now, 'user', 'remember the duck rock', 30),
            said(now, 'barkly', 'After da duck-rock incident, we have procedures.', 29),
          ],
        }),
        adventure: plan(now, 3),
      }),
  },

  {
    id: 'duke',
    name: 'Duke Nemesis',
    blurb: 'The rivalry at full volume, at the park, with the history to back it.',
    build: (now) =>
      save(now, {
        location: 'park',
        snapshot: snapshot(now, { mood: 52 }),
        wallet: wallet({ coins: 260, xp: 520, owned: ['toy_rope', 'collar_red'], equipped: { toy: 'toy_rope', collar: 'collar_red' } }),
        character: {
          ...freshCharacter(),
          favoriteTreasure: 'the good stick',
          treasuresFound: 7,
          grievance: { who: 'Duke', what: 'keeps calling the good stick "a twig"', since: now - GRIEVANCE_DAYS * DAY },
          socialBonds: { duke: bond(now, 'rival', 18, 60), biscuit: bond(now, 'friend', 6, 40) },
          socialChoices: { duke: 6 },
        },
        stash: ['good_stick', 'duck_rock', 'half_ball'],
        memory: memory({
          sessionSummary: 'The Duke situation is ongoing and Barkly would like it on the record.',
          facts: [fact(now, 'person', 'name', 'Caleb', 60, 1), fact(now, 'Duke', 'opinion', 'nemesis. official.', 30, 1)],
          experiences: [
            did(now, 'Duke called the good stick a twig in front of everyone.', 30, { where: 'Park', withWhom: ['Duke'] }),
            did(now, 'Duke won a fetch duel by cheating. Allegedly. Definitely.', 21, { where: 'Park', withWhom: ['Duke'] }),
            did(now, 'Refused to look at Duke for an entire afternoon. Held strong.', 9, { withWhom: ['Duke'] }),
          ],
          openThreads: ['the Duke situation'],
        }),
      }),
  },

  {
    id: 'biscuit',
    name: 'Biscuit Best Friend',
    blurb: 'The friendship that has gone all the way, and the events that need it.',
    build: (now) =>
      save(now, {
        location: 'park',
        snapshot: snapshot(now, { mood: 86 }),
        wallet: wallet({ coins: 300, xp: 560, owned: ['toy_ball', 'collar_green'], equipped: { toy: 'toy_ball', collar: 'collar_green' } }),
        character: {
          ...freshCharacter(),
          favoriteFriend: 'Biscuit',
          treasuresFound: 6,
          favoriteTreasure: 'a tiny rubber duck',
          socialBonds: { biscuit: bond(now, 'friend', 34, 120), duke: bond(now, 'rival', 4, 60) },
          socialChoices: { biscuit: 8 },
        },
        stash: ['tiny_duck', 'sock', 'acorn', 'feather'],
        memory: memory({
          sessionSummary: 'Biscuit is the best one. Barkly has decided and will not be revisiting it.',
          facts: [fact(now, 'person', 'name', 'Caleb', 120, 1), fact(now, 'Biscuit', 'opinion', 'best friend, confirmed', 100, 1)],
          experiences: [
            did(now, 'Biscuit shared a stick. Nobody shares a stick. Nobody.', 100, { withWhom: ['Biscuit'] }),
            did(now, 'Biscuit sat with Barkly through the entire vacuum incident.', 55, { withWhom: ['Biscuit'] }),
            did(now, 'Taught Biscuit the intruder alert. He does it wrong. It is perfect.', 20, { withWhom: ['Biscuit'] }),
          ],
          openThreads: ['giving Biscuit a proper title'],
          trainingRules: [trick(now, 'intruder alert', 'INTRUDER. Where. WHERE.', 22, { timesTriggered: 15 })],
        }),
      }),
  },

  {
    id: 'trickdog',
    name: 'Trick Dog',
    blurb: 'Several learned cues, including the full showtime routine.',
    build: (now) =>
      save(now, {
        wallet: wallet({ coins: 210, xp: 400, owned: ['toy_ball', 'treat_biscuit'], equipped: { toy: 'toy_ball' }, pantry: { treat_biscuit: 9 } }),
        character: { ...freshCharacter(), treasuresFound: 3, socialBonds: { biscuit: bond(now, 'friend', 7, 30) } },
        stash: ['sock', 'button'],
        memory: memory({
          sessionSummary: 'Barkly knows things now. He would like this acknowledged.',
          facts: [fact(now, 'person', 'name', 'Caleb', 45, 1)],
          experiences: [did(now, 'Learned the whole showtime routine in one afternoon. Genius, frankly.', 30)],
          trainingRules: [
            trick(now, 'showtime', 'Showtime. You made me learn choreography.', 30, {
              routine: [
                { speech: 'Spin. Dis is da spin.', actions: ['EXCITED'] },
                { speech: 'Sit. Easy.', actions: ['SIT'] },
                { speech: 'And... dead. I am dead. Dis is a tragedy.', actions: ['SLEEP'] },
              ],
              timesTriggered: 24,
            }),
            trick(now, 'speak', 'BARK. Dat was a bark. Ya asked.', 26, { timesTriggered: 12 }),
            trick(now, 'intruder alert', 'INTRUDER. Where. WHERE.', 18, { timesTriggered: 9 }),
            trick(now, 'be cool', "I'm bein' cool. Dis is me bein' cool.", 8, { timesTriggered: 4 }),
          ],
        }),
      }),
  },

  {
    id: 'goblin',
    name: 'Treasure Goblin',
    blurb: 'A hoard, a favourite, and enough finds to exercise the story systems.',
    build: (now) =>
      save(now, {
        location: 'park',
        wallet: wallet({ coins: 400, xp: 700, owned: ['toy_ball', 'collar_red'], equipped: { collar: 'collar_red' } }),
        character: {
          ...freshCharacter(),
          favoriteTreasure: 'a rock that looks like a duck',
          treasuresFound: 17,
          obsession: { topic: 'what else is buried here', since: now - OBSESSION_DAYS * DAY },
          socialBonds: { biscuit: bond(now, 'friend', 11, 50) },
        },
        stash: [
          'duck_rock', 'good_stick', 'sock', 'half_ball', 'caps', 'acorn', 'glove',
          'button', 'feather', 'tiny_duck', 'map', 'shell', 'sea_glass', 'driftwood',
        ],
        memory: memory({
          sessionSummary: 'Barkly digs. It is not a hobby, it is a calling.',
          facts: [fact(now, 'person', 'name', 'Caleb', 70, 1)],
          experiences: [
            did(now, 'Dug up a rock shaped like a duck. Everything changed that day.', 60, { where: 'Park' }),
            did(now, 'Found a map. Or trash. The investigation is ongoing.', 25, { where: 'Park' }),
          ],
          openThreads: ['what the map leads to'],
        }),
      }),
  },

  {
    id: 'rich',
    name: 'Rich Barkly',
    blurb: 'Coins to burn and most of the shop already his. For testing purchases.',
    build: (now) =>
      save(now, {
        wallet: wallet({
          coins: 9_999,
          xp: 2_600,
          owned: ['collar_red', 'collar_blue', 'collar_green', 'toy_ball', 'toy_rope', 'home_bed', 'home_rug', 'treat_biscuit', 'treat_cheese'],
          equipped: { collar: 'collar_blue', toy: 'toy_ball' },
          placed: ['home_bed', 'home_rug'],
          pantry: { treat_biscuit: 12, treat_cheese: 5 },
        }),
        character: { ...freshCharacter(), treasuresFound: 8, socialBonds: { biscuit: bond(now, 'friend', 12, 60) } },
        stash: ['good_stick', 'sock', 'caps'],
        memory: memory({
          facts: [fact(now, 'person', 'name', 'Caleb', 60, 1)],
          experiences: [did(now, 'Got a rug. Has opinions about the rug.', 10)],
        }),
      }),
  },
];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
