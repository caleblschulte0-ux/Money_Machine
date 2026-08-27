/**
 * Barkly interaction layer: state, memory, conversation, voice, world and the
 * relationship that emerges from all of it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DialogueEngine } from '../barkly/dialogue';
import {
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
import { nameFromFacts, welcomeBack } from '../barkly/greetings';
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
  areaUnlocked,
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
  unlockedAt,
  Wallet,
} from '../game/progression';
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
import { LOCATIONS, LocationId } from '../world/locations';
import { NPCS, NpcId } from '../world/npcs';
import { DigSite, Stash, Treasure } from '../world/stash';
import { pickThought } from '../world/thoughts';

const SNAPSHOT_KEY = profileKey(DEFAULT_PROFILE, 'snapshot-v1');
const LOCATION_KEY = profileKey(DEFAULT_PROFILE, 'location-v1');
const CHARACTER_KEY = profileKey(DEFAULT_PROFILE, 'character-v1');
const MUTE_KEY = profileKey(DEFAULT_PROFILE, 'mute-v1');
const ONBOARDING_KEY = profileKey(DEFAULT_PROFILE, 'onboarding-v1');
const WALLET_KEY = profileKey(DEFAULT_PROFILE, 'wallet-v1');
const DEV_KEY = profileKey(DEFAULT_PROFILE, 'dev-v1');
const ADVENTURE_KEY = profileKey(DEFAULT_PROFILE, 'adventure-v1');

/** Which play routine ran, so the stage can animate the matching one. */
export type PlayRoutine = 'ball' | 'tug' | 'none';

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
  buy(itemId: string): { ok: boolean; line: string };
  equip(itemId: string): void;
  isUnlocked(area: string): boolean;
  collarColor: string | null;
  /** Home items currently out in the room — several at once, by design. */
  placedHome: string[];
  hasHome(itemId: string): boolean;
  /** The toy he is holding, if any — it drives what "play" actually does. */
  toy: { id: string; name: string; icon: string } | null;

  /** The legible answer to "what kind of Barkly did I create?" */
  relationship: RelationshipProfile;
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

  startTalk(): Promise<void>;
  stopTalk(): Promise<void>;
  cancelTalk(): Promise<void>;
  submitText(text: string): Promise<void>;

  /** All of these route through the one speaking lifecycle; they no-op while busy. */
  /** Optional item id means use a purchased pantry treat instead of the bowl. */
  feed(itemId?: string): Promise<void>;
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
  const npcLineCounter = useRef(0);
  const waveLineCounter = useRef(0);
  const npcBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNpcCredit = useRef<Partial<Record<NpcId, number>>>({});
  const stash = useMemo(() => new Stash(asyncStorageStore, DEFAULT_PROFILE), []);

  const [muted, setMutedState] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState | undefined>(undefined);
  const [wallet, setWallet] = useState<Wallet>(freshWallet);
  const walletRef = useRef(wallet);
  const [reward, setReward] = useState<{ coins: number; xp: number; note?: string } | null>(null);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [devMode, setDevModeState] = useState(process.env.EXPO_PUBLIC_BARKLY_DEV === '1');
  const devRef = useRef(devMode);
  const voiceEngine = useMemo(
    () => createVoiceEngine({ voice: providers.voice, device: providers.tts }),
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
        const unlocked = unlockedAt(result.leveledTo);
        if (unlocked.length > 0) setPendingGreeting(unlocked[0].line);
      }
      return result.wallet;
    });
  }, []);

  const sayMishap = useCallback((kind: Mishap) => {
    const line = mishapLine(kind, lastMishap.current);
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
          const unlocked = unlockedAt(after);
          if (unlocked.length > 0) setPendingGreeting(unlocked[0].line);
        } else {
          setPendingGreeting('Plan complete. Disturbingly productive. We should probably do something pointless now.');
        }
        return nextWallet;
      });
    }

    adventureRef.current = next;
    setAdventure(next);
    asyncStorageStore.set(ADVENTURE_KEY, JSON.stringify(next)).catch(() => {});
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

      if (!cancelled && hoursAway >= 6) {
        setPendingGreeting(welcomeBack(nameFromFacts(mem.userFacts), Math.floor(hoursAway)));
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
        if (!cancelled) setOnboarding(done === 'done' ? { step: 'done', micOffered: true } : freshOnboarding());
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
    })();
    return () => {
      cancelled = true;
    };
  }, [memory, providers, sayMishap, stash, voiceEngine]);

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
      asyncStorageStore.set(ADVENTURE_KEY, JSON.stringify(next)).catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [bootReady, makePlan]);

  // ----------------------------------------------------------- ambient life
  const [idleAction, setIdleAction] = useState<BodyAction | null>(null);
  useEffect(() => {
    const IDLE_STATES = ['idle', 'happy', 'hungry'];
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        if (IDLE_STATES.includes(snapshotRef.current.state)) {
          const pool: BodyAction[] = ['EAR_PERK', 'LOOK_LEFT', 'LOOK_RIGHT', 'TAIL_WAG', 'HEAD_TILT'];
          setIdleAction(pool[Math.floor(Math.random() * pool.length)]);
          setTimeout(() => alive && setIdleAction(null), 2000);
        }
        schedule();
      }, 9000 + Math.random() * 9000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    asyncStorageStore.set(SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => {
      if (!warnedUnwritable.current) {
        warnedUnwritable.current = true;
        sayMishap('memory_unwritable');
      }
    });
  }, [snapshot, sayMishap]);
  useEffect(() => {
    asyncStorageStore.set(CHARACTER_KEY, JSON.stringify(character)).catch(() => {});
  }, [character]);
  useEffect(() => {
    walletRef.current = wallet;
    asyncStorageStore.set(WALLET_KEY, JSON.stringify(wallet)).catch(() => {});
  }, [wallet]);
  useEffect(() => {
    devRef.current = devMode;
    asyncStorageStore.set(DEV_KEY, devMode ? '1' : '0').catch(() => {});
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
          asyncStorageStore.set(ADVENTURE_KEY, JSON.stringify(next)).catch(() => {});
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
      const line = text.trim();
      if (!line) return;
      setLastExchange({ userText: opts.userText ?? '', barklyText: line });
      setReplyActions(opts.actions ?? []);
      dispatch({ type: 'SPEAK_START' });
      try {
        await voiceEngine.speak(line);
      } catch {}
      dispatch({ type: 'SPEAK_END' });
      setReplyActions([]);
      if (opts.after) dispatch(opts.after);
    },
    [dispatch, voiceEngine],
  );

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

  useEffect(() => {
    if (!pendingGreeting) return;
    setPendingGreeting(null);
    speak(pendingGreeting, { actions: ['TAIL_WAG'] }).catch(() => {});
  }, [pendingGreeting, speak]);

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
    let timer: ReturnType<typeof setTimeout>;
    const IDLE_STATES = ['idle', 'happy', 'hungry'];
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        if (IDLE_STATES.includes(snapshotRef.current.state)) {
          thoughtSeed.current += 1;
          setThought(pickThought(locationRef.current, new Date().getHours(), thoughtSeed.current));
          setTimeout(() => alive && setThought(null), 5200);
        }
        schedule();
      }, 22000 + Math.random() * 16000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        const snap = snapshotRef.current;
        const quiet = !isBusy(snap.state) && snap.state !== 'sleepy' && snap.state !== 'eating';
        if (quiet && !activeEncounter) {
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
        schedule();
      }, INITIATIVE_COOLDOWN_MS / 3 + Math.random() * 20000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [activeEncounter, memory, speak]);

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

  const startTalk = useCallback(async () => {
    if (busy || activeEncounter) return;
    setError(null);
    if (!permissionGranted.current) {
      try {
        permissionGranted.current = await providers.stt.requestPermissions();
      } catch {
        permissionGranted.current = false;
      }
      if (!permissionGranted.current) {
        sayMishap('mic_denied');
        return;
      }
    }
    dispatch({ type: 'TALK_START' });
    setPartialTranscript('');
    try {
      await providers.stt.start({ onPartial: setPartialTranscript });
    } catch {
      dispatch({ type: 'TALK_FAILED' });
      sayMishap('mic_broken');
    }
  }, [activeEncounter, busy, dispatch, providers, sayMishap]);

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
      if (busy || activeEncounter || !text.trim()) return;
      await runExchange(text.trim());
    },
    [activeEncounter, busy, runExchange],
  );

  const goTo = useCallback((loc: LocationId) => {
    // ONE source of truth for "can he go there". This used to re-check
    // without the dev flag, so in dev mode the tab rendered open and then
    // silently refused to move him — the same soft-lock in a new disguise.
    if (!canGo(loc)) return;
    const moved = loc !== locationRef.current;
    setLocation(loc);
    locationRef.current = loc;
    setNpcBubble(null);
    setActiveEncounter(null);
    setLastExchange(null);
    asyncStorageStore.set(LOCATION_KEY, loc).catch(() => {});
    if (moved) progressPlan({ kind: 'travel', target: loc });
  }, [canGo, progressPlan]);

  const npcTalk = useCallback(
    (id: NpcId): boolean => {
      if (busy || activeEncounter || isBusy(snapshotRef.current.state)) return false;
      const npc = NPCS[id];
      progressPlan({ kind: 'npc', target: npc.name });
      const current = characterRef.current.socialBonds?.[npc.name]?.encounters ?? 0;
      const chapters = characterRef.current.socialChoices?.[npc.name] ?? 0;
      const nextChoiceAt = 2 + chapters * 3;
      if (current >= nextChoiceAt) {
        setActiveEncounter(deriveSocialEncounter({
          npcId: id,
          character: characterRef.current,
          memory: memory.snapshot(),
        }));
        return true;
      }

      const i = npcLineCounter.current++ % npc.lines.length;
      setNpcBubble({ id, line: npc.lines[i] });
      if (npcBubbleTimer.current) clearTimeout(npcBubbleTimer.current);
      npcBubbleTimer.current = setTimeout(() => setNpcBubble(null), 4500);

      speak(npc.barklyLines[i], {
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

      if (Math.random() < 0.3) {
        const mem = npc.memories[Math.floor(Math.random() * npc.memories.length)];
        memory
          .remember([], [mem], { where: LOCATIONS[locationRef.current].name, withWhom: [npc.name] })
          .then(() => setMemoryVersion((v) => v + 1))
          .catch(() => {});
      }
      return true;
    },
    [activeEncounter, busy, credit, memory, progressPlan, speak],
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
    if (busy || activeEncounter || isBusy(snapshotRef.current.state)) return null;
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
  }, [activeEncounter, busy, credit, memory, progressPlan, speak, stash]);

  /**
   * Chasing the sea. It cannot be caught, which is the joke and also the
   * point: the beach needed a verb of its own, and "fetch, but wetter" would
   * have been a reskin. Pays the same as a round of play.
   */
  const chaseWaves = useCallback(async (): Promise<void> => {
    if (busy || activeEncounter || isBusy(snapshotRef.current.state)) return;
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
  }, [activeEncounter, busy, credit, memory, progressPlan, speak]);

  const feed = useCallback(async (itemId?: string) => {
    if (busy || activeEncounter || isBusy(snapshotRef.current.state)) return;
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
  }, [activeEncounter, busy, credit, memory, progressPlan, speak]);

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
    if (busy || activeEncounter || isBusy(snapshotRef.current.state)) return 'none';
    const tired = snapshotRef.current.stats.energy < 15;
    if (tired) {
      await speak(pickLine(TIRED_LINES), { actions: ['SLEEP'], after: { type: 'PLAY' } });
      credit('play', false);
      return 'none';
    }

    const toy = equippedItem(walletRef.current, 'toy');
    const routine: PlayRoutine =
      toy?.id === 'toy_ball' ? 'ball' : toy?.id === 'toy_rope' ? 'tug' : 'none';
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
  }, [activeEncounter, busy, credit, progressPlan, speak]);

  const sleepToggle = useCallback(async () => {
    if (busy || activeEncounter || isBusy(snapshotRef.current.state)) return;
    if (snapshotRef.current.state === 'sleepy') {
      await speak(pickLine(WAKE_LINES), { actions: ['MOUTH_MOVE'], after: { type: 'SLEEP_TOGGLE' } });
      return;
    }
    dispatch({ type: 'SLEEP_TOGGLE' });
  }, [activeEncounter, busy, dispatch, speak]);

  const handleOnboarding = useCallback(
    (result: ReturnType<typeof advanceOnboarding>) => {
      setOnboarding(result.state);
      if (result.learnedName) {
        memory
          .remember([`name = ${result.learnedName}`], ['We met. I asked their name.'])
          .then(() => setMemoryVersion((v) => v + 1))
          .catch(() => {});
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
        asyncStorageStore.set(ONBOARDING_KEY, 'done').catch(() => {});
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

  void memoryVersion;
  const relationship = buildRelationshipProfile({
    memory: memory.snapshot(),
    stats: snapshot.stats,
    stashCount: stashItems.length,
    character,
  });

  return {
    snapshot,
    actions,
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
      asyncStorageStore.set(MUTE_KEY, next ? '1' : '0').catch(() => {});
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
    collarColor: equippedItem(wallet, 'collar')?.color ?? null,
    placedHome: placedIn(wallet, 'home').map((i) => i.id),
    hasHome: (itemId: string) => isPlaced(wallet, itemId),
    toy: (() => {
      const t = equippedItem(wallet, 'toy');
      return t ? { id: t.id, name: t.name, icon: t.icon } : null;
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
    startTalk,
    stopTalk,
    cancelTalk,
    submitText,
    feed,
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
