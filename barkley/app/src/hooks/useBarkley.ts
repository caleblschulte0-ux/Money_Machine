/**
 * The Barkley interaction layer — the glue hook the UI talks to.
 *
 * Owns: the state machine snapshot (persisted), memory, providers, the
 * talk-flow orchestration (listen → transcribe → think → speak → settle),
 * and the settle timers for transient emotional beats. UI components stay
 * dumb: they render the snapshot and dispatch intents.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DialogueEngine } from '../barkley/dialogue';
import { BarkleyMemory, MemoryState } from '../barkley/memory';
import {
  ambientActions,
  freshSnapshot,
  isTransient,
  reduce,
  settleDelayMs,
} from '../barkley/state';
import { BarkleyEvent, BarkleySnapshot, BodyAction } from '../barkley/types';
import { createProviders } from '../providers/registry';
import { asyncStorageStore } from '../storage/asyncStorageStore';
import { DEFAULT_PROFILE, profileKey } from '../storage/types';

const SNAPSHOT_KEY = profileKey(DEFAULT_PROFILE, 'snapshot-v1');

export interface Exchange {
  userText: string;
  barkleyText: string;
}

export interface BarkleyController {
  snapshot: BarkleySnapshot;
  /** Body commands the renderer should express right now. */
  actions: BodyAction[];
  /** Latest completed exchange, for on-screen captions. */
  lastExchange: Exchange | null;
  partialTranscript: string;
  error: string | null;
  busy: boolean; // capturing/thinking/speaking — talk button disabled
  sttAvailable: boolean;
  dialogueProviderName: string;

  startTalk(): Promise<void>;
  stopTalk(): Promise<void>;
  cancelTalk(): Promise<void>;
  /** Keyboard fallback (Expo Go, or mic unavailable): same brain path, typed input. */
  submitText(text: string): Promise<void>;

  feed(): void;
  play(): void;
  sleepToggle(): void;

  memorySnapshot(): MemoryState;
  forgetEverything(): Promise<void>;
}

export function useBarkley(): BarkleyController {
  const providers = useMemo(() => createProviders(), []);
  const memory = useMemo(() => new BarkleyMemory(asyncStorageStore, DEFAULT_PROFILE), []);
  const engine = useMemo(() => new DialogueEngine(providers.dialogue, memory), [providers, memory]);

  const [snapshot, setSnapshot] = useState<BarkleySnapshot>(() => freshSnapshot(Date.now()));
  const [replyActions, setReplyActions] = useState<BodyAction[]>([]);
  const [lastExchange, setLastExchange] = useState<Exchange | null>(null);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sttAvailable, setSttAvailable] = useState(false);

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const permissionGranted = useRef(false);

  const dispatch = useCallback((event: BarkleyEvent) => {
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
      try {
        const raw = await asyncStorageStore.get(SNAPSHOT_KEY);
        if (!cancelled && raw) {
          const saved = JSON.parse(raw) as BarkleySnapshot;
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
      await memory.load();
      const available = await providers.stt.isAvailable();
      if (!cancelled) setSttAvailable(available);
    })();
    return () => {
      cancelled = true;
    };
  }, [memory, providers]);

  // --- Persist snapshot on change ---
  useEffect(() => {
    asyncStorageStore.set(SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => {});
  }, [snapshot]);

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
      settleTimer.current = setTimeout(
        () => dispatch({ type: 'SETTLE' }),
        settleDelayMs(snapshot.state),
      );
    }
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [snapshot.state, dispatch]);

  // --- The core exchange: text in → Barkley speaks + reacts ---
  const runExchange = useCallback(
    async (userText: string) => {
      setBusy(true);
      setError(null);
      dispatch({ type: 'TALK_CAPTURED' }); // thinking
      try {
        const reply = await engine.converse(userText, snapshotRef.current);
        if (!reply.speech) {
          dispatch({ type: 'TALK_FAILED' });
          return;
        }
        setLastExchange({ userText, barkleyText: reply.speech });
        setReplyActions(reply.actions);
        dispatch({ type: 'SPEAK_START' });
        await providers.tts.speak(reply.speech);
        dispatch({ type: 'SPEAK_END' });
        setReplyActions([]);
        if (reply.reaction) dispatch({ type: 'REACTION', state: reply.reaction });
      } catch (e) {
        dispatch({ type: 'TALK_FAILED' });
        setError(e instanceof Error ? e.message : 'Barkley got distracted. Try again.');
      } finally {
        setBusy(false);
        setPartialTranscript('');
      }
    },
    [dispatch, engine, providers],
  );

  const startTalk = useCallback(async () => {
    if (busy) return;
    setError(null);
    if (!permissionGranted.current) {
      permissionGranted.current = await providers.stt.requestPermissions();
      if (!permissionGranted.current) {
        setError('Barkley needs the microphone to hear you.');
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

  const actions = useMemo<BodyAction[]>(() => {
    const ambient = ambientActions(snapshot.state);
    return replyActions.length > 0 && snapshot.state === 'speaking'
      ? Array.from(new Set([...ambient, ...replyActions]))
      : ambient;
  }, [snapshot.state, replyActions]);

  return {
    snapshot,
    actions,
    lastExchange,
    partialTranscript,
    error,
    busy,
    sttAvailable,
    dialogueProviderName: engine.providerName,
    startTalk,
    stopTalk,
    cancelTalk,
    submitText,
    feed: () => dispatch({ type: 'FEED' }),
    play: () => dispatch({ type: 'PLAY' }),
    sleepToggle: () => dispatch({ type: 'SLEEP_TOGGLE' }),
    memorySnapshot: () => memory.snapshot(),
    forgetEverything: async () => {
      await memory.forgetAll();
      setLastExchange(null);
    },
  };
}
