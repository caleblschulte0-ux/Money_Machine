/**
 * Barkly interaction layer: state, memory, conversation, voice, world and the
 * relationship that emerges from all of it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DialogueEngine } from '../barkly/dialogue';
import { isInterruptible, isLocked } from '../barkly/types';
import {
  bondFor,
  choicesFor,
  contactSocialBond,
  CharacterState,
  expireCharacter,
  freshCharacter,
  INITIATIVE_COOLDOWN_MS,
  noteInitiative,
  noteSocialChoice,
  pickInitiative,
  withFriend,
  withGrievance,
  withTreasure,
} from '../barkly/character';
import { deriveSocialEncounter, SocialEncounter } from '../barkly/encounters';
import { nameFromFacts, returnGreeting } from '../barkly/greetings';
import { Mishap, mishapLine } from '../barkly/mishaps';
import { buildRelationshipProfile, RelationshipProfile } from '../barkly/relationship';
import { looksLikeTrainingInstruction } from '../barkly/training';
import {
  AdventureEvent,
  AdventureState,
  adventureDay,
  createAdventure,
  PLAN_REWARD,
  progressAdventure,
} from '../game/adventure';
import { contestReward, CONTEST_ROUNDS, ContestRules, ContestState } from '../game/contest';
import { Promotion } from '../barkly/escalation';
import {
  AREA_UNLOCKS,
  areaUnlocked,
  lockedAreaLine,
  buy as buyItem,
  claimDaily,
  consume as consumeItem,
  earn,
  EarnKind,
  equip as equipItem,
  equippedItem,
  isPlaced,
  placedIn,
  freshWallet,
  grantCoins,
  grantEverything,
  grantLevel,
  levelFor,
  STORE,
  levelUpLine,
  unlockedAt,
  Wallet,
} from '../game/progression';
import { parseLocalTrainingInstruction } from '../barkly/training';
import {
  advance as advanceOnboarding,
  freshOnboarding,
  OnboardingState,
  openingLine,
} from '../barkly/onboarding';
import {
  BALL_LINES,
  FEED_LINES,
  FULL_LINES,
  PLAY_LINES,
  pickLine,
  TIRED_LINES,
  TUG_LINES,
  WAKE_LINES,
} from '../barkly/lines';
import { BarklyMemory, MemoryState } from '../barkly/memory';
import {
  ambientActions,
  currentSettleMs,
  freshSnapshot,
  isTransient,
  reduce,
} from '../barkly/state';
import { BarklyEvent, BarklySnapshot, BodyAction, isBusy, RoutineBeat } from '../barkly/types';
import { configureAudioSession } from '../providers/tts/barklyVoiceTts';
import { createVoiceEngine } from '../audio/voiceEngine';
import { loadDeviceId, resetDeviceId } from '../providers/device';
import { DialogueStatus } from '../providers/dialogue/resilient';
import { barklyLineFor, DialogueError } from '../providers/errors';
import { createProviders } from '../providers/registry';
import { asyncStorageStore } from '../storage/asyncStorageStore';
import { DEFAULT_PROFILE, profileKey } from '../storage/types';
import {
  ADVENTURE_KEY,
  CHARACTER_KEY,
  INCIDENT_KEY,
  DEV_KEY,
  LOCATION_KEY,
  MUTE_KEY,
  ONBOARDING_DONE,
  ONBOARDING_KEY,
  SNAPSHOT_KEY,
  VOICE_KEY,
  WALLET_KEY,
} from '../storage/keys';
import { LOCATIONS, LocationId } from '../world/locations';
import { NPCS, NpcId } from '../world/npcs';
import { freshExchangeMemory, pickExchange } from '../world/npcExchange';
import { DigSite, Stash, Treasure } from '../world/stash';
import { HydrationGate } from '../storage/hydration';
import { VoiceShape } from '../providers/tts/expoSpeechTts';
import { pickThought } from '../world/thoughts';
import { bronx } from '../barkly/dialect';
import { BarklyIdentity, deriveBarklyIdentity } from '../barkly/identity';
import {
  deriveWorldIncident,
  IncidentLedger,
  noteIncidentChoice,
  noteIncidentSeen,
  WorldIncident,
} from '../world/incidents';
import { BiographyProp, deriveHomeBiography } from '../world/biography';
import { autonomousSpeechAllowed, nextPlayerFloorUntil } from '../barkly/conversationTurn';

// Every persisted key lives in storage/keys.ts — the playtester writes the
// same list, and a second copy here is how those two silently drift apart.

/** Which play routine ran, so the stage can animate the matching one. */
import { playRoutineFor, PlayRoutine } from '../game/play';
export type { PlayRoutine };

export interface Exchange {
  userText: string;
  barklyText: string;
}

export interface BarklyController {
  snapshot: BarklySnapshot;
  actions: BodyAction[];
  lastExchange: Exchange | null;
  partialTranscript: string;
  error: string | null;
  busy: boolean;
  sttAvailable: boolean;
  dialogueProviderName: string;
  dialogueStatus: () => DialogueStatus;
  modelConfigured: boolean;
  degraded: string | null;
  dismissDegraded(): void;

  wallet: Wallet;
  level: number;
  reward: { coins: number; xp: number; note?: string } | null;
  /** A relationship just crossed a rung. Announce it, then let it clear. */
  promotion: Promotion | null;
  /**
   * Dev stress mode: force every overlay on screen at once so the spacing can
   * be checked against something real rather than imagined. Toggled from
   * Settings; see ui/layout.ts.
   */
  showcase: boolean;
  setShowcase(on: boolean): void;
  /** Device voices to choose from, and the pitch/rate he is shaped with. */
  voices: { id: string; name: string; language: string }[];
  voiceShape: VoiceShape;
  setVoiceShape(next: Partial<VoiceShape>): void;
  previewVoice(): void;
  /**
   * True only when a tap would genuinely be refused — a turn in flight or an
   * open encounter. Deliberately NOT true while he is merely speaking: a tap
   * cuts him off instead, so the buttons stay live. The UI uses this for
   * `disabled`, which is what stops a control from lying about being tappable.
   */
  locked: boolean;
  buy(itemId: string): { ok: boolean; line: string };
  equip(itemId: string): void;
  isUnlocked(area: string): boolean;
  collarId: string | null;
  /** Home items currently out in the room — several at once, by design. */
  placedHome: string[];
  hasHome(itemId: string): boolean;
  /** The toy he is holding, if any — it drives what "play" actually does. */
  toy: { id: string; name: string } | null;

  /** The legible answer to "what kind of Barkly did I create?" */
  relationship: RelationshipProfile;
  /**
   * The live character record, read-only. The screen needs it so the HISTORY
   * can be visible in how the world stands — a best-friend Biscuit posted at
   * the same polite distance as a stranger was the Pack Book describing a
   * relationship the room refused to show.
   */
  character: CharacterState;
  /** What this particular Barkly became, derived from real history. */
  identity: BarklyIdentity;
  /** The room's physical receipts for that history (max five). */
  biography: BiographyProp[];
  /** Something the world started on its own, waiting on the player. */
  activeIncident: WorldIncident | null;
  /**
   * Told by the UI when a sheet is open. The world must not start a subplot
   * over the top of the player browsing the store.
   */
  setWorldPaused: (paused: boolean) => void;
  resolveIncident: (choiceId: string) => Promise<void>;
  dismissIncident: () => void;
  /** Three personalized things Barkly wants to do this session/day. */
  adventure: AdventureState | null;

  /** Every level gate open. Off by default; never fabricates progress. */
  devMode: boolean;
  setDevMode(on: boolean): void;
  devGrantCoins(n: number): void;
  devGrantLevel(n: number): void;
  devGrantEverything(): void;

  muted: boolean;
  toggleMuted(): void;
  voiceRoute: 'barkly' | 'device' | 'silent' | null;
  onboarding: OnboardingState | undefined;
  advanceOnboarding(result: ReturnType<typeof advanceOnboarding>): void;

  /** Explicit player intent wins over Barkly's interruptible speech. */
  claimConversationTurn(): boolean;
  startTalk(): Promise<boolean>;
  stopTalk(): Promise<void>;
  cancelTalk(): Promise<void>;
  submitText(text: string): Promise<void>;

  /** All of these route through the one speaking lifecycle; they no-op while busy. */
  /** Optional item id means use a purchased pantry treat instead of the bowl. */
  feed(itemId?: string): Promise<void>;
  /** What is in the bowl on stage, while a meal is happening. */
  serving: string | null;
  play(): Promise<PlayRoutine>;
  sleepToggle(): Promise<void>;
  pet(): void;

  location: LocationId;
  goTo(loc: LocationId): void;
  npcTalk(id: NpcId): boolean;
  npcBubble: { id: NpcId; line: string } | null;
  /** A choice moment generated from the relationship history, when one is active. */
  activeEncounter: SocialEncounter | null;
  resolveEncounter(choiceId: string): Promise<void>;
  /**
   * Set while a challenge is being SETTLED rather than announced. The room
   * opens the duel; finishContest reports how it went and the outcome — not a
   * fixed script — decides what Barkly says and what gets remembered.
   */
  pendingContest: ContestRules | null;
  finishContest(state: ContestState | null): Promise<void>;
  dismissEncounter(): void;
  dig(): Promise<Treasure | null>;
  /** The beach's own verb: run at the sea, lose, claim the win. */
  chaseWaves(): Promise<void>;
  stashItems: Treasure[];
  thought: string | null;

  memorySnapshot(): MemoryState;
  forgetFact(id: string): Promise<void>;
  forgetEverything(): Promise<void>;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function treatLine(itemId: string): string {
  switch (itemId) {
    case 'treat_steak':
      return 'STEAK? Okay. Nobody move. I need to experience this correctly.';
    case 'treat_cheese':
      return 'Cheese. See, this is why I keep you around.';
    case 'treat_biscuit':
      return 'Biscuit. Classic. Hand it over.';
    default:
      return 'Correct. Food.';
  }
}

export function useBarkly(): BarklyController {
  const [degraded, setDegraded] = useState<string | null>(null);
  const providers = useMemo(
    () => createProviders({ onDialogueFallback: (err) => setDegraded(err.barklyLine) }),
    [],
  );
  const memory = useMemo(() => new BarklyMemory(asyncStorageStore, DEFAULT_PROFILE), []);
  const engine = useMemo(() => new DialogueEngine(providers.dialogue, memory), [providers, memory]);

  const [snapshot, setSnapshot] = useState<BarklySnapshot>(() => freshSnapshot(Date.now()));
  const [replyActions, setReplyActions] = useState<BodyAction[]>([]);
  const [lastExchange, setLastExchange] = useState<Exchange | null>(null);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lastMishap = useRef<string | null>(null);
  const warnedUnwritable = useRef(false);
  const [memoryVersion, setMemoryVersion] = useState(0);
  const [bootReady, setBootReady] = useState(false);
  /**
   * Nothing durable is written until the load pass has run. Without this the
   * save-on-change effects fire once with their DEFAULTS and overwrite the
   * saved profile before the loader ever reads it — which is exactly what was
   * happening, on every launch, to coins, purchases, levels, relationships,
   * his stats and dev mode. See storage/hydration.ts.
   */
  const gate = useRef(new HydrationGate(asyncStorageStore)).current;

  /** Whether he may go somewhere. The tab and the handler both ask this. */
  const canGo = useCallback(
    (area: string) => areaUnlocked(area, walletRef.current.xp, devRef.current),
    [],
  );

  const [busy, setBusy] = useState(false);
  const [sttAvailable, setSttAvailable] = useState(false);
  const [location, setLocation] = useState<LocationId>('home');
  const [npcBubble, setNpcBubble] = useState<{ id: NpcId; line: string } | null>(null);
  const [activeEncounter, setActiveEncounter] = useState<SocialEncounter | null>(null);
  const [pendingContest, setPendingContest] = useState<ContestRules | null>(null);
  /** The choice that opened the duel, held until we know how it went. */
  const contestChoice = useRef<{ encounter: SocialEncounter; choiceId: string } | null>(null);
  /** Won or lost, read once by the resolution that follows. */
  const contestOutcome = useRef<boolean | undefined>(undefined);
  const exchangeMemory = useRef(freshExchangeMemory());
  const waveLineCounter = useRef(0);
  const npcBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNpcCredit = useRef<Partial<Record<NpcId, number>>>({});
  const stash = useMemo(() => new Stash(asyncStorageStore, DEFAULT_PROFILE), []);

  /**
   * THE conversation lock — one derived answer to "is a conversation or scene
   * holding the floor right now?", shared by everything that speaks or thinks
   * unprompted (the queued-greeting drain, ambient thoughts, initiatives).
   *
   * It exists because each of those checked a different SUBSET: the greeting
   * drain checked busy+speaking but not the NPC bubble, so a level-up earned
   * mid-exchange replaced the conclusion of an NPC conversation; the thought
   * timer checked only his body state, so idle thoughts popped over open
   * story scenes (encounter sheets, duels). One definition, one ref for the
   * long-lived timers — never a second ad-hoc copy of this condition.
   */
  const conversationHeld =
    busy ||
    activeEncounter !== null ||
    pendingContest !== null ||
    npcBubble !== null ||
    isBusy(snapshot.state);
  const conversationHeldRef = useRef(conversationHeld);
  conversationHeldRef.current = conversationHeld;
  const [playerFloorUntil, setPlayerFloorUntil] = useState(0);
  const playerFloorUntilRef = useRef(0);

  const [muted, setMutedState] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState | undefined>(undefined);
  const [wallet, setWallet] = useState<Wallet>(freshWallet);
  const walletRef = useRef(wallet);
  const [reward, setReward] = useState<{ coins: number; xp: number; note?: string } | null>(null);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [showcase, setShowcase] = useState(false);
  const [voices, setVoices] = useState<{ id: string; name: string; language: string }[]>([]);
  const [voiceShape, setVoiceShapeState] = useState<VoiceShape>(() => providers.tts.getShape());

  // The installed voices, once, after boot. Enumerating them can be slow and
  /**
   * The NPC bubble's timer outlives the screen.
   *
   * It is a ref, cleared and re-set on each exchange, but nothing cancels it
   * on unmount — so a bubble started 200ms before you close the app fires its
   * `setNpcBubble(null)` into a component that is gone. Harmless today, and
   * exactly the kind of thing that stops being harmless when this hook is
   * mounted twice or a screen is remounted on navigation.
   */
  useEffect(
    () => () => {
      if (npcBubbleTimer.current) clearTimeout(npcBubbleTimer.current);
    },
    [],
  );

  // occasionally never settles, so the provider races it against a timeout.
  useEffect(() => {
    let alive = true;
    providers.tts
      .listVoices()
      .then((list) => {
        if (alive) setVoices(list);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [providers]);

  useEffect(() => {
    const raw = voiceShape;
    providers.tts.setShape(raw);
    gate.write(VOICE_KEY, JSON.stringify(raw)).catch(() => {});
  }, [gate, providers, voiceShape]);

  const setVoiceShape = useCallback((next: Partial<VoiceShape>) => {
    setVoiceShapeState((prev) => ({ ...prev, ...next }));
  }, []);

  /**
   * Which food is in the bowl on stage right now. The bowl draws the food you
   * actually chose (see StageProps.FoodBowl); without this it drew the same
   * kibble for a steak as for dinner, which is the kind of detail a child
   * notices FIRST.
   */
  const [serving, setServing] = useState<string | null>(null);

  /*
   * THE BOWL WAITS UNTIL HE HAS ACTUALLY EATEN FROM IT.
   *
   * This cleared the bowl 1.2s after he was in any state other than eating or
   * speaking -- and between serving the food and his line starting he is
   * briefly IDLE, so the timer fired there and pulled the bowl roughly 2.4s
   * before he ever got to it. Measured: served at 0ms, gone at ~1.2s, `eating`
   * did not begin until ~3.6s. The meal happened over an absent bowl.
   *
   * So the countdown does not start until he has had at least one mouthful.
   */
  const hasEaten = useRef(false);
  useEffect(() => {
    if (!serving) {
      hasEaten.current = false;
      return;
    }
    if (snapshot.state === 'eating') {
      hasEaten.current = true;
      return;
    }
    if (!hasEaten.current) return;
    // A beat after the meal, so the crumbs get seen before the bowl goes.
    const t = setTimeout(() => setServing(null), 1200);
    return () => clearTimeout(t);
  }, [serving, snapshot.state]);

  const [devMode, setDevModeState] = useState(process.env.EXPO_PUBLIC_BARKLY_DEV === '1');
  const devRef = useRef(devMode);
  const voiceEngine = useMemo(
    () => createVoiceEngine({ voices: providers.voices, device: providers.tts }),
    [providers],
  );
  const [stashItems, setStashItems] = useState<Treasure[]>([]);
  const [thought, setThought] = useState<string | null>(null);
  const [pendingGreeting, setPendingGreeting] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterState>(() => freshCharacter());
  const characterRef = useRef(character);
  characterRef.current = character;
  const [adventure, setAdventure] = useState<AdventureState | null>(null);
  const adventureRef = useRef<AdventureState | null>(null);
  const thoughtSeed = useRef(Math.floor(Math.random() * 1000));

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const permissionGranted = useRef(false);

  const credit = useCallback((kind: EarnKind, useful = true, note?: string) => {
    setWallet((w) => {
      const result = earn(w, kind, useful);
      if (result.gained.coins === 0 && result.gained.xp === 0) return w;
      walletRef.current = result.wallet;
      const rewardNote = result.leveledTo
        ? unlockedAt(result.leveledTo)[0]?.line ?? `Level ${result.leveledTo}.`
        : note;
      setReward({ ...result.gained, note: rewardNote });
      if (result.leveledTo) {
        // What he SAYS is his reaction to levelling up. What the notice says
        // is which thing opened. They used to be the identical sentence, so
        // asking him a question could be answered with "Green collar is in
        // the shop now" — the same line already sitting on screen in the
        // reward card. An advert is not a reply.
        setPendingGreeting(levelUpLine(result.leveledTo));
      }
      return result.wallet;
    });
  }, []);

  const sayMishap = useCallback((kind: Mishap) => {
    // Errors are in HIS voice, so they get the accent too — they just do not
    // travel through `speak`, they go to the notice strip.
    const line = bronx(mishapLine(kind, lastMishap.current));
    lastMishap.current = line;
    setError(line);
  }, []);

  const dispatch = useCallback((event: BarklyEvent) => {
    setSnapshot((prev) => {
      const next = reduce(prev, event);
      snapshotRef.current = next;
      return next;
    });
  }, []);

  const makePlan = useCallback((now: number): AdventureState =>
    createAdventure({
      character: characterRef.current,
      memory: memory.snapshot(),
      xp: walletRef.current.xp,
      now,
    }), [memory]);

  const progressPlan = useCallback((event: AdventureEvent) => {
    const current = adventureRef.current;
    if (!current) return;
    const result = progressAdventure(current, event, Date.now());
    if (!result.changed) return;

    let next = result.state;
    if (result.justCompleted && !next.rewarded) {
      next = { ...next, rewarded: true };
      setWallet((w) => {
        const before = levelFor(w.xp);
        const nextWallet: Wallet = {
          ...w,
          coins: w.coins + PLAN_REWARD.coins,
          xp: w.xp + PLAN_REWARD.xp,
        };
        walletRef.current = nextWallet;
        const after = levelFor(nextWallet.xp);
        const leveled = after > before;
        const note = leveled
          ? unlockedAt(after)[0]?.line ?? `Level ${after}.`
          : 'plan complete';
        setReward({ ...PLAN_REWARD, note });
        if (leveled) {
          setPendingGreeting(levelUpLine(after));
        } else {
          setPendingGreeting('Plan complete. Disturbingly productive. We should probably do something pointless now.');
        }
        return nextWallet;
      });
    }

    adventureRef.current = next;
    setAdventure(next);
    gate.write(ADVENTURE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // --------------------------------------------------------------- loading
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let hoursAway = 0;
      let lost = false;
      try {
        const raw = await asyncStorageStore.get(SNAPSHOT_KEY);
        if (!cancelled && raw) {
          const saved = JSON.parse(raw) as BarklySnapshot;
          hoursAway = (Date.now() - saved.updatedAt) / 3_600_000;
          const restored = reduce({ ...saved, state: 'idle' }, { type: 'TICK', now: Date.now() });
          snapshotRef.current = restored;
          setSnapshot(restored);
        }
      } catch {
        lost = true;
      }

      let mem: MemoryState;
      try {
        mem = await memory.load();
      } catch {
        mem = memory.snapshot();
        lost = true;
      }
      setMemoryVersion((v) => v + 1);

      // Any real absence gets acknowledged, not just a six-hour one. Under
      // two minutes returnGreeting says null, so a reload stays silent.
      if (!cancelled) {
        const line = returnGreeting(
          nameFromFacts(mem.userFacts),
          hoursAway * 60,
          Math.floor(Date.now() / 60000),
        );
        if (line) setPendingGreeting(line);
      }

      try {
        const savedLoc = await asyncStorageStore.get(LOCATION_KEY);
        if (!cancelled && savedLoc && savedLoc in LOCATIONS) setLocation(savedLoc as LocationId);
      } catch {
        lost = true;
      }
      try {
        const items = await stash.load();
        if (!cancelled) setStashItems(items);
      } catch {
        lost = true;
      }
      try {
        const rawChar = await asyncStorageStore.get(CHARACTER_KEY);
        if (!cancelled && rawChar) {
          const restoredCharacter = expireCharacter(JSON.parse(rawChar) as CharacterState, Date.now());
          characterRef.current = restoredCharacter;
          setCharacter(restoredCharacter);
        }
      } catch {
        lost = true;
      }
      try {
        const done = await asyncStorageStore.get(ONBOARDING_KEY);
        if (!cancelled) setOnboarding(done === ONBOARDING_DONE ? { step: 'done', micOffered: true } : freshOnboarding());
      } catch {
        if (!cancelled) setOnboarding({ step: 'done', micOffered: true });
      }
      try {
        const rawDev = await asyncStorageStore.get(DEV_KEY);
        if (!cancelled && rawDev === '1') {
          setDevModeState(true);
          devRef.current = true;
        }
      } catch {}
      try {
        const rawWallet = await asyncStorageStore.get(WALLET_KEY);
        const loaded = rawWallet ? (JSON.parse(rawWallet) as Wallet) : freshWallet();
        const daily = claimDaily(loaded, Date.now());
        if (!cancelled) {
          setWallet(daily.wallet);
          walletRef.current = daily.wallet;
          if (daily.claimed) setReward({ ...daily.gained, note: 'Daily visit' });
        }
      } catch {
        lost = true;
      }
      try {
        const rawVoice = await asyncStorageStore.get(VOICE_KEY);
        if (!cancelled && rawVoice) {
          const parsed = JSON.parse(rawVoice) as VoiceShape;
          providers.tts.setShape(parsed);
          setVoiceShapeState(providers.tts.getShape());
        }
      } catch {}
      try {
        const savedMute = await asyncStorageStore.get(MUTE_KEY);
        if (!cancelled && savedMute === '1') {
          setMutedState(true);
          voiceEngine.setMuted(true);
        }
      } catch {}

      await loadDeviceId(asyncStorageStore);
      let available = false;
      try {
        available = await providers.stt.isAvailable();
      } catch {}
      if (!cancelled) {
        setSttAvailable(available);
        if (lost) sayMishap('memory_lost');
        setBootReady(true);
      }
    })()
      .catch(() => {})
      .finally(() => {
        // ALWAYS, including on a boot that threw. A load failure must not
        // leave the app permanently unable to save — that would trade a
        // wipe-on-launch bug for a never-save bug.
        gate.openAfterLoad();
      });
    return () => {
      cancelled = true;
    };
  }, [gate, memory, providers, sayMishap, stash, voiceEngine]);

  useEffect(() => {
    if (!bootReady) return;
    let cancelled = false;
    (async () => {
      const now = Date.now();
      let next: AdventureState | null = null;
      try {
        const raw = await asyncStorageStore.get(ADVENTURE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as AdventureState;
          if (parsed.day === adventureDay(now) && Array.isArray(parsed.goals)) next = parsed;
        }
      } catch {}
      if (!next) next = makePlan(now);
      if (cancelled) return;
      adventureRef.current = next;
      setAdventure(next);
      gate.write(ADVENTURE_KEY, JSON.stringify(next)).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [bootReady, makePlan]);

  // ----------------------------------------------------------- ambient life
  const [idleAction, setIdleAction] = useState<BodyAction | null>(null);
  /**
   * Ambient life. The old schedule waited 9–18 seconds for his FIRST movement,
   * 22–38 for his first thought and up to 53 for his first unprompted line —
   * so the opening half-minute of the app was a still photograph of a dog.
   * For something whose whole proposition is "he is alive when you are not
   * doing anything", the first beat has to land while you are still looking.
   */
  useEffect(() => {
    const IDLE_STATES = ['idle', 'happy', 'hungry'];
    let alive = true;
    let first = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        if (IDLE_STATES.includes(snapshotRef.current.state)) {
          const pool: BodyAction[] = ['EAR_PERK', 'LOOK_LEFT', 'LOOK_RIGHT', 'TAIL_WAG', 'HEAD_TILT'];
          setIdleAction(pool[Math.floor(Math.random() * pool.length)]);
          setTimeout(() => alive && setIdleAction(null), 2000);
        }
        first = false;
        schedule();
      }, first ? 2200 + Math.random() * 2200 : 5000 + Math.random() * 6000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    gate.write(SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => {
      if (!warnedUnwritable.current) {
        warnedUnwritable.current = true;
        sayMishap('memory_unwritable');
      }
    });
  }, [snapshot, sayMishap]);
  useEffect(() => {
    gate.write(CHARACTER_KEY, JSON.stringify(character)).catch(() => {});
  }, [character]);
  useEffect(() => {
    walletRef.current = wallet;
    gate.write(WALLET_KEY, JSON.stringify(wallet)).catch(() => {});
  }, [wallet]);
  useEffect(() => {
    devRef.current = devMode;
    gate.write(DEV_KEY, devMode ? '1' : '0').catch(() => {});
  }, [devMode]);
  useEffect(() => {
    if (!reward) return;
    const timer = setTimeout(() => setReward(null), 2600);
    return () => clearTimeout(timer);
  }, [reward]);

  // A promotion banner stays up longer than a coin toast — it is the payoff
  // for a whole arc, not a receipt.
  useEffect(() => {
    if (!promotion) return;
    const timer = setTimeout(() => setPromotion(null), 5200);
    return () => clearTimeout(timer);
  }, [promotion]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const now = Date.now();
        dispatch({ type: 'TICK', now });
        const currentPlan = adventureRef.current;
        if (currentPlan && currentPlan.day !== adventureDay(now)) {
          const next = makePlan(now);
          adventureRef.current = next;
          setAdventure(next);
          gate.write(ADVENTURE_KEY, JSON.stringify(next)).catch(() => {});
        }
      } else {
        voiceEngine.onBackground();
      }
    });
    return () => sub.remove();
  }, [dispatch, makePlan, voiceEngine]);

  useEffect(() => {
    void configureAudioSession();
    return () => voiceEngine.stop();
  }, [voiceEngine]);

  useEffect(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (isTransient(snapshot.state)) {
      settleTimer.current = setTimeout(() => dispatch({ type: 'SETTLE' }), currentSettleMs(snapshot));
    }
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [snapshot, dispatch]);

  // -------------------------------------------------------------- speaking
  const speak = useCallback(
    async (
      text: string,
      opts: { userText?: string; actions?: BodyAction[]; after?: BarklyEvent } = {},
    ): Promise<void> => {
      /**
       * HIS ACCENT GOES ON HERE, at the one place every utterance passes.
       *
       * Not in the line pools: most of what you hear is composed at runtime
       * from your own words (barkly/compose), so voicing only the written
       * pools would leave the generated majority speaking flat English. One
       * transform at the funnel covers the pools, the composer and any model
       * output alike. See barkly/dialect.
       */
      /**
       * ...and then, if his own voice is all recordings and this exact line is
       * not one of them, the nearest line that IS. Only bites when there is no
       * synthesizer left — see voiceEngine.speakable. The caption below is set
       * from the same string, so he says what the screen says.
       */
      const line = voiceEngine.speakable(bronx(text.trim()));
      if (!line) return;
      setLastExchange({ userText: opts.userText ?? '', barklyText: line });
      setReplyActions(opts.actions ?? []);
      dispatch({ type: 'SPEAK_START' });
      let interrupted = false;
      try {
        const result = await voiceEngine.speak(line);
        interrupted = result.interrupted;
      } catch {}
      dispatch({ type: 'SPEAK_END' });
      setReplyActions([]);
      // If the player cut him off, do not fire a post-line reaction as though
      // the interrupted line completed. The player owns the turn now.
      if (opts.after && !interrupted) dispatch(opts.after);
    },
    [dispatch, voiceEngine],
  );

  /**
   * Claim the floor for a player-initiated action.
   *
   * Returns false when a turn is genuinely in flight (listening / thinking /
   * an open encounter / a request already running) — those must not be torn
   * up mid-way. When he is merely SPEAKING it cuts him off and returns true,
   * because for several seconds after every line the buttons rendered enabled
   * and every handler silently returned. A tap that does nothing and says
   * nothing about why is the single most common way this app felt broken.
   */
  const claimTurn = useCallback((): boolean => {
    if (busy || activeEncounter || pendingContest) return false;
    const state = snapshotRef.current.state;
    if (isLocked(state)) return false;

    // A deliberate player action owns the conversational floor. This is not a
    // mute: Barkly can answer the player normally, but queued greetings,
    // thoughts and initiative cannot immediately start another unprompted beat.
    const until = nextPlayerFloorUntil(Date.now());
    playerFloorUntilRef.current = until;
    setPlayerFloorUntil(until);

    // Whatever autonomous/previous line was occupying the shared surface gets
    // out of the way immediately. A tap on Type should reveal an input, not an
    // old sentence that keeps fighting for the same pixels.
    setThought(null);
    setLastExchange(null);
    setNpcBubble(null);
    if (npcBubbleTimer.current) clearTimeout(npcBubbleTimer.current);

    if (isInterruptible(state)) {
      try {
        voiceEngine.stop();
      } catch {}
      dispatch({ type: 'SPEAK_END' });
      setReplyActions([]);
    }
    return true;
  }, [activeEncounter, busy, dispatch, pendingContest, voiceEngine]);

  /**
   * Say a line in the current shape so a choice can be HEARD before it is
   * kept. Picking a voice from a list of names is guesswork otherwise.
   */
  const previewVoice = useCallback(() => {
    voiceEngine.stop();
    void voiceEngine.speak('Hey. This is me. Say it back and I will judge you.').catch(() => {});
  }, [voiceEngine]);

  const performRoutine = useCallback(
    async (opening: string, userText: string, beats: RoutineBeat[]): Promise<void> => {
      await speak(opening, { userText, actions: ['EAR_PERK', 'TAIL_WAG'] });
      for (const beat of beats) {
        await pause(120);
        await speak(beat.speech, {
          userText,
          actions: beat.actions,
          after: beat.reaction ? { type: 'REACTION', state: beat.reaction } : undefined,
        });
      }
    },
    [speak],
  );

  /**
   * A queued line — a welcome-back, a level-up, a finished plan — waits its
   * turn.
   *
   * This used to fire the instant it was set, which meant a level earned by
   * answering a question replaced the ANSWER: you asked him something, and he
   * announced the shop. It also cut off whatever he was already saying, since
   * `speak` is the one lifecycle and a second call pre-empts the first.
   *
   * The queue is not dropped while he is busy — `pendingGreeting` stays set
   * and `busy` is a dependency, so the effect re-runs and the line lands the
   * moment he is free.
   */
  useEffect(() => {
    if (!pendingGreeting) return;
    // The shared conversation lock, not a local subset of it. The subset
    // (busy + speaking) let a level-up earned by greeting a dog land while
    // the NPC's bubble was still up — replacing the CONCLUSION of that
    // conversation with an announcement. A conversation includes the other
    // dog's half and any open scene, so the queue waits for all of it.
    if (conversationHeld) return;
    // Explicit player intent gets a quiet window. If a queued line exists,
    // keep it queued and wake this effect after the window instead of dropping
    // it or letting it steal the input surface back.
    const now = Date.now();
    if (!autonomousSpeechAllowed(now, playerFloorUntil, false)) {
      const remaining = Math.max(25, playerFloorUntil - now + 25);
      const wake = setTimeout(() => {
        if (playerFloorUntilRef.current === playerFloorUntil) playerFloorUntilRef.current = 0;
        setPlayerFloorUntil((current) => (current === playerFloorUntil ? 0 : current));
      }, remaining);
      return () => clearTimeout(wake);
    }
    // ...and then it waits a beat longer.
    //
    // Waiting for "not busy" alone still cost you the answer: he replied, the
    // turn ended, and the queued line overwrote the reply in the panel about
    // 300ms later — so the question you asked was answered to nobody. A pause
    // lets the reply be read, and it is also just how it goes: you answer the
    // question, then you mention the other thing.
    const t = setTimeout(() => {
      setPendingGreeting(null);
      speak(pendingGreeting, { actions: ['TAIL_WAG'] }).catch(() => {});
    }, 1900);
    return () => clearTimeout(t);
  }, [pendingGreeting, conversationHeld, playerFloorUntil, speak]);

  // --------------------------------------------------------------- world
  const locationRef = useRef(location);
  locationRef.current = location;
  const worldContext = useCallback(() => {
    const loc = LOCATIONS[locationRef.current];
    return {
      locationDescription: loc.description,
      npcs: loc.npcIds.map((id) => ({
        name: NPCS[id].name,
        relationship: NPCS[id].relationship,
        personality: NPCS[id].personality,
      })),
      stashItems: stash.list().slice(-5).map((t) => t.name),
      toy: equippedItem(walletRef.current, 'toy')?.name,
    };
  }, [stash]);

  useEffect(() => {
    let alive = true;
    let firstThought = true;
    let timer: ReturnType<typeof setTimeout>;
    const IDLE_STATES = ['idle', 'happy', 'hungry'];
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        // An idle body is not the same as an idle SCENE: his state reads
        // 'idle' while an encounter sheet or duel is open, which is how
        // ambient thoughts popped over story scenes mid-beat. The shared
        // conversation lock (via ref — this timer outlives renders) is the
        // whole answer; no second condition grows here.
        if (
          IDLE_STATES.includes(snapshotRef.current.state) &&
          autonomousSpeechAllowed(Date.now(), playerFloorUntilRef.current, conversationHeldRef.current)
        ) {
          thoughtSeed.current += 1;
          // His inner voice has the same accent as his outer one.
          setThought(
            bronx(
              pickThought(
                locationRef.current,
                new Date().getHours(),
                thoughtSeed.current,
                memory.snapshot().trainingRules.map((r) => r.cue),
              ),
            ),
          );
          setTimeout(() => alive && setThought(null), 5200);
        }
        firstThought = false;
        schedule();
      }, firstThought ? 7000 + Math.random() * 5000 : 16000 + Math.random() * 14000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let firstBeat = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        const snap = snapshotRef.current;
        const quiet = !isBusy(snap.state) && snap.state !== 'sleepy' && snap.state !== 'eating';
        // Same shared lock as thoughts and queued lines: an initiative is an
        // unprompted line, and unprompted lines wait for open scenes (duels,
        // NPC bubbles) — not just for `activeEncounter`.
        if (
          quiet &&
          autonomousSpeechAllowed(Date.now(), playerFloorUntilRef.current, conversationHeldRef.current)
        ) {
          const mem = memory.snapshot();
          const relevant = memory.relevant();
          const loc = LOCATIONS[locationRef.current];
          const initiative = pickInitiative({
            snapshot: snap,
            facts: relevant.facts,
            experiences: relevant.experiences,
            openThreads: mem.openThreads,
            character: characterRef.current,
            location: loc.name,
            npcsPresent: loc.npcIds.map((id) => NPCS[id].name),
            now: Date.now(),
          });
          if (initiative) {
            setCharacter((c) => noteInitiative(c, initiative.kind, Date.now()));
            speak(initiative.line, { actions: ['MOUTH_MOVE', 'EAR_PERK'] }).catch(() => {});
          }
        }
        firstBeat = false;
        schedule();
      }, firstBeat ? 14000 + Math.random() * 8000 : INITIATIVE_COOLDOWN_MS / 3 + Math.random() * 20000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [memory, speak]);

  // ---------------------------------------------------------- conversation
  const runExchange = useCallback(
    async (userText: string) => {
      setBusy(true);
      setError(null);
      dispatch({ type: 'TALK_CAPTURED' });
      const trainedBefore = !looksLikeTrainingInstruction(userText)
        ? memory.matchTraining(userText)
        : undefined;
      try {
        const { reply } = await engine.converse(
          userText,
          snapshotRef.current,
          worldContext(),
          characterRef.current,
        );
        setMemoryVersion((v) => v + 1);
        if (!reply.speech) {
          dispatch({ type: 'TALK_FAILED' });
          return;
        }
        if ((reply.routine?.length ?? 0) >= 2) {
          await performRoutine(reply.speech, userText, reply.routine!);
        } else {
          await speak(reply.speech, {
            userText,
            actions: reply.actions,
            after: reply.reaction ? { type: 'REACTION', state: reply.reaction } : undefined,
          });
        }
        credit('talk');
        progressPlan({ kind: 'talk' });
        if (trainedBefore) {
          progressPlan({ kind: 'routine', target: trainedBefore.normalizedCue });
        }
      } catch (e) {
        dispatch({ type: 'TALK_FAILED' });
        setError(barklyLineFor(e));
        if (e instanceof DialogueError && !e.recoverable) setDegraded(e.barklyLine);
      } finally {
        setBusy(false);
        setPartialTranscript('');
      }
    },
    [credit, dispatch, engine, memory, performRoutine, progressPlan, speak, worldContext],
  );

  const startTalk = useCallback(async (): Promise<boolean> => {
    // This used to skip claimTurn(), so microphone capture could begin while
    // Barkly's TTS kept talking. Talk now uses the same floor arbitration as
    // every other player action: his interruptible line stops first.
    if (!claimTurn()) return false;
    setError(null);
    if (!permissionGranted.current) {
      try {
        permissionGranted.current = await providers.stt.requestPermissions();
      } catch {
        permissionGranted.current = false;
      }
      if (!permissionGranted.current) {
        sayMishap('mic_denied');
        return false;
      }
    }
    dispatch({ type: 'TALK_START' });
    setPartialTranscript('');
    try {
      await providers.stt.start({ onPartial: setPartialTranscript });
      return true;
    } catch {
      dispatch({ type: 'TALK_FAILED' });
      sayMishap('mic_broken');
      return false;
    }
  }, [claimTurn, dispatch, providers, sayMishap]);

  const stopTalk = useCallback(async () => {
    if (snapshotRef.current.state !== 'listening') return;
    let transcript = '';
    try {
      ({ transcript } = await providers.stt.stop());
    } catch {
      dispatch({ type: 'TALK_FAILED' });
      setPartialTranscript('');
      sayMishap('mic_broken');
      return;
    }
    if (!transcript) {
      dispatch({ type: 'TALK_FAILED' });
      setPartialTranscript('');
      sayMishap('heard_nothing');
      return;
    }
    await runExchange(transcript);
  }, [dispatch, providers, runExchange, sayMishap]);

  const cancelTalk = useCallback(async () => {
    try {
      await providers.stt.cancel();
    } catch {}
    dispatch({ type: 'TALK_FAILED' });
    setPartialTranscript('');
  }, [dispatch, providers]);

  const submitText = useCallback(
    async (text: string) => {
      if (!text.trim() || !claimTurn()) return;
      await runExchange(text.trim());
    },
    [claimTurn, runExchange],
  );

  const goTo = useCallback((loc: LocationId) => {
    // ONE source of truth for "can he go there". This used to re-check
    // without the dev flag, so in dev mode the tab rendered open and then
    // silently refused to move him — the same soft-lock in a new disguise.
    if (!canGo(loc)) {
      // Not a silent refusal. He tells you what the lock wants — same
      // speaking lifecycle as any other line, so the voice and the mouth
      // animation come along with it.
      const need = AREA_UNLOCKS[loc]?.level ?? 1;
      speak(lockedAreaLine(loc, need), { actions: ['MOUTH_MOVE'] }).catch(() => {});
      return;
    }
    const moved = loc !== locationRef.current;
    setLocation(loc);
    locationRef.current = loc;
    setNpcBubble(null);
    setActiveEncounter(null);
    setLastExchange(null);
    // ...and the thought he was having. It lingers for 5.2s, so walking to the
    // park within that window left him standing on the grass thinking "the
    // window shows outside" — a location-aware line, shown in the wrong
    // location, which reads as the character not knowing where he is.
    setThought(null);
    gate.write(LOCATION_KEY, loc).catch(() => {});
    if (moved) progressPlan({ kind: 'travel', target: loc });
  }, [canGo, progressPlan, speak]);

  const npcTalk = useCallback(
    (id: NpcId): boolean => {
      if (!claimTurn()) return false;
      const npc = NPCS[id];
      progressPlan({ kind: 'npc', target: npc.name });
      // Case-insensitive on purpose: preset saves store this dog under its id
      // ('duke'), live play under its display name ('Duke'). The direct key
      // read that used to be here saw 0 encounters on every loaded save, so
      // a recorded nemesis got stranger dialogue and choice moments never
      // unlocked. See character.bondFor.
      const current = bondFor(characterRef.current, npc.name)?.encounters ?? 0;
      const chapters = choicesFor(characterRef.current, npc.name);
      const nextChoiceAt = 2 + chapters * 3;
      if (current >= nextChoiceAt) {
        setActiveEncounter(deriveSocialEncounter({
          npcId: id,
          character: characterRef.current,
          memory: memory.snapshot(),
        }));
        return true;
      }

      // Greeting and reply drawn INDEPENDENTLY, per dog, never repeating the
      // last one. See world/npcExchange for the three bugs this replaces.
      // The bond count selects the STAGE pool, so a best friend and a
      // stranger cannot draw the same line — the flat pool was why weeks of
      // recorded friendship still opened with introductions.
      const exchange = pickExchange(npc, exchangeMemory.current, current);
      exchangeMemory.current = exchange.memory;
      setNpcBubble({ id, line: exchange.npcLine });
      if (npcBubbleTimer.current) clearTimeout(npcBubbleTimer.current);
      npcBubbleTimer.current = setTimeout(() => setNpcBubble(null), 4500);

      speak(exchange.barklyLine, {
        actions: ['MOUTH_MOVE', 'EAR_PERK'],
        after: { type: 'SOCIAL', friendly: npc.relationship === 'friend' },
      }).catch(() => {});

      const now = Date.now();
      const lastPaid = lastNpcCredit.current[id] ?? 0;
      const meaningful = now - lastPaid > 45_000;
      if (meaningful) lastNpcCredit.current[id] = now;
      credit('friend', meaningful);

      setCharacter((c) =>
        npc.relationship === 'rival'
          ? withGrievance(c, npc.name, 'was being insufferable at the park', now)
          : withFriend(c, npc.name, now),
      );

      /*
       * THE FIRST MEETING IS ALWAYS WRITTEN DOWN.
       *
       * The 30% roll is right for the fiftieth trip to the park -- it keeps
       * the memory store from filling up with "saw Duke again". But it was
       * also applied to the very first time a player ever met a dog, so the
       * encounter the whole first session is built around left no narratable
       * memory seven times out of ten. The bond was recorded either way, so
       * nothing looked broken; he simply had nothing to say about it later,
       * which is the one thing that was supposed to happen.
       */
      if (current === 0 || Math.random() < 0.3) {
        const mem = npc.memories[Math.floor(Math.random() * npc.memories.length)];
        memory
          .remember([], [mem], { where: LOCATIONS[locationRef.current].name, withWhom: [npc.name] })
          .then(() => setMemoryVersion((v) => v + 1))
          .catch(() => {});
      }
      return true;
    },
    [claimTurn, credit, memory, progressPlan, speak],
  );

  /**
   * Resolve a choice against an encounter passed in EXPLICITLY.
   *
   * This used to read `activeEncounter` out of the render closure, which is
   * fine when the sheet is on screen and broken when it is not: after a duel,
   * finishContest had to put the encounter back into state and then call in,
   * and the callback it called was still closed over `null`. The sheet
   * reopened and sat there forever with the duel already paid out. Passing the
   * encounter along the call removes the round trip entirely.
   */
  const resolveWith = useCallback(
    async (encounter: SocialEncounter, choiceId: string, playedContest = false): Promise<void> => {
      const choice = encounter.choices.find((candidate) => candidate.id === choiceId);
      if (!choice) return;

      // A contest choice is not answered here — it is PLAYED. Hold it, open
      // the duel, and let finishContest resolve it with the real outcome.
      // `playedContest` is what stops that from looping: the duel is over by
      // the time finishContest calls back in, and the ref it used to check had
      // already been cleared.
      if (choice.contest && !playedContest) {
        contestChoice.current = { encounter, choiceId };
        setActiveEncounter(null);
        setPendingContest({ ...choice.contest, rounds: CONTEST_ROUNDS });
        return;
      }

      const npc = NPCS[encounter.npcId];
      const now = Date.now();
      setActiveEncounter(null);
      setBusy(true);
      setNpcBubble({ id: encounter.npcId, line: choice.npcReply });
      if (npcBubbleTimer.current) clearTimeout(npcBubbleTimer.current);
      npcBubbleTimer.current = setTimeout(() => setNpcBubble(null), 5200);

      // An encounter choice is the thing that PROMOTES a relationship — see
      // barkly/escalation.ts. Casual taps only build pressure, so the moment
      // a dog becomes a nemesis is always a moment the player played through.
      const contact = contactSocialBond(
        characterRef.current,
        npc.name,
        npc.relationship,
        { promotes: true, delta: choice.bondDelta },
        now,
      );
      const crossed = contact.promotion;

      setCharacter(() => {
        let next = noteSocialChoice(contact.character, npc.name);
        if (npc.relationship === 'friend') {
          next = { ...next, favoriteFriend: npc.name };
        } else if (choice.bondDelta > 0) {
          next = { ...next, grievance: { who: npc.name, what: choice.memory, since: now } };
        } else if (choice.bondDelta < 0 && next.grievance?.who === npc.name) {
          const cooled = { ...next };
          delete cooled.grievance;
          next = cooled;
        }
        characterRef.current = next;
        return next;
      });

      try {
        // A settled challenge remembers what actually happened, not the
        // intention. Everything else uses the written line.
        const outcome = contestOutcome.current;
        const memoryLine =
          outcome === undefined
            ? choice.memory
            : (outcome ? choice.wonMemory : choice.lostMemory) ?? choice.memory;
        const replyLine =
          outcome === undefined
            ? choice.barklyReply
            : (outcome ? choice.wonReply : choice.lostReply) ?? choice.barklyReply;
        contestOutcome.current = undefined;

        await memory.remember([], [memoryLine], {
          where: LOCATIONS[locationRef.current].name,
          withWhom: [npc.name],
        });
        setMemoryVersion((v) => v + 1);

        await speak(replyLine, {
          actions: choice.actions,
          after: { type: 'SOCIAL', friendly: npc.relationship === 'friend' },
        });

        // The relationship moved a rung. Say so, show so, and write it down —
        // an escalation nobody witnessed is a counter, not a story.
        if (crossed) {
          setPromotion(crossed);
          await pause(220);
          await speak(crossed.line, {
            actions: crossed.kind === 'rival' ? ['EAR_PERK', 'EXCITED'] : ['TAIL_WAG', 'EAR_PERK'],
            after: { type: 'SOCIAL', friendly: crossed.kind === 'friend' },
          });
          memory
            .remember([], [`${crossed.who} went from ${crossed.fromLabel} to ${crossed.toLabel}.`], {
              where: LOCATIONS[locationRef.current].name,
              withWhom: [crossed.who],
            })
            .then(() => setMemoryVersion((v) => v + 1))
            .catch(() => {});
        }

        if (choice.routineCue) {
          const learned = memory.matchTraining(choice.routineCue);
          if (learned?.routine && learned.routine.length >= 2) {
            await pause(150);
            await performRoutine(learned.speech, '', learned.routine);
          } else if (learned) {
            await pause(150);
            await speak(learned.speech, {
              actions: learned.actions,
              after: learned.reaction ? { type: 'REACTION', state: learned.reaction } : undefined,
            });
          }
          if (learned) progressPlan({ kind: 'routine', target: learned.normalizedCue });
        }
        credit('friend', true, 'story moved');
        progressPlan({ kind: 'npc', target: npc.name });
      } finally {
        setBusy(false);
      }
    },
    [credit, memory, performRoutine, progressPlan, speak],
  );

  const resolveEncounter = useCallback(
    async (choiceId: string): Promise<void> => {
      if (!activeEncounter || busy) return;
      await resolveWith(activeEncounter, choiceId);
    },
    [activeEncounter, busy, resolveWith],
  );

  /**
   * Dig, at whichever site he is standing on. The beach has its own pool of
   * finds — unlocking a place that hands you the same fourteen park objects
   * is a new background, not a new place.
   */
  const dig = useCallback(async (): Promise<Treasure | null> => {
    if (!claimTurn()) return null;
    const site: DigSite = locationRef.current === 'beach' ? 'beach' : 'park';
    const found = await stash.dig(site);
    setStashItems(stash.list());
    setCharacter((c) => withTreasure(c, found.name, Date.now()));
    await speak(
      site === 'beach'
        ? `${found.name}. The sea just gives these away. Amateur.`
        : `${found.name}?! MINE. This goes in the stash.`,
      { actions: ['MOUTH_MOVE', 'EXCITED'], after: { type: 'TREASURE' } },
    );
    const where = site === 'beach' ? 'the beach' : 'the park';
    memory
      .remember([], [site === 'beach' ? `Found ${found.name} in the wet sand at the beach.` : `Dug up ${found.name} at the park.`], { where })
      .then(() => setMemoryVersion((v) => v + 1))
      .catch(() => {});
    credit('dig');
    progressPlan({ kind: 'dig' });
    return found;
  }, [claimTurn, credit, memory, progressPlan, speak, stash]);

  /**
   * Chasing the sea. It cannot be caught, which is the joke and also the
   * point: the beach needed a verb of its own, and "fetch, but wetter" would
   * have been a reskin. Pays the same as a round of play.
   */
  const chaseWaves = useCallback(async (): Promise<void> => {
    if (!claimTurn()) return;
    const lines = [
      'It ran away. It always runs away. I am UNDEFEATED and also soaked.',
      'I have chased that water back into the sea. You are welcome, everyone.',
      'Every time I get close it leaves. This is the most interesting thing here.',
      'I bit the sea. The sea did nothing. Cowardly.',
      'Wave: retreated. Barkly: victorious. Paws: regrettably wet.',
    ];
    const line = lines[waveLineCounter.current++ % lines.length];
    await speak(line, { actions: ['EXCITED', 'TAIL_WAG'], after: { type: 'PLAY' } });
    memory
      .remember([], ['Chased the waves at the beach and declared it a win.'], { where: 'the beach' })
      .then(() => setMemoryVersion((v) => v + 1))
      .catch(() => {});
    credit('play');
    progressPlan({ kind: 'play' });
  }, [claimTurn, credit, memory, progressPlan, speak]);

  const feed = useCallback(async (itemId?: string) => {
    if (!claimTurn()) return;
    setServing(itemId ?? 'dinner');
    const full = snapshotRef.current.stats.hunger < 12;

    if (itemId) {
      const item = STORE.find((candidate) => candidate.id === itemId && candidate.slot === 'treat');
      if (!item) return;
      if (full) {
        await speak(`Save the ${item.name.toLowerCase()}. I am full enough to make a responsible decision, apparently.`, {
          actions: ['HEAD_TILT'],
        });
        return;
      }
      const nextWallet = consumeItem(walletRef.current, item.id);
      if (!nextWallet) {
        await speak(`We're out of ${item.name.toLowerCase()}. This cupboard has betrayed me.`, { actions: ['LOOK_LEFT'] });
        return;
      }
      walletRef.current = nextWallet;
      setWallet(nextWallet);
      await speak(treatLine(item.id), {
        actions: ['MOUTH_MOVE', 'TAIL_WAG'],
        after: { type: 'FEED' },
      });
      memory
        .remember([], [`You gave Barkly ${item.name}. He considered this an important event.`], {
          where: LOCATIONS[locationRef.current].name,
        })
        .then(() => setMemoryVersion((v) => v + 1))
        .catch(() => {});
      credit('feed', true, item.name.toLowerCase());
      progressPlan({ kind: 'feed' });
      return;
    }

    await speak(pickLine(full ? FULL_LINES : FEED_LINES), {
      actions: ['MOUTH_MOVE'],
      after: { type: 'FEED' },
    });
    credit('feed', !full);
    if (!full) progressPlan({ kind: 'feed' });
  }, [claimTurn, credit, memory, progressPlan, speak]);

  /**
   * Play, with whatever he actually owns.
   *
   * It used to be one canned line and a stat bump wherever you were, which
   * read as a button that did nothing. Now it depends on the TOY: a ball is
   * thrown and chased, a rope is a tug he intends to win, and with nothing at
   * all he improvises. The routine name goes back to the caller so the room
   * can animate the right one.
   */
  const play = useCallback(async (): Promise<PlayRoutine> => {
    if (!claimTurn()) return 'none';
    const tired = snapshotRef.current.stats.energy < 15;
    if (tired) {
      await speak(pickLine(TIRED_LINES), { actions: ['SLEEP'], after: { type: 'PLAY' } });
      credit('play', false);
      return 'none';
    }

    // The same decision the button was labelled from — see game/play. It used
    // to be a second copy of the rule here, which is how the screen and the
    // hook were able to disagree about what he was doing.
    const toy = equippedItem(walletRef.current, 'toy');
    const routine: PlayRoutine = playRoutineFor(toy?.id, locationRef.current);
    const line =
      routine === 'ball'
        ? pickLine(BALL_LINES)
        : routine === 'tug'
          ? pickLine(TUG_LINES)
          : pickLine(PLAY_LINES);

    await speak(line, {
      actions: routine === 'tug' ? ['MOUTH_MOVE', 'HEAD_TILT'] : ['MOUTH_MOVE', 'EXCITED'],
      after: { type: 'PLAY' },
    });
    credit('play', true, toy ? 'favorite toy time' : undefined);
    progressPlan({ kind: 'play' });
    return routine;
  }, [claimTurn, credit, progressPlan, speak]);

  const sleepToggle = useCallback(async () => {
    if (!claimTurn()) return;
    if (snapshotRef.current.state === 'sleepy') {
      await speak(pickLine(WAKE_LINES), { actions: ['MOUTH_MOVE'], after: { type: 'SLEEP_TOGGLE' } });
      return;
    }
    // Whatever he last said, he is not saying it any more — he is asleep. The
    // dialogue panel keeps showing the last exchange until something clears
    // it, so without this he naps under a speech panel still quoting him
    // shouting about a rock that looks like a duck.
    setLastExchange(null);
    dispatch({ type: 'SLEEP_TOGGLE' });
  }, [claimTurn, dispatch, speak]);

  const handleOnboarding = useCallback(
    (result: ReturnType<typeof advanceOnboarding>) => {
      setOnboarding(result.state);
      if (result.learnedName) {
        memory
          .remember([`name = ${result.learnedName}`], ['We met. I asked their name.'])
          .then(() => setMemoryVersion((v) => v + 1))
          .catch(() => {});
      }
      /*
       * The onboarding cue becomes a REAL training rule, built by the same
       * parser a mid-conversation "when I say X, Y" goes through -- not a
       * hand-rolled rule that happens to look similar. Two constructors for
       * the same object is how the onboarding trick ends up subtly different
       * from every other trick (different fields, different matching), and
       * the whole promise is that this one is not special: it is the first
       * of many, stored in the same place, and it is still there tomorrow.
       */
      if (result.learnedCue) {
        const rule = parseLocalTrainingInstruction(`when I say ${result.learnedCue}, play dead`);
        if (rule) {
          memory
            .learnTraining([rule])
            .then(() =>
              memory.remember([], [`They taught me “${rule.cue}” the day we met.`]),
            )
            .then(() => setMemoryVersion((v) => v + 1))
            .catch(() => {});
        }
      }
      if (result.askMicrophone) {
        providers.stt
          .requestPermissions()
          .then((granted) => {
            permissionGranted.current = granted;
          })
          .catch(() => {
            permissionGranted.current = false;
          });
      }
      if (result.finished) {
        gate.write(ONBOARDING_KEY, ONBOARDING_DONE).catch(() => {});
        setPendingGreeting(openingLine(result.state));
      }
    },
    [memory, providers],
  );

  /**
   * The duel is over. Pay for it, say the line the OUTCOME earned, and then
   * resolve the encounter that opened it — so a challenge ends in a result
   * rather than an announcement.
   */
  const finishContest = useCallback(
    async (result: ContestState | null): Promise<void> => {
      const held = contestChoice.current;
      contestChoice.current = null;
      setPendingContest(null);
      if (!held) return;

      // Backing out of a duel is allowed and costs nothing; the encounter
      // simply resolves on its written line.
      if (result?.done) {
        contestOutcome.current = Boolean(result.won);
        const prize = contestReward(result);
        if (prize.coins > 0) {
          setWallet((w) => {
            const next = grantCoins({ ...w, xp: w.xp + prize.xp }, prize.coins);
            walletRef.current = next;
            return next;
          });
          setReward({ ...prize, note: result.won ? 'won the duel' : 'good effort' });
        }
      }

      // Resolve directly against the held encounter. Putting it back into
      // state first and calling the public entry point looked tidier and left
      // the sheet stranded on screen — see resolveWith.
      await resolveWith(held.encounter, held.choiceId, true);
    },
    [resolveWith],
  );

  const actions = useMemo<BodyAction[]>(() => {
    const ambient = ambientActions(snapshot.state);
    const merged =
      replyActions.length > 0 && snapshot.state === 'speaking'
        ? [...ambient, ...replyActions]
        : [...ambient];
    if (idleAction) merged.push(idleAction);
    return Array.from(new Set(merged));
  }, [snapshot.state, replyActions, idleAction]);

  // ------------------------------------------------------------- incidents
  //
  // Everything else in this app begins because the player tapped something.
  // An incident begins because the world noticed the history you two built:
  // Duke has opinions about your treasure, Biscuit lost the stick that matters,
  // the bit you invented at home followed you outside. The ledger is durable
  // and keyed by incident id, so a beat that already fired stays fired across
  // restarts instead of greeting the player again every launch.
  const [incidentLedger, setIncidentLedger] = useState<IncidentLedger>({});
  const incidentLedgerRef = useRef<IncidentLedger>({});
  const [activeIncident, setActiveIncident] = useState<WorldIncident | null>(null);
  // Any open sheet pauses the world. An incident that fires while the player
  // is mid-tap in the store does not read as life -- it reads as the app
  // stealing the tap, which is exactly what the acceptance walkthrough hit.
  const [worldPaused, setWorldPaused] = useState(false);
  // State, not a ref: the derive effect below has to RE-RUN when the ledger
  // finishes loading. Gating it on a ref meant that if every other dependency
  // had already settled by the time hydration finished, nothing re-triggered
  // and the world stayed silent forever.
  const [incidentHydrated, setIncidentHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded: IncidentLedger = {};
      try {
        const raw = await asyncStorageStore.get(INCIDENT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as IncidentLedger;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) loaded = parsed;
        }
      } catch {
        loaded = {};
      }
      if (cancelled) return;
      incidentLedgerRef.current = loaded;
      setIncidentLedger(loaded);
      setIncidentHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const writeIncidentLedger = useCallback((next: IncidentLedger) => {
    incidentLedgerRef.current = next;
    setIncidentLedger(next);
    gate.write(INCIDENT_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // The world only speaks up when nothing else is: no sheet, no encounter, no
  // conversation in progress, and he is not mid-anything. A dog interrupting
  // your sentence to start a subplot is a bug, not life.
  useEffect(() => {
    // `onboarding` is a durable record, not an in-progress flag -- it stays a
    // truthy object forever once the welcome flow is done. Only step === 'done'
    // means the player is actually in the world.
    if (!incidentHydrated || activeIncident || worldPaused || onboarding?.step !== 'done') return;
    if (conversationHeld || snapshotRef.current.state === 'sleepy') return;
    const timer = setTimeout(() => {
      if (conversationHeldRef.current) return;
      const next = deriveWorldIncident({
        location: locationRef.current,
        character: characterRef.current,
        memory: memory.snapshot(),
        ledger: incidentLedgerRef.current,
        now: Date.now(),
      });
      if (!next) return;
      setActiveIncident(next);
      writeIncidentLedger(noteIncidentSeen(incidentLedgerRef.current, next, Date.now()));
      // Long enough that arriving somewhere feels like arriving, not like
      // walking into a cutscene trigger.
    }, 4200);
    return () => clearTimeout(timer);
  }, [activeIncident, conversationHeld, incidentHydrated, location, memoryVersion, onboarding, memory, worldPaused, writeIncidentLedger]);

  const dismissIncident = useCallback(() => setActiveIncident(null), []);

  const resolveIncident = useCallback(
    async (choiceId: string): Promise<void> => {
      const incident = activeIncident;
      if (!incident || busy) return;
      const choice = incident.choices.find((c) => c.id === choiceId);
      if (!choice) return;
      setActiveIncident(null);
      writeIncidentLedger(noteIncidentChoice(incidentLedgerRef.current, incident.id, choiceId));
      setBusy(true);
      try {
        await speak(choice.barklyLine, {
          actions: incident.kind === 'rival-provokes' ? ['EAR_PERK', 'EXCITED'] : ['EAR_PERK'],
        });
        // The choice becomes history, so identity and the room can read it
        // back later. This is the whole point: a decision you made once shows
        // up in who he is afterwards.
        memory
          .remember([], [choice.memory], {
            where: LOCATIONS[incident.location].name,
            withWhom: incident.actor ? [NPCS[incident.actor].name] : [],
          })
          .then(() => setMemoryVersion((v) => v + 1))
          .catch(() => {});
        if (choice.bondDelta && incident.actor) {
          const who = NPCS[incident.actor].name;
          setCharacter((c) => noteSocialChoice(c, who));
        }
      } finally {
        setBusy(false);
      }
    },
    [activeIncident, busy, memory, speak, writeIncidentLedger],
  );

  void memoryVersion;
  const relationship = buildRelationshipProfile({
    memory: memory.snapshot(),
    stats: snapshot.stats,
    stashCount: stashItems.length,
    character,
  });

  // Who he became, and the physical evidence of it. Both are pure derivations
  // over history that is already persisted (memory + character), so there is
  // no new save state to keep in sync and no way for them to disagree with
  // what actually happened. memoryVersion is the memory store's change
  // counter -- it is what makes these recompute when a fact or ritual lands.
  const identity: BarklyIdentity = useMemo(
    () => deriveBarklyIdentity({ memory: memory.snapshot(), stats: snapshot.stats, character }),
    [memory, memoryVersion, snapshot.stats, character],
  );
  const biography: BiographyProp[] = useMemo(
    () => deriveHomeBiography({ character, memory: memory.snapshot() }),
    [character, memory, memoryVersion],
  );

  return {
    snapshot,
    actions,
    character,
    identity,
    biography,
    activeIncident,
    setWorldPaused,
    resolveIncident,
    dismissIncident,
    lastExchange,
    partialTranscript,
    error,
    busy,
    sttAvailable,
    dialogueProviderName: engine.providerName,
    dialogueStatus: providers.dialogueStatus,
    modelConfigured: providers.modelConfigured,
    degraded,
    dismissDegraded: () => setDegraded(null),
    muted,
    toggleMuted: () => {
      const next = !muted;
      setMutedState(next);
      voiceEngine.setMuted(next);
      gate.write(MUTE_KEY, next ? '1' : '0').catch(() => {});
    },
    voiceRoute: voiceEngine.lastRoute,
    onboarding,
    advanceOnboarding: handleOnboarding,
    pendingContest,
    finishContest,
    wallet,
    level: levelFor(wallet.xp),
    reward,
    promotion,
    showcase,
    setShowcase,
    voices,
    voiceShape,
    setVoiceShape,
    previewVoice,
    locked: busy || activeEncounter !== null || isLocked(snapshot.state),
    relationship,
    adventure,
    buy: (itemId: string) => {
      const result = buyItem(walletRef.current, itemId, devRef.current);
      if (result.ok) {
        setWallet(result.wallet);
        walletRef.current = result.wallet;
      }
      speak(result.line, { actions: ['MOUTH_MOVE'] }).catch(() => {});
      return { ok: result.ok, line: result.line };
    },
    equip: (itemId: string) => {
      const next = equipItem(walletRef.current, itemId);
      setWallet(next);
      walletRef.current = next;
    },
    isUnlocked: canGo,
    collarId: equippedItem(wallet, 'collar')?.id ?? null,
    placedHome: placedIn(wallet, 'home').map((i) => i.id),
    hasHome: (itemId: string) => isPlaced(wallet, itemId),
    toy: (() => {
      const t = equippedItem(wallet, 'toy');
      return t ? { id: t.id, name: t.name } : null;
    })(),
    devMode,
    setDevMode: setDevModeState,
    devGrantCoins: (n: number) => {
      const next = grantCoins(walletRef.current, n);
      setWallet(next);
      walletRef.current = next;
      setReward({ coins: n, xp: 0, note: 'dev' });
    },
    devGrantLevel: (n: number) => {
      const before = walletRef.current.xp;
      const next = grantLevel(walletRef.current, n);
      setWallet(next);
      walletRef.current = next;
      setReward({ coins: 0, xp: next.xp - before, note: `dev · level ${n}` });
    },
    devGrantEverything: () => {
      const next = grantEverything(walletRef.current);
      setWallet(next);
      walletRef.current = next;
      setReward({ coins: 0, xp: 0, note: 'dev · everything' });
    },
    claimConversationTurn: claimTurn,
    startTalk,
    stopTalk,
    cancelTalk,
    submitText,
    feed,
    serving,
    play,
    sleepToggle,
    pet: () => dispatch({ type: 'PET' }),
    location,
    goTo,
    npcTalk,
    npcBubble,
    activeEncounter,
    resolveEncounter,
    dismissEncounter: () => setActiveEncounter(null),
    dig,
    chaseWaves,
    stashItems,
    thought,
    memorySnapshot: () => memory.snapshot(),
    forgetFact: async (id: string) => {
      await memory.forgetFact(id);
      setMemoryVersion((v) => v + 1);
    },
    forgetEverything: async () => {
      await memory.forgetAll();
      setMemoryVersion((v) => v + 1);
      await stash.clear();
      setStashItems([]);
      setActiveEncounter(null);
      setAdventure(null);
      adventureRef.current = null;
      setCharacter(freshCharacter());
      await asyncStorageStore.remove(CHARACTER_KEY);
      await asyncStorageStore.remove(ADVENTURE_KEY);
      setLastExchange(null);
      await resetDeviceId(asyncStorageStore);
      await loadDeviceId(asyncStorageStore);
      await asyncStorageStore.remove(ONBOARDING_KEY);
      setOnboarding(freshOnboarding());
      const blank = freshWallet();
      setWallet(blank);
      walletRef.current = blank;
      await asyncStorageStore.remove(WALLET_KEY);
    },
  };
}
