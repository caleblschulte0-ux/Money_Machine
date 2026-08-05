import { errors, newId, systemClock, type Clock } from "@holdco/core";
import type { KnowledgeDocumentRecord, Store } from "@holdco/database";

/**
 * Shared knowledge layer (playbook §36).
 *
 * The rule that gives this module its value: **agents may only ground answers
 * in `approved`, in-effect documents**. Draft, expired and archived knowledge
 * is invisible to retrieval, so an unreviewed page cannot become a customer
 * commitment.
 */
export interface CreateKnowledgeInput {
  organizationId: string;
  ventureId: string | null;
  key: string;
  title: string;
  body: string;
  kind: KnowledgeDocumentRecord["kind"];
  ownerUserId?: string | null;
  accountId?: string | null;
  sourceUrls?: string[];
  tags?: string[];
  effectiveFrom?: Date | null;
  expiresAt?: Date | null;
}

export interface KnowledgeSearchOptions {
  organizationId: string;
  ventureId?: string | null;
  accountId?: string | null;
  kinds?: readonly KnowledgeDocumentRecord["kind"][];
  limit?: number;
  /** Include unapproved documents. Never true for agent retrieval. */
  includeUnapproved?: boolean;
  now?: Date;
}

export interface KnowledgeHit {
  readonly document: KnowledgeDocumentRecord;
  readonly score: number;
  readonly excerpt: string;
  /** What an agent must cite when it uses this document. */
  readonly citation: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one",
  "our", "out", "has", "his", "how", "its", "who", "did", "yes", "she", "him", "with",
  "this", "that", "from", "they", "have", "what", "when", "were", "will", "your",
]);

export class KnowledgeBase {
  constructor(
    private readonly store: Store,
    private readonly clock: Clock = systemClock,
  ) {}

  async create(input: CreateKnowledgeInput): Promise<KnowledgeDocumentRecord> {
    const previous = await this.latestVersion(input.organizationId, input.key);
    return this.store.knowledgeDocuments.create({
      id: newId("knw", this.clock.epochMillis()),
      organizationId: input.organizationId,
      ventureId: input.ventureId,
      key: input.key,
      version: (previous?.version ?? 0) + 1,
      title: input.title,
      body: input.body,
      kind: input.kind,
      status: "draft",
      ownerUserId: input.ownerUserId ?? null,
      approvedByUserId: null,
      effectiveFrom: input.effectiveFrom ?? null,
      expiresAt: input.expiresAt ?? null,
      accountId: input.accountId ?? null,
      sourceUrls: input.sourceUrls ?? [],
      tags: input.tags ?? [],
    });
  }

  /**
   * Approval requires a human user id. Nothing in the platform approves
   * knowledge on its own — an agent writing its own source of truth is how a
   * hallucination becomes policy.
   */
  async approve(
    documentId: string,
    approvedByUserId: string,
    effectiveFrom?: Date,
  ): Promise<KnowledgeDocumentRecord> {
    const document = await this.store.knowledgeDocuments.require(documentId);
    if (document.status === "approved") return document;
    if (!approvedByUserId) {
      throw errors.forbidden("Knowledge approval requires a human user id");
    }
    // Supersede the previously approved version of the same key.
    const priorApproved = await this.store.knowledgeDocuments.all({
      where: {
        organizationId: document.organizationId,
        key: document.key,
        status: "approved",
      },
    });
    for (const prior of priorApproved) {
      if (prior.id !== documentId) {
        await this.store.knowledgeDocuments.update(prior.id, { status: "archived" });
      }
    }
    return this.store.knowledgeDocuments.update(documentId, {
      status: "approved",
      approvedByUserId,
      effectiveFrom: effectiveFrom ?? this.clock.now(),
    });
  }

  async latestVersion(
    organizationId: string,
    key: string,
  ): Promise<KnowledgeDocumentRecord | null> {
    const all = await this.store.knowledgeDocuments.all({
      where: { organizationId, key },
      orderBy: { field: "version", direction: "desc" },
    });
    return all[0] ?? null;
  }

  /** The approved, currently-in-effect version of a document. */
  async current(
    organizationId: string,
    key: string,
    now?: Date,
  ): Promise<KnowledgeDocumentRecord | null> {
    const at = now ?? this.clock.now();
    const candidates = await this.store.knowledgeDocuments.all({
      where: { organizationId, key, status: "approved" },
      orderBy: { field: "version", direction: "desc" },
    });
    return candidates.find((d) => this.inEffect(d, at)) ?? null;
  }

  private inEffect(document: KnowledgeDocumentRecord, at: Date): boolean {
    if (document.effectiveFrom && document.effectiveFrom.getTime() > at.getTime()) return false;
    if (document.expiresAt && document.expiresAt.getTime() <= at.getTime()) return false;
    return true;
  }

  /**
   * Keyword retrieval with venture and customer scoping.
   *
   * Deliberately simple (TF-style term overlap, title weighted): it is
   * honest about being lexical, it needs no vector database, and it can be
   * swapped for embeddings behind this same interface later.
   */
  async search(query: string, options: KnowledgeSearchOptions): Promise<readonly KnowledgeHit[]> {
    const at = options.now ?? this.clock.now();
    const where: Record<string, unknown> = { organizationId: options.organizationId };
    if (!options.includeUnapproved) where["status"] = "approved";
    if (options.ventureId !== undefined) where["ventureId"] = options.ventureId;
    if (options.kinds) where["kind"] = { in: options.kinds };

    const documents = await this.store.knowledgeDocuments.all({ where: where as never });
    const terms = tokenize(query).filter((t) => !STOPWORDS.has(t));
    if (terms.length === 0) return [];

    const hits: KnowledgeHit[] = [];
    for (const document of documents) {
      if (!options.includeUnapproved && !this.inEffect(document, at)) continue;
      // Customer-scoped documents are only visible to that customer's context.
      if (document.accountId && document.accountId !== options.accountId) continue;

      const bodyTokens = tokenize(document.body);
      const titleTokens = tokenize(document.title);
      const tagTokens = document.tags.flatMap(tokenize);

      let score = 0;
      for (const term of terms) {
        score += bodyTokens.filter((t) => t === term).length;
        score += titleTokens.filter((t) => t === term).length * 5;
        score += tagTokens.filter((t) => t === term).length * 3;
      }
      if (score === 0) continue;

      hits.push({
        document,
        score,
        excerpt: this.excerpt(document.body, terms),
        citation: `${document.key} v${document.version}`,
      });
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, options.limit ?? 5);
  }

  private excerpt(body: string, terms: readonly string[]): string {
    const lower = body.toLowerCase();
    const firstHit = terms
      .map((t) => lower.indexOf(t))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0];
    if (firstHit === undefined) return body.slice(0, 240);
    const start = Math.max(0, firstHit - 80);
    return (start > 0 ? "…" : "") + body.slice(start, start + 300).trim() + (body.length > start + 300 ? "…" : "");
  }

  /**
   * The context block handed to an agent. Every entry carries its citation so
   * the agent can — and by prompt guardrail must — attribute claims.
   */
  async contextFor(
    query: string,
    options: KnowledgeSearchOptions,
  ): Promise<{ text: string; citations: readonly string[] }> {
    const hits = await this.search(query, { ...options, includeUnapproved: false });
    if (hits.length === 0) {
      return { text: "(no approved knowledge matched this query)", citations: [] };
    }
    return {
      text: hits
        .map((h) => `[${h.citation}] ${h.document.title}\n${h.excerpt}`)
        .join("\n\n"),
      citations: hits.map((h) => h.citation),
    };
  }

  /** Documents that have expired but are still marked approved. */
  async expireStale(organizationId: string): Promise<number> {
    const now = this.clock.now();
    const approved = await this.store.knowledgeDocuments.all({
      where: { organizationId, status: "approved" },
    });
    let expired = 0;
    for (const document of approved) {
      if (document.expiresAt && document.expiresAt.getTime() <= now.getTime()) {
        await this.store.knowledgeDocuments.update(document.id, { status: "expired" });
        expired++;
      }
    }
    return expired;
  }
}
