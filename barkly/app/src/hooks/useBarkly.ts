/**
 * Barkly interaction layer: state, memory, conversation, voice, world and the
 * relationship that emerges from all of it.
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
import { buildRelationshipProfile, RelationshipProfile } from '../barkly/relationship';
import {
  areaUnlocked,
  buy as buyItem,
  claimDaily,
  earn,
  EarnKind,
  equip as equipItem,
  equippedItem,
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
import { FEED_LINES, FULL_LINES, PLAY_LINES, pickLine, TIRED_LINES, WAKE_LINES } from '../barkly/lines';
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
import { Stash, Treasure } from '../world/stash';
import { pickThought } from '../world/thoughts';

const SNAPSHOT_KEY = profileKey(DEFAULT_PROFILE, 'snapshot-v1');
const LOCATION_KEY = profileKey(DEFAULT_PROFILE, 'location-v1');
const CHARACTER_KEY = profileKey(DEFAULT_PROFILE, 'character-v1');
const MUTE_KEY = profileKey(DEFAULT_PROFILE, 'mute-v1');
const ONBOARDING_KEY = profileKey(DEFAULT_PROFILE, 'onboarding-v1');
const WALLET_KEY = profileKey(DEFAULT_PROFILE, 'wallet-v1');
const DEV_KEY = profileKey(DEFAULT_PROFILE, 'dev-v1');

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
  buy(itemId: string): { ok: boolean; line: string };
  equip(itemId: string): void;
  isUnlocked(area: string): boolean;
  collarColor: string | null;

  /** The legible answer to "what kind of Barkly did I create?" */
  relationship: RelationshipProfile;

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

  feed(): Promise<void>;
  play(): Promise<void>;
  sleepToggle(): Promise<void>;
  pet(): void;

  location: LocationId;
  goTo(loc: LocationId): void;
  npcTalk(id: NpcId): boolean;
  npcBubble: { id: NpcId; line: string } | null;
  dig(): Promise<Treasure | null>;
  stashItems: Treasure[];
  thought: string | null;

  memorySnapshot(): MemoryState;
  forgetFact(id: string): Promise<void>;
  forgetEverything(): Promise<void>;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

  const [busy, setBusy] = useState(false);
  const [sttAvailable, setSttAvailable] = useState(false);
  const [location, setLocation] = useState<LocationId>('home');
  const [npcBubble, setNpcBubble] = useState<{ id: NpcId; line: string } | null>(null);
  const npcLineCounter = useRef(0);
  const npcBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stash = useMemo(() => new Stash(asyncStorageStore, DEFAULT_PROFILE), []);

  const [muted, setMutedState] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState | undefined>(undefined);
  const [wallet, setWallet] = useState<Wallet>(freshWallet);
  const walletRef = useRef(wallet);
  const [reward, setReward] = useState<{ coins: number; xp: number; note?: string } | null>(null);
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
          setCharacter(expireCharacter(JSON.parse(rawChar) as CharacterState, Date.now()));
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memory, providers, sayMishap, stash, voiceEngine]);

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

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') dispatch({ type: 'TICK', now: Date.now() });
      else voiceEngine.onBackground();
    });
    return () => sub.remove();
  }, [dispatch, voiceEngine]);

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

  /**
   * A learned routine is a little performance, not a JSON payload. Each beat
   * gets its own voice/action moment in the order the person taught. This same
   * ordered contract is the path to future servo choreography in the toy.
   */
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

  // ---------------------------------------------------------- conversation
  const runExchange = useCallback(
    async (userText: string) => {
      setBusy(true);
      setError(null);
      dispatch({ type: 'TALK_CAPTURED' });
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
      } catch (e) {
        dispatch({ type: 'TALK_FAILED' });
        setError(barklyLineFor(e));
        if (e instanceof DialogueError && !e.recoverable) setDegraded(e.barklyLine);
      } finally {
        setBusy(false);
        setPartialTranscript('');
      }
    },
    [credit, dispatch, engine, performRoutine, speak, worldContext],
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
      if (busy || !text.trim()) return;
      await runExchange(text.trim());
    },
    [busy, runExchange],
  );

  const goTo = useCallback((loc: LocationId) => {
    if (!areaUnlocked(loc, walletRef.current.xp, devRef.current)) return;
    setLocation(loc);
    setNpcBubble(null);
    setLastExchange(null);
    asyncStorageStore.set(LOCATION_KEY, loc).catch(() => {});
  }, []);

  const npcTalk = useCallback(
    (id: NpcId): boolean => {
      if (busy || isBusy(snapshotRef.current.state)) return false;
      const npc = NPCS[id];
      const i = npcLineCounter.current++ % npc.lines.length;
      setNpcBubble({ id, line: npc.lines[i] });
      if (npcBubbleTimer.current) clearTimeout(npcBubbleTimer.current);
      npcBubbleTimer.current = setTimeout(() => setNpcBubble(null), 4500);

      speak(npc.barklyLines[i], {
        actions: ['MOUTH_MOVE', 'EAR_PERK'],
        after: { type: 'SOCIAL', friendly: npc.relationship === 'friend' },
      }).catch(() => {});
      credit('friend');

      const now = Date.now();
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
      .then(() => setMemoryVersion((v) => v + 1))
      .catch(() => {});
    credit('dig');
    return found;
  }, [busy, credit, memory, speak, stash]);

  const feed = useCallback(async () => {
    if (busy || isBusy(snapshotRef.current.state)) return;
    const full = snapshotRef.current.stats.hunger < 12;
    await speak(pickLine(full ? FULL_LINES : FEED_LINES), {
      actions: ['MOUTH_MOVE'],
      after: { type: 'FEED' },
    });
    credit('feed', !full);
  }, [busy, credit, speak]);

  const play = useCallback(async () => {
    if (busy || isBusy(snapshotRef.current.state)) return;
    const tired = snapshotRef.current.stats.energy < 15;
    await speak(pickLine(tired ? TIRED_LINES : PLAY_LINES), {
      actions: tired ? ['SLEEP'] : ['MOUTH_MOVE', 'EXCITED'],
      after: { type: 'PLAY' },
    });
    credit('play', !tired);
  }, [busy, credit, speak]);

  const sleepToggle = useCallback(async () => {
    if (busy || isBusy(snapshotRef.current.state)) return;
    if (snapshotRef.current.state === 'sleepy') {
      await speak(pickLine(WAKE_LINES), { actions: ['MOUTH_MOVE'], after: { type: 'SLEEP_TOGGLE' } });
      return;
    }
    dispatch({ type: 'SLEEP_TOGGLE' });
  }, [busy, dispatch, speak]);

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

  const actions = useMemo<BodyAction[]>(() => {
    const ambient = ambientActions(snapshot.state);
    const merged =
      replyActions.length > 0 && snapshot.state === 'speaking'
        ? [...ambient, ...replyActions]
        : [...ambient];
    if (idleAction) merged.push(idleAction);
    return Array.from(new Set(merged));
  }, [snapshot.state, replyActions, idleAction]);

  // `memoryVersion` is intentionally read so memory-only updates (a learned
  // trick, new core memory) refresh the Pack Book even when no other UI state moves.
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
    wallet,
    level: levelFor(wallet.xp),
    reward,
    relationship,
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
    isUnlocked: (area: string) => areaUnlocked(area, wallet.xp, devMode),
    collarColor: equippedItem(wallet, 'collar')?.color ?? null,
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
      setMemoryVersion((v) => v + 1);
      await stash.clear();
      setStashItems([]);
      setCharacter(freshCharacter());
      await asyncStorageStore.remove(CHARACTER_KEY);
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
