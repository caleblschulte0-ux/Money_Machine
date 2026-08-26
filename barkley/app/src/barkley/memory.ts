/**
 * Barkley's memory — three tiers:
 *
 *  1. Session memory: the current conversation, capped. Older turns fold into
 *     a rolling summary instead of growing the prompt forever.
 *  2. User facts: durable things about his person (name, pets, favorites…).
 *  3. Barkley memories: experiences Barkley believes he shared with his person
 *     ("Caleb promised we'd play again tomorrow") — the "I remember things,
 *     dude" material.
 *
 * Persistence goes through the KeyValueStore abstraction only. Everything is
 * deletable (child-safety requirement).
 */

import { KeyValueStore, profileKey } from '../storage/types';
import { ChatTurn } from './types';

export interface MemoryState {
  turns: ChatTurn[];
  /** Rolling summary of turns that no longer fit in the window. */
  sessionSummary: string;
  userFacts: string[];
  barkleyMemories: string[];
}

/** Factory, not a shared constant — arrays must never be shared by reference. */
export function emptyMemory(): MemoryState {
  return { turns: [], sessionSummary: '', userFacts: [], barkleyMemories: [] };
}

/** Recent turns sent verbatim to the model; older ones get folded. */
export const TURN_WINDOW = 12;
const MAX_FACTS = 60;
const MAX_BARKLEY_MEMORIES = 60;
const STORE_KEY = 'memory-v1';

export class BarkleyMemory {
  private state: MemoryState = emptyMemory();

  constructor(
    private store: KeyValueStore,
    private profile: string,
  ) {}

  private key(): string {
    return profileKey(this.profile, STORE_KEY);
  }

  async load(): Promise<MemoryState> {
    try {
      const raw = await this.store.get(this.key());
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MemoryState>;
        this.state = {
          turns: Array.isArray(parsed.turns) ? parsed.turns : [],
          sessionSummary: typeof parsed.sessionSummary === 'string' ? parsed.sessionSummary : '',
          userFacts: Array.isArray(parsed.userFacts) ? parsed.userFacts : [],
          barkleyMemories: Array.isArray(parsed.barkleyMemories) ? parsed.barkleyMemories : [],
        };
      }
    } catch {
      // Corrupt store — start fresh rather than crash the dog.
      this.state = emptyMemory();
    }
    return this.snapshot();
  }

  private async persist(): Promise<void> {
    await this.store.set(this.key(), JSON.stringify(this.state));
  }

  snapshot(): MemoryState {
    return {
      turns: [...this.state.turns],
      sessionSummary: this.state.sessionSummary,
      userFacts: [...this.state.userFacts],
      barkleyMemories: [...this.state.barkleyMemories],
    };
  }

  async addTurn(turn: ChatTurn): Promise<void> {
    this.state.turns.push(turn);
    if (this.state.turns.length > TURN_WINDOW) {
      const overflow = this.state.turns.splice(0, this.state.turns.length - TURN_WINDOW);
      this.state.sessionSummary = foldIntoSummary(this.state.sessionSummary, overflow);
    }
    await this.persist();
  }

  /** Merge model-extracted memory candidates, deduped, capped, oldest dropped first. */
  async remember(userFacts: string[], barkleyMemories: string[]): Promise<void> {
    this.state.userFacts = mergeCapped(this.state.userFacts, userFacts, MAX_FACTS);
    this.state.barkleyMemories = mergeCapped(this.state.barkleyMemories, barkleyMemories, MAX_BARKLEY_MEMORIES);
    await this.persist();
  }

  async forgetFact(fact: string): Promise<void> {
    this.state.userFacts = this.state.userFacts.filter((f) => f !== fact);
    this.state.barkleyMemories = this.state.barkleyMemories.filter((f) => f !== fact);
    await this.persist();
  }

  /** Wipe everything — the Settings "Forget everything" button. */
  async forgetAll(): Promise<void> {
    this.state = emptyMemory();
    await this.store.remove(this.key());
  }
}

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function mergeCapped(existing: string[], incoming: string[], cap: number): string[] {
  const out = [...existing];
  const seen = new Set(existing.map((f) => normalize(f).toLowerCase()));
  for (const raw of incoming) {
    const fact = normalize(raw);
    if (!fact) continue;
    const key = fact.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fact);
  }
  return out.slice(-cap);
}

/**
 * MVP summary fold: keep a compact textual digest of evicted turns.
 * Deliberately simple — a model-written summary is a later upgrade, and it
 * slots in here without changing any caller.
 */
export function foldIntoSummary(existing: string, evicted: ChatTurn[]): string {
  const lines = evicted.map((t) => `${t.role === 'user' ? 'Person' : 'Barkley'}: ${truncate(t.text, 80)}`);
  const combined = [existing, ...lines].filter(Boolean).join('\n');
  // Keep the summary itself bounded.
  const all = combined.split('\n');
  return all.slice(-30).join('\n');
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
