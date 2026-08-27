/**
 * Barkly's memory store — the persistence and consolidation layer over the
 * structured model in facts.ts.
 *
 * Three tiers:
 *  1. Working memory — recent conversation turns, kept verbatim.
 *  2. Facts — addressable, updatable things he knows about his person.
 *  3. Experiences — things he believes he and his person did together.
 *
 * Consolidation: turns that fall out of the verbatim window are distilled
 * before they are dropped, so a long conversation leaves durable facts,
 * promises, and a compact summary behind instead of an ever-growing
 * transcript. Prompt size is bounded by construction.
 *
 * Everything is deletable (privacy requirement) and persisted through the
 * KeyValueStore abstraction only.
 */

import { KeyValueStore, profileKey } from '../storage/types';
import {
  addExperience,
  describeFact,
  Experience,
  Fact,
  makeExperience,
  mergeFacts,
  parseFactStatement,
  rankExperiences,
  rankFacts,
  sanitize,
} from './facts';
import { ChatTurn } from './types';

export interface MemoryState {
  /** Recent turns, verbatim, oldest first. */
  turns: ChatTurn[];
  /** Distilled digest of everything older than the verbatim window. */
  sessionSummary: string;
  /** Structured, addressable knowledge. */
  facts: Fact[];
  /** Shared experiences, first-class. */
  experiences: Experience[];
  /** Topics raised but never resolved — hooks for him to bring things back up. */
  openThreads: string[];

  /** Back-compat display views (Settings UI reads these). Derived, not stored. */
  userFacts: string[];
  barklyMemories: string[];
}

export function emptyMemory(): MemoryState {
  return {
    turns: [],
    sessionSummary: '',
    facts: [],
    experiences: [],
    openThreads: [],
    userFacts: [],
    barklyMemories: [],
  };
}

/** Recent turns sent verbatim to the model; older ones get consolidated. */
export const TURN_WINDOW = 12;
const MAX_SUMMARY_LINES = 12;
const MAX_OPEN_THREADS = 6;
const STORE_KEY = 'memory-v2';
const LEGACY_KEY = 'memory-v1';

interface StoredShape {
  turns: ChatTurn[];
  sessionSummary: string;
  facts: Fact[];
  experiences: Experience[];
  openThreads: string[];
}

export class BarklyMemory {
  private state: StoredShape = {
    turns: [],
    sessionSummary: '',
    facts: [],
    experiences: [],
    openThreads: [],
  };

  constructor(
    private store: KeyValueStore,
    private profile: string,
    /** Injectable clock keeps consolidation and scoring testable. */
    private now: () => number = () => Date.now(),
  ) {}

  private key(): string {
    return profileKey(this.profile, STORE_KEY);
  }

  async load(): Promise<MemoryState> {
    try {
      const raw = await this.store.get(this.key());
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredShape>;
        this.state = {
          turns: Array.isArray(parsed.turns) ? parsed.turns : [],
          sessionSummary: typeof parsed.sessionSummary === 'string' ? parsed.sessionSummary : '',
          facts: Array.isArray(parsed.facts) ? parsed.facts : [],
          experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
          openThreads: Array.isArray(parsed.openThreads) ? parsed.openThreads : [],
        };
      } else {
        await this.migrateLegacy();
      }
    } catch {
      // Corrupt store — start fresh rather than crash the dog.
      this.state = { turns: [], sessionSummary: '', facts: [], experiences: [], openThreads: [] };
    }
    return this.snapshot();
  }

  /**
   * Bring a v1 (flat string list) memory forward. Early testers should not
   * lose the fact that Barkly knows their name.
   */
  private async migrateLegacy(): Promise<void> {
    const raw = await this.store.get(profileKey(this.profile, LEGACY_KEY));
    if (!raw) return;
    try {
      const old = JSON.parse(raw) as {
        turns?: ChatTurn[];
        sessionSummary?: string;
        userFacts?: string[];
        barklyMemories?: string[];
      };
      const now = this.now();
      const facts = (old.userFacts ?? [])
        .map((s) => parseFactStatement(s, now))
        .filter((f): f is Fact => Boolean(f));
      let experiences: Experience[] = [];
      for (const m of old.barklyMemories ?? []) {
        const exp = makeExperience(m, now);
        if (exp) experiences = addExperience(experiences, exp);
      }
      this.state = {
        turns: old.turns ?? [],
        sessionSummary: typeof old.sessionSummary === 'string' ? old.sessionSummary : '',
        facts: mergeFacts([], facts, now).facts,
        experiences,
        openThreads: [],
      };
      await this.persist();
    } catch {
      // Unreadable legacy data is not worth crashing over.
    }
  }

  private async persist(): Promise<void> {
    await this.store.set(this.key(), JSON.stringify(this.state));
  }

  snapshot(): MemoryState {
    const now = this.now();
    return {
      turns: [...this.state.turns],
      sessionSummary: this.state.sessionSummary,
      facts: [...this.state.facts],
      experiences: [...this.state.experiences],
      openThreads: [...this.state.openThreads],
      userFacts: rankFacts(this.state.facts, now, 40).map(describeFact),
      barklyMemories: rankExperiences(this.state.experiences, now, 40).map((e) => e.what),
    };
  }

  /** Facts and experiences most worth putting in front of the model right now. */
  relevant(factLimit = 14, experienceLimit = 6): { facts: Fact[]; experiences: Experience[] } {
    const now = this.now();
    return {
      facts: rankFacts(this.state.facts, now, factLimit),
      experiences: rankExperiences(this.state.experiences, now, experienceLimit),
    };
  }

  async addTurn(turn: ChatTurn): Promise<void> {
    this.state.turns.push(turn);
    if (this.state.turns.length > TURN_WINDOW) {
      const overflow = this.state.turns.splice(0, this.state.turns.length - TURN_WINDOW);
      await this.consolidate(overflow);
    }
    await this.persist();
  }

  /**
   * Distill turns that are leaving the verbatim window.
   *
   * This is deterministic local consolidation: it extracts promises and open
   * questions, and keeps a bounded digest. It is NOT model-based summarization
   * — `consolidateWith()` is the seam for that, so the upgrade doesn't disturb
   * any caller.
   */
  private async consolidate(evicted: ChatTurn[]): Promise<void> {
    const now = this.now();

    // Promises are the highest-value thing buried in old conversation.
    const promiseRe = /\b(?:i(?:'ll| will)|we(?:'ll| will)|promise|tomorrow|later)\b/i;
    const questionRe = /\?\s*$/;

    for (const t of evicted) {
      const text = sanitize(t.text, 160);
      if (!text) continue;
      if (t.role === 'user' && promiseRe.test(text)) {
        const exp = makeExperience(`Your person said: "${text}"`, now, { importance: 0.85 });
        if (exp) this.state.experiences = addExperience(this.state.experiences, exp);
      }
      if (t.role === 'user' && questionRe.test(text) && this.state.openThreads.length < MAX_OPEN_THREADS) {
        this.state.openThreads = [...new Set([...this.state.openThreads, text])].slice(-MAX_OPEN_THREADS);
      }
    }

    const lines = evicted.map(
      (t) => `${t.role === 'user' ? 'Person' : 'Barkly'}: ${sanitize(t.text, 90)}`,
    );
    const combined = [this.state.sessionSummary, ...lines].filter(Boolean).join('\n').split('\n');
    this.state.sessionSummary = combined.slice(-MAX_SUMMARY_LINES).join('\n');
  }

  /**
   * Seam for model-based semantic consolidation: hand the evicted turns to a
   * summarizer and store the result. Not wired to a provider yet — documented
   * rather than silently missing.
   */
  async consolidateWith(
    summarize: (turns: ChatTurn[]) => Promise<string>,
    turns: ChatTurn[],
  ): Promise<void> {
    const summary = sanitize(await summarize(turns), 1200);
    if (summary) {
      this.state.sessionSummary = summary;
      await this.persist();
    }
  }

  /**
   * Record new knowledge. Fact statements are parsed into structured facts and
   * merged (so corrections replace rather than accumulate); experience strings
   * become Experience objects.
   */
  async remember(
    factStatements: string[],
    experienceTexts: string[],
    opts: { where?: string; withWhom?: string[] } = {},
  ): Promise<{ updated: { key: string; from: string; to: string }[] }> {
    const now = this.now();
    const incoming = factStatements
      .map((s) => parseFactStatement(s, now))
      .filter((f): f is Fact => Boolean(f));
    const merged = mergeFacts(this.state.facts, incoming, now);
    this.state.facts = merged.facts;

    for (const text of experienceTexts) {
      const exp = makeExperience(text, now, { where: opts.where, withWhom: opts.withWhom });
      if (exp) this.state.experiences = addExperience(this.state.experiences, exp);
    }

    await this.persist();
    return {
      updated: merged.updated.map((u) => ({
        key: u.fact.key,
        from: u.previous,
        to: u.fact.value,
      })),
    };
  }

  /** Look up one fact directly — e.g. his person's name for a greeting. */
  getFact(key: string, subject = 'person'): Fact | undefined {
    return this.state.facts.find((f) => f.subject === subject && f.key === key);
  }

  /** Mark facts as having just come up, which keeps them prompt-relevant. */
  async touch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const now = this.now();
    this.state.facts = this.state.facts.map((f) =>
      ids.includes(f.id)
        ? { ...f, lastReferencedAt: now, referenceCount: f.referenceCount + 1 }
        : f,
    );
    await this.persist();
  }

  async resolveThread(text: string): Promise<void> {
    this.state.openThreads = this.state.openThreads.filter((t) => t !== text);
    await this.persist();
  }

  async forgetFact(id: string): Promise<void> {
    this.state.facts = this.state.facts.filter((f) => f.id !== id);
    this.state.experiences = this.state.experiences.filter((e) => e.id !== id);
    await this.persist();
  }

  /** Wipe everything — the Settings "Forget everything" button. */
  async forgetAll(): Promise<void> {
    this.state = { turns: [], sessionSummary: '', facts: [], experiences: [], openThreads: [] };
    await this.store.remove(this.key());
    await this.store.remove(profileKey(this.profile, LEGACY_KEY));
  }
}
