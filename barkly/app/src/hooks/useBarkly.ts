/**
 * The Barkly interaction layer — the glue hook the UI talks to.
 *
 * Owns: the state machine snapshot (persisted), memory, providers, the
 * talk-flow orchestration (listen → transcribe → think → speak → settle),
 * and the settle timers for transient emotional beats. UI components stay
 * dumb: they render the snapshot and dispatch intents.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DialogueEngine } from '../barkly/dialogue';
import {
  CharacterState,
  expireCharacter,
  freshCharacter,
  INITIATIVE_COOLDOWN_MS,
  noteInitiative,
  pickInitiative,
  withFriend,
  withGrievance,
  withTreasure,
} from '../barkly/character';
import { nameFromFacts, welcomeBack } from '../barkly/greetings';
import { Mishap, mishapLine } from '../barkly/mishaps';
import {
  areaUnlocked,
  buy as buyItem,
  claimDaily,
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
import { BarklyEvent, BarklySnapshot, BodyAction, isBusy } from '../barkly/types';
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
import { Stash, Treasure } from '../world/stash';
import { pickThought } from '../world/thoughts';

const SNAPSHOT_KEY = profileKey(DEFAULT_PROFILE, 'snapshot-v1');
const LOCATION_KEY = profileKey(DEFAULT_PROFILE, 'location-v1');
const CHARACTER_KEY = profileKey(DEFAULT_PROFILE, 'character-v1');
const MUTE_KEY = profileKey(DEFAULT_PROFILE, 'mute-v1');
const ONBOARDING_KEY = profileKey(DEFAULT_PROFILE, 'onboarding-v1');
const WALLET_KEY = profileKey(DEFAULT_PROFILE, 'wallet-v1');
const DEV_KEY = profileKey(DEFAULT_PROFILE, 'dev-v1');

/** Which play routine ran, so the stage can animate the matching one. */
export type PlayRoutine = 'ball' | 'tug' | 'none';

export interface Exchange {
  userText: string;
  barklyText: string;
}

export interface BarklyController {
  snapshot: BarklySnapshot;
  /** Body commands the renderer should express right now. */
  actions: BodyAction[];
  /** Latest completed exchange, for on-screen captions. */
  lastExchange: Exchange | null;
  partialTranscript: string;
  error: string | null;
  busy: boolean; // capturing/thinking/speaking — talk button disabled
  sttAvailable: boolean;
  dialogueProviderName: string;
  /** Which brain answered last, and why — surfaced in Settings. */
  dialogueStatus: () => DialogueStatus;
  /** False in a build with no model configured at all (scripted-only demo). */
  modelConfigured: boolean;
  /** Set when Barkly has dropped to his offline brain; his own words for it. */
  degraded: string | null;
  dismissDegraded(): void;
  /** Coins, XP, what he owns and what he is wearing. */
  wallet: Wallet;
  level: number;
  /** A short-lived toast after earning — a moment, not a banner. */
  reward: { coins: number; xp: number; note?: string } | null;
  /** Buy from the store; returns what he says about it either way. */
  buy(itemId: string): { ok: boolean; line: string };
  equip(itemId: string): void;
  /** False for a place he has not earned yet. */
  isUnlocked(area: string): boolean;
  /** Tint of the collar he is wearing, or null for the canon brown leather. */
  collarColor: string | null;
  /** Home items currently out in the room — several at once, by design. */
  placedHome: string[];
  hasHome(itemId: string): boolean;
  /** The toy he is holding, if any — it drives what "play" actually does. */
  toy: { id: string; name: string; icon: string } | null;
  /** Every level gate open. Off by default; never fabricates progress. */
  devMode: boolean;
  setDevMode(on: boolean): void;
  /** Dev grants: top up, jump a level, hand over one of everything. */
  devGrantCoins(n: number): void;
  devGrantLevel(n: number): void;
  devGrantEverything(): void;
  /** Muted Barkly still takes the right amount of time — quiet, not broken. */
  muted: boolean;
  toggleMuted(): void;
  /** Which link of the voice chain last made the sound. */
  voiceRoute: 'barkly' | 'device' | 'silent' | null;
  /** undefined until storage has been read — render nothing rather than flash. */
  onboarding: OnboardingState | undefined;
  advanceOnboarding(result: ReturnType<typeof advanceOnboarding>): void;

  startTalk(): Promise<void>;
  stopTalk(): Promise<void>;
  cancelTalk(): Promise<void>;
  /** Keyboard fallback (Expo Go, or mic unavailable): same brain path, typed input. */
  submitText(text: string): Promise<void>;

  /** All of these route through the one speaking lifecycle; they no-op while busy. */
  feed(): Promise<void>;
  play(): Promise<PlayRoutine>;
  sleepToggle(): Promise<void>;
  /** User tapped Barkly — a pet/stroke. */
  pet(): void;

  /** Where Barkly is, and travel. */
  location: LocationId;
  goTo(loc: LocationId): void;
  /** Greet another dog; returns false if he's mid-conversation. */
  npcTalk(id: NpcId): boolean;
  /** The other dog's active speech line, shown over that NPC. */
  npcBubble: { id: NpcId; line: string } | null;

  /** Dig at the park; resolves with what he found (null if he's busy). */
  dig(): Promise<Treasure | null>;
  /** Everything he's dug up so far. */
  stashItems: Treasure[];
  /** Current idle thought, if his mind is wandering. */
  thought: string | null;

  memorySnapshot(): MemoryState;
  /** Remove one thing he knows, without wiping the whole relationship. */
  forgetFact(id: string): Promise<void>;
  forgetEverything(): Promise<void>;
}

export function useBarkly(): BarklyController {
  // The resilient dialogue provider reports when it drops to the offline
  // Barkly; the UI says so once, in his voice, rather than silently degrading.
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
  /**
   * Everything a child can see about a failure goes through here, so a raw
   * native message can never reach the screen and a repeated failure does not
   * repeat the same sentence.
   */
  const lastMishap = useRef<string | null>(null);
  const warnedUnwritable = useRef(false);
  // Memory lives outside React state. This counter exists only so that
  // changing it re-renders the hook's consumer, which re-reads
  // memorySnapshot() during render and redraws the Settings list. Nothing
  // reads the number itself, so it is not on the public controller.
  const [, setMemoryVersion] = useState(0);
  /**
   * Credit an action. `useful` is the anti-farming rule: feeding a full dog
   * or playing with an exhausted one pays nothing, because tapping a button
   * at a bored animal is not care.
   */
  /** Whether he may go somewhere. The tab and the handler both ask this. */
  const canGo = useCallback(
    (area: string) => areaUnlocked(area, walletRef.current.xp, devRef.current),
    [],
  );

  const credit = useCallback((kind: EarnKind, useful = true) => {
    setWallet((w) => {
      const result = earn(w, kind, useful);
      if (result.gained.coins === 0 && result.gained.xp === 0) return w;
      walletRef.current = result.wallet;
      const note = result.leveledTo
        ? unlockedAt(result.leveledTo)[0]?.line ?? `Level ${result.leveledTo}.`
        : undefined;
      setReward({ ...result.gained, note });
      if (result.leveledTo) {
        // He announces what just opened up, through the normal speaking path.
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
  const [busy, setBusy] = useState(false);
  const [sttAvailable, setSttAvailable] = useState(false);
  const [location, setLocation] = useState<LocationId>('home');
  const [npcBubble, setNpcBubble] = useState<{ id: NpcId; line: string } | null>(null);
  const npcLineCounter = useRef(0);
  const npcBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stash = useMemo(() => new Stash(asyncStorageStore, DEFAULT_PROFILE), []);

  // The single audio lifecycle: real voice, device voice, silent-but-timed.
  const [muted, setMutedState] = useState(false);
  // undefined = we have not read storage yet, so nothing renders and a
  // returning child never sees a flash of the first-launch screen.
  const [onboarding, setOnboarding] = useState<OnboardingState | undefined>(undefined);
  // Coins, XP, the shop and what he is wearing.
  const [wallet, setWallet] = useState<Wallet>(freshWallet);
  const walletRef = useRef(wallet);
  /** Toast for a level-up or an unlock — a moment, not a number changing. */
  const [reward, setReward] = useState<{ coins: number; xp: number; note?: string } | null>(null);
  /**
   * Dev mode. Off by default, persisted, and it opens every level gate — the
   * person building this should never be locked out of his own app waiting to
   * grind past his own curve. Can also be forced on for a build with
   * EXPO_PUBLIC_BARKLY_DEV=1.
   */
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
  const thoughtSeed = useRef(Math.floor(Math.random() * 1000));

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const permissionGranted = useRef(false);

  const dispatch = useCallback((event: BarklyEvent) => {
    setSnapshot((prev) => {
      const next = reduce(prev, event);
      snapshotRef.current = next;
      return next;
    });
  }, []);

  // --- Load persisted state, apply offline decay, probe STT availability ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let hoursAway = 0;
      // Anything unreadable is not silently shrugged off: Barkly says he has
      // forgotten something, because from the child's side that is the truth.
      let lost = false;
      try {
        const raw = await asyncStorageStore.get(SNAPSHOT_KEY);
        if (!cancelled && raw) {
          const saved = JSON.parse(raw) as BarklySnapshot;
          hoursAway = (Date.now() - saved.updatedAt) / 3_600_000;
          const restored = reduce(
            { ...saved, state: 'idle' },
            { type: 'TICK', now: Date.now() },
          );
          snapshotRef.current = restored;
          setSnapshot(restored);
        }
      } catch {
        lost = true; // corrupt snapshot: keep the fresh one
      }
      let mem: MemoryState;
      try {
        mem = await memory.load();
      } catch {
        // A storage layer that throws must not strand the app half-booted.
        mem = memory.snapshot();
        lost = true;
      }
      // Away a while? Barkly noticed. Greet without a model call so it's
      // instant, then speak it (may be muted by autoplay policies — fine).
      if (!cancelled && hoursAway >= 6) {
        const line = welcomeBack(nameFromFacts(mem.userFacts), Math.floor(hoursAway));
        // Queued rather than awaited: loading must not block on audio.
        if (!cancelled) setPendingGreeting(line);
      }
      try {
        const savedLoc = await asyncStorageStore.get(LOCATION_KEY);
        if (!cancelled && savedLoc && savedLoc in LOCATIONS) setLocation(savedLoc as LocationId);
      } catch {
        lost = true; // keep home
      }
      try {
        const items = await stash.load();
        if (!cancelled) setStashItems(items);
      } catch {
        lost = true; // he keeps digging; the old treasures are gone
      }
      try {
        const rawChar = await asyncStorageStore.get(CHARACTER_KEY);
        if (!cancelled && rawChar) {
          setCharacter(expireCharacter(JSON.parse(rawChar) as CharacterState, Date.now()));
        }
      } catch {
        lost = true; // keep a fresh character
      }
      // First launch? Read this before anything renders.
      try {
        const done = await asyncStorageStore.get(ONBOARDING_KEY);
        if (!cancelled) setOnboarding(done === 'done' ? { step: 'done', micOffered: true } : freshOnboarding());
      } catch {
        // Unreadable storage: treat as a returning child rather than making
        // them do the introduction again on every launch.
        if (!cancelled) setOnboarding({ step: 'done', micOffered: true });
      }
      try {
        const rawDev = await asyncStorageStore.get(DEV_KEY);
        if (!cancelled && rawDev === '1') {
          setDevModeState(true);
          devRef.current = true;
        }
      } catch {
        // stays off
      }
      // Coins and levels, plus the once-a-day bonus for showing up.
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
      // Mute is a parent's setting: it survives a relaunch.
      try {
        const savedMute = await asyncStorageStore.get(MUTE_KEY);
        if (!cancelled && savedMute === '1') {
          setMutedState(true);
          voiceEngine.setMuted(true);
        }
      } catch {
        // keep him audible
      }
      // Anonymous per-install id so the backend can rate-limit and budget.
      await loadDeviceId(asyncStorageStore);
      let available = false;
      try {
        available = await providers.stt.isAvailable();
      } catch {
        available = false; // no recognition here: the UI offers typing instead
      }
      if (!cancelled) {
        setSttAvailable(available);
        if (lost) sayMishap('memory_lost');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memory, providers, sayMishap, voiceEngine]);

  // --- Idle life: occasional small gestures so he never feels frozen ---
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

  // --- Persist snapshot and character on change ---
  useEffect(() => {
    asyncStorageStore.set(SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => {
      // A store that will not accept writes means nothing from this session
      // survives. Say so once rather than losing it quietly.
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

  // The reward toast is a beat, not a banner.
  useEffect(() => {
    if (!reward) return;
    const t = setTimeout(() => setReward(null), 2600);
    return () => clearTimeout(t);
  }, [reward]);

  // --- Wall-clock decay when app returns to foreground ---
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        dispatch({ type: 'TICK', now: Date.now() });
      } else {
        // Nobody wants a dog talking from a pocket.
        voiceEngine.onBackground();
      }
    });
    return () => sub.remove();
  }, [dispatch, voiceEngine]);

  // --- Audio session, once ---
  useEffect(() => {
    void configureAudioSession();
    return () => voiceEngine.stop();
  }, [voiceEngine]);

  // --- Transient states settle back to baseline after their beat ---
  useEffect(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (isTransient(snapshot.state)) {
      // currentSettleMs honors a caller-supplied REACTION durationMs, falling
      // back to the per-state default.
      settleTimer.current = setTimeout(() => dispatch({ type: 'SETTLE' }), currentSettleMs(snapshot));
    }
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [snapshot.state, dispatch]);

  /**
   * THE ONE SPEAKING LIFECYCLE.
   *
   * Every audible Barkly utterance — AI replies, NPC banter, treasure
   * reactions, welcome-backs, feeding and fetch lines — goes through here:
   *
   *   caption + body actions -> SPEAK_START -> TTS -> SPEAK_END -> reaction
   *
   * Nothing else may start audio. That rule, plus the voice engine owning
   * one utterance at a time, is what keeps audio and animation from ever
   * disagreeing about what Barkly is doing.
   */
  const speak = useCallback(
    async (
      text: string,
      opts: {
        /** Shown above the bubble as what the user said, when relevant. */
        userText?: string;
        /** Body commands to hold while speaking. */
        actions?: BodyAction[];
        /** Event dispatched once speech completes (stats + emotional beat). */
        after?: BarklyEvent;
      } = {},
    ): Promise<void> => {
      const line = text.trim();
      if (!line) return;
      setLastExchange({ userText: opts.userText ?? '', barklyText: line });
      setReplyActions(opts.actions ?? []);
      dispatch({ type: 'SPEAK_START' });
      try {
        // The engine never throws and always returns within a deadline, so
        // SPEAK_END below cannot be stranded.
        await voiceEngine.speak(line);
      } catch {
        // A silent Barkly beats a Barkly stuck mid-sentence.
      }
      dispatch({ type: 'SPEAK_END' });
      setReplyActions([]);
      if (opts.after) dispatch(opts.after);
    },
    [dispatch, voiceEngine],
  );

  // A welcome-back queued during load speaks once the hook is live, through
  // the same lifecycle as everything else.
  useEffect(() => {
    if (!pendingGreeting) return;
    setPendingGreeting(null);
    speak(pendingGreeting, { actions: ['TAIL_WAG'] }).catch(() => {});
  }, [pendingGreeting, speak]);

  // --- World context for the dialogue prompt: where he is, who's around ---
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
    };
  }, [stash]);

  // --- idle thoughts: his mind wanders every so often ---
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

  // --- Initiative: Barkly starts conversations, not just answers them ---
  //
  // Driven entirely by his drives, memory and character state (see
  // character.ts) — never a random popup table. Cooldowned, skipped while he
  // is busy or asleep, and routed through the same speaking lifecycle.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        const snap = snapshotRef.current;
        const quiet = !isBusy(snap.state) && snap.state !== 'sleepy' && snap.state !== 'eating';
        if (quiet) {
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
  }, [memory, speak]);

  // --- The core exchange: text in → Barkly speaks + reacts ---
  const runExchange = useCallback(
    async (userText: string) => {
      setBusy(true);
      setError(null);
      dispatch({ type: 'TALK_CAPTURED' }); // thinking
      try {
        const { reply } = await engine.converse(
          userText,
          snapshotRef.current,
          worldContext(),
          characterRef.current,
        );
        if (!reply.speech) {
          dispatch({ type: 'TALK_FAILED' });
          return;
        }
        await speak(reply.speech, {
          userText,
          actions: reply.actions,
          // A model-chosen reaction can only ever be a ReactionState.
          after: reply.reaction ? { type: 'REACTION', state: reply.reaction } : undefined,
        });
        credit('talk');
      } catch (e) {
        dispatch({ type: 'TALK_FAILED' });
        // Never an HTTP status, never a stack trace. A child gets a dog who
        // did not quite catch that.
        setError(barklyLineFor(e));
        if (e instanceof DialogueError && !e.recoverable) setDegraded(e.barklyLine);
      } finally {
        setBusy(false);
        setPartialTranscript('');
      }
    },
    [credit, dispatch, engine, speak, worldContext],
  );

  const startTalk = useCallback(async () => {
    if (busy) return;
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
      // A native speech-engine message is not something a child can act on.
      dispatch({ type: 'TALK_FAILED' });
      sayMishap('mic_broken');
    }
  }, [busy, dispatch, providers, sayMishap]);

  const stopTalk = useCallback(async () => {
    if (snapshotRef.current.state !== 'listening') return;
    let transcript = '';
    try {
      ({ transcript } = await providers.stt.stop());
    } catch {
      // Capture died between start and stop. Leaving him in 'listening'
      // forever is the real failure here, so always come back to idle.
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
    } catch {
      // Cancelling is best-effort; getting back to idle is not.
    }
    dispatch({ type: 'TALK_FAILED' });
    setPartialTranscript('');
  }, [dispatch, providers]);

  const submitText = useCallback(
    async (text: string) => {
      if (busy || !text.trim()) return;
      await runExchange(text.trim());
    },
    [busy, runExchange],
  );

  const goTo = useCallback((loc: LocationId) => {
    // ONE source of truth for "can he go there". This used to re-check
    // without the dev flag, so in dev mode the tab rendered open and then
    // silently refused to move him — the same soft-lock in a new disguise.
    if (!canGo(loc)) return;
    setLocation(loc);
    setNpcBubble(null);
    setLastExchange(null); // conversations don't follow him down the street
    asyncStorageStore.set(LOCATION_KEY, loc).catch(() => {});
  }, [canGo]);

  const npcTalk = useCallback(
    (id: NpcId): boolean => {
      if (busy || isBusy(snapshotRef.current.state)) return false;
      const npc = NPCS[id];
      const i = npcLineCounter.current++ % npc.lines.length;
      setNpcBubble({ id, line: npc.lines[i] });
      if (npcBubbleTimer.current) clearTimeout(npcBubbleTimer.current);
      npcBubbleTimer.current = setTimeout(() => setNpcBubble(null), 4500);

      // Barkly's comeback goes through the same lifecycle as everything else;
      // the SOCIAL event (stats + emotional beat) lands after he finishes.
      speak(npc.barklyLines[i], {
        actions: ['MOUTH_MOVE', 'EAR_PERK'],
        after: { type: 'SOCIAL', friendly: npc.relationship === 'friend' },
      }).catch(() => {});
      credit('friend');

      setCharacter((c) =>
        npc.relationship === 'rival'
          ? withGrievance(c, npc.name, 'was being insufferable at the park', Date.now())
          : withFriend(c, npc.name),
      );

      if (Math.random() < 0.3) {
        const mem = npc.memories[Math.floor(Math.random() * npc.memories.length)];
        memory
          .remember([], [mem], { where: LOCATIONS[locationRef.current].name, withWhom: [npc.name] })
          .catch(() => {});
      }
      return true;
    },
    [busy, credit, memory, speak],
  );

  const dig = useCallback(async (): Promise<Treasure | null> => {
    if (busy || isBusy(snapshotRef.current.state)) return null;
    const found = await stash.dig();
    setStashItems(stash.list());
    setCharacter((c) => withTreasure(c, found.name, Date.now()));
    await speak(`${found.name}?! MINE. This goes in the stash.`, {
      actions: ['MOUTH_MOVE', 'EXCITED'],
      after: { type: 'TREASURE' },
    });
    memory
      .remember([], [`Dug up ${found.name} at the park.`], { where: 'the park' })
      .catch(() => {});
    credit('dig');
    return found;
  }, [busy, credit, memory, speak, stash]);

  // --- feeding, playing and waking also speak, through the same lifecycle ---
  const feed = useCallback(async () => {
    if (busy || isBusy(snapshotRef.current.state)) return;
    const full = snapshotRef.current.stats.hunger < 12;
    await speak(pickLine(full ? FULL_LINES : FEED_LINES), {
      actions: ['MOUTH_MOVE'],
      after: { type: 'FEED' },
    });
    credit('feed', !full); // feeding a full dog is farming, not care
  }, [busy, credit, speak]);

  /**
   * Play, with whatever he actually owns.
   *
   * It used to be one canned line and a stat bump wherever you were, which
   * read as a button that did nothing. Now it depends on the TOY: a ball is
   * thrown and chased, a rope is a tug he intends to win, and with nothing at
   * all he improvises and complains about it. The routine name goes back to
   * the caller so the room can animate the right one.
   */
  const play = useCallback(async (): Promise<PlayRoutine> => {
    if (busy || isBusy(snapshotRef.current.state)) return 'none';
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
    credit('play', true);
    return routine;
  }, [busy, credit, speak]);

  const sleepToggle = useCallback(async () => {
    if (busy || isBusy(snapshotRef.current.state)) return;
    if (snapshotRef.current.state === 'sleepy') {
      await speak(pickLine(WAKE_LINES), { actions: ['MOUTH_MOVE'], after: { type: 'SLEEP_TOGGLE' } });
      return;
    }
    dispatch({ type: 'SLEEP_TOGGLE' }); // going to sleep needs no commentary
  }, [busy, dispatch, speak]);

  /**
   * One beat of the first-launch meeting. The pure part decided WHAT happened;
   * this does the three things that touch the world: remember the name, raise
   * the OS permission prompt, and let him say his first real line.
   */
  const handleOnboarding = useCallback(
    (result: ReturnType<typeof advanceOnboarding>) => {
      setOnboarding(result.state);

      if (result.learnedName) {
        // A real memory fact, not a local variable — so five minutes later he
        // uses it unprompted and the whole premise lands.
        memory
          .remember([`name = ${result.learnedName}`], ['We met. I asked their name.'])
          .catch(() => {});
      }

      if (result.askMicrophone) {
        // Contextual: the OS prompt follows the sentence that asked for it.
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
        // The app never opens cold: he is mid-sentence when the room appears.
        setPendingGreeting(openingLine(result.state));
      }
    },
    [memory, providers],
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
    wallet,
    level: levelFor(wallet.xp),
    reward,
    buy: (itemId: string) => {
      const result = buyItem(walletRef.current, itemId, devRef.current);
      if (result.ok) {
        setWallet(result.wallet);
        walletRef.current = result.wallet;
      }
      // Success or refusal, he says it out loud through the one lifecycle.
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
    dig,
    stashItems,
    thought,
    memorySnapshot: () => memory.snapshot(),
    forgetFact: async (id: string) => {
      await memory.forgetFact(id);
      setMemoryVersion((v) => v + 1);
    },
    forgetEverything: async () => {
      await memory.forgetAll();
      await stash.clear();
      setStashItems([]);
      setCharacter(freshCharacter());
      await asyncStorageStore.remove(CHARACTER_KEY);
      setLastExchange(null);
      // A fresh install identity too - forgetting everything should not leave
      // a stable id behind that the backend can still recognise.
      await resetDeviceId(asyncStorageStore);
      await loadDeviceId(asyncStorageStore);
      // He has forgotten who you are, so he introduces himself again.
      await asyncStorageStore.remove(ONBOARDING_KEY);
      setOnboarding(freshOnboarding());
      const blank = freshWallet();
      setWallet(blank);
      walletRef.current = blank;
      await asyncStorageStore.remove(WALLET_KEY);
    },
  };
}
