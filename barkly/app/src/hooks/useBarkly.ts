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
import { FEED_LINES, FULL_LINES, PLAY_LINES, pickLine, TIRED_LINES, WAKE_LINES } from '../barkly/lines';
import { BarklyMemory, MemoryState } from '../barkly/memory';
import {
  ambientActions,
  currentSettleMs,
  freshSnapshot,
  isTransient,
  reduce,
} from '../barkly/state';
import { BarklyEvent, BarklySnapshot, BodyAction, isBusy } from '../barkly/types';
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

  startTalk(): Promise<void>;
  stopTalk(): Promise<void>;
  cancelTalk(): Promise<void>;
  /** Keyboard fallback (Expo Go, or mic unavailable): same brain path, typed input. */
  submitText(text: string): Promise<void>;

  /** All of these route through the one speaking lifecycle; they no-op while busy. */
  feed(): Promise<void>;
  play(): Promise<void>;
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
  const [busy, setBusy] = useState(false);
  const [sttAvailable, setSttAvailable] = useState(false);
  const [location, setLocation] = useState<LocationId>('home');
  const [npcBubble, setNpcBubble] = useState<{ id: NpcId; line: string } | null>(null);
  const npcLineCounter = useRef(0);
  const npcBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stash = useMemo(() => new Stash(asyncStorageStore, DEFAULT_PROFILE), []);
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
        // corrupt snapshot: keep the fresh one
      }
      const mem = await memory.load();
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
        // keep home
      }
      const items = await stash.load();
      if (!cancelled) setStashItems(items);
      try {
        const rawChar = await asyncStorageStore.get(CHARACTER_KEY);
        if (!cancelled && rawChar) {
          setCharacter(expireCharacter(JSON.parse(rawChar) as CharacterState, Date.now()));
        }
      } catch {
        // keep a fresh character
      }
      // Anonymous per-install id so the backend can rate-limit and budget.
      await loadDeviceId(asyncStorageStore);
      const available = await providers.stt.isAvailable();
      if (!cancelled) setSttAvailable(available);
    })();
    return () => {
      cancelled = true;
    };
  }, [memory, providers]);

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
    asyncStorageStore.set(SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => {});
  }, [snapshot]);

  useEffect(() => {
    asyncStorageStore.set(CHARACTER_KEY, JSON.stringify(character)).catch(() => {});
  }, [character]);

  // --- Wall-clock decay when app returns to foreground ---
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') dispatch({ type: 'TICK', now: Date.now() });
    });
    return () => sub.remove();
  }, [dispatch]);

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
   * Nothing else may call providers.tts.speak(). That rule is what keeps
   * audio and animation from ever disagreeing about what Barkly is doing.
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
        await providers.tts.speak(line);
      } catch {
        // A silent Barkly beats a Barkly stuck mid-sentence.
      }
      dispatch({ type: 'SPEAK_END' });
      setReplyActions([]);
      if (opts.after) dispatch(opts.after);
    },
    [dispatch, providers],
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
    [dispatch, engine, speak, worldContext],
  );

  const startTalk = useCallback(async () => {
    if (busy) return;
    setError(null);
    if (!permissionGranted.current) {
      permissionGranted.current = await providers.stt.requestPermissions();
      if (!permissionGranted.current) {
        setError('Barkly needs the microphone to hear you.');
        return;
      }
    }
    dispatch({ type: 'TALK_START' });
    setPartialTranscript('');
    try {
      await providers.stt.start({ onPartial: setPartialTranscript });
    } catch (e) {
      dispatch({ type: 'TALK_FAILED' });
      setError(e instanceof Error ? e.message : 'Could not start listening.');
    }
  }, [busy, dispatch, providers]);

  const stopTalk = useCallback(async () => {
    if (snapshotRef.current.state !== 'listening') return;
    const { transcript } = await providers.stt.stop();
    if (!transcript) {
      dispatch({ type: 'TALK_FAILED' });
      setPartialTranscript('');
      return;
    }
    await runExchange(transcript);
  }, [dispatch, providers, runExchange]);

  const cancelTalk = useCallback(async () => {
    await providers.stt.cancel();
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
    setLocation(loc);
    setNpcBubble(null);
    setLastExchange(null); // conversations don't follow him down the street
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

      // Barkly's comeback goes through the same lifecycle as everything else;
      // the SOCIAL event (stats + emotional beat) lands after he finishes.
      speak(npc.barklyLines[i], {
        actions: ['MOUTH_MOVE', 'EAR_PERK'],
        after: { type: 'SOCIAL', friendly: npc.relationship === 'friend' },
      }).catch(() => {});

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
    [busy, memory, speak],
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
    return found;
  }, [busy, memory, speak, stash]);

  // --- feeding, playing and waking also speak, through the same lifecycle ---
  const feed = useCallback(async () => {
    if (busy || isBusy(snapshotRef.current.state)) return;
    const full = snapshotRef.current.stats.hunger < 12;
    await speak(pickLine(full ? FULL_LINES : FEED_LINES), {
      actions: ['MOUTH_MOVE'],
      after: { type: 'FEED' },
    });
  }, [busy, speak]);

  const play = useCallback(async () => {
    if (busy || isBusy(snapshotRef.current.state)) return;
    const tired = snapshotRef.current.stats.energy < 15;
    await speak(pickLine(tired ? TIRED_LINES : PLAY_LINES), {
      actions: tired ? ['SLEEP'] : ['MOUTH_MOVE', 'EXCITED'],
      after: { type: 'PLAY' },
    });
  }, [busy, speak]);

  const sleepToggle = useCallback(async () => {
    if (busy || isBusy(snapshotRef.current.state)) return;
    if (snapshotRef.current.state === 'sleepy') {
      await speak(pickLine(WAKE_LINES), { actions: ['MOUTH_MOVE'], after: { type: 'SLEEP_TOGGLE' } });
      return;
    }
    dispatch({ type: 'SLEEP_TOGGLE' }); // going to sleep needs no commentary
  }, [busy, dispatch, speak]);

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
    },
  };
}
