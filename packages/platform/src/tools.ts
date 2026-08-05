import type { JsonObject } from "@holdco/core";
import type { Store } from "@holdco/database";
import type { KnowledgeBase } from "@holdco/knowledge";
import type { Tool, ToolRegistry } from "@holdco/agents";

/**
 * Tools available to agents.
 *
 * Phase 1 ships read-only tools only. An agent that can look things up but
 * cannot change them is the safe starting point; write tools get added one at
 * a time, each with its own action kind so the autonomy policy governs it.
 */
export interface ToolDeps {
  store: Store;
  knowledge: KnowledgeBase;
}

export function registerPlatformTools(registry: ToolRegistry, deps: ToolDeps): void {
  const knowledgeSearch: Tool = {
    name: "knowledge.search",
    description:
      "Search approved knowledge documents. Returns excerpts with citations. " +
      "Only approved, in-effect documents are visible.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to look for" },
        limit: { type: "number", description: "Maximum results (default 5)" },
      },
      required: ["query"],
    },
    actionKind: "knowledge.index",
    readOnly: true,
    async execute(input, context): Promise<JsonObject> {
      const query = typeof input["query"] === "string" ? input["query"] : "";
      const hits = await deps.knowledge.search(query, {
        organizationId: context.organizationId,
        ventureId: context.ventureId,
        limit: typeof input["limit"] === "number" ? input["limit"] : 5,
      });
      return {
        results: hits.map((h) => ({
          citation: h.citation,
          title: h.document.title,
          excerpt: h.excerpt,
        })),
        count: hits.length,
      };
    },
  };

  const findContact: Tool = {
    name: "crm.find_contact",
    description: "Look up a contact by email address within the current venture.",
    inputSchema: {
      type: "object",
      properties: { email: { type: "string" } },
      required: ["email"],
    },
    actionKind: "record.update_internal_field",
    readOnly: true,
    async execute(input, context): Promise<JsonObject> {
      const email = typeof input["email"] === "string" ? input["email"].toLowerCase() : "";
      const contact = await deps.store.contacts.findFirst({
        where: { organizationId: context.organizationId, email },
      });
      if (!contact) return { found: false };
      return {
        found: true,
        contactId: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        title: contact.title,
        accountId: contact.accountId,
        consentStatus: contact.consentStatus,
        // Deliberately does not return phone or raw email: an agent that never
        // sees a contact detail cannot leak one into generated copy.
      };
    },
  };

  const ventureMetrics: Tool = {
    name: "venture.metrics",
    description: "Read the recorded metric snapshot for a venture and period.",
    inputSchema: {
      type: "object",
      properties: { periodKey: { type: "string", description: "YYYY-MM" } },
      required: ["periodKey"],
    },
    actionKind: "analytics.recompute",
    readOnly: true,
    async execute(input, context): Promise<JsonObject> {
      if (!context.ventureId) return { found: false, reason: "no venture in scope" };
      const snapshot = await deps.store.ventureMetricSnapshots.findFirst({
        where: {
          ventureId: context.ventureId,
          periodKey: typeof input["periodKey"] === "string" ? input["periodKey"] : "",
        },
      });
      if (!snapshot) return { found: false, reason: "no snapshot recorded for that period" };
      return {
        found: true,
        revenueMinor: snapshot.revenueMinor,
        customerCount: snapshot.customerCount,
        churnedCustomers: snapshot.churnedCustomers,
        aiSpendMinor: snapshot.aiSpendMinor,
        humanHours: snapshot.humanHours,
      };
    },
  };

  for (const tool of [knowledgeSearch, findContact, ventureMetrics]) {
    registry.register(tool);
  }
}
