import { money, newId, type JsonObject } from "@holdco/core";
import type { Store } from "@holdco/database";
import type { ActionHandler, ActionRegistry } from "@holdco/workflows";
import { simulatedHandler } from "@holdco/workflows";
import type { CommunicationsService } from "@holdco/communications";
import type { AgentRunner, AgentRegistry } from "@holdco/agents";
import type { ApprovalService } from "@holdco/approvals";
import type { Logger } from "@holdco/observability";

/**
 * Concrete workflow action handlers.
 *
 * Actions whose real implementation does not exist yet are registered as
 * *simulated* handlers rather than omitted. That choice is deliberate: a
 * workflow referencing them still runs and still records what it would have
 * done, and its output is explicitly marked `simulated: true` so no report can
 * mistake it for a real effect.
 */
export interface ActionDeps {
  store: Store;
  communications: CommunicationsService;
  agents: AgentRegistry;
  agentRunner: AgentRunner;
  approvals: ApprovalService;
  logger: Logger;
}

function str(input: JsonObject, key: string, fallback = ""): string {
  const value = input[key];
  return typeof value === "string" ? value : fallback;
}

export function registerPlatformActions(registry: ActionRegistry, deps: ActionDeps): void {
  const taskCreate: ActionHandler = {
    type: "task.create",
    describe: (input) => `create task "${str(input, "title", "(untitled)")}"`,
    async execute(input, context) {
      const task = await deps.store.tasks.create({
        id: newId("tsk"),
        organizationId: context.organizationId,
        ventureId: context.ventureId,
        title: str(input, "title", "Untitled task"),
        description: str(input, "description") || null,
        status: "open",
        priority: (str(input, "priority", "normal") as "normal") ?? "normal",
        dueAt: typeof input["dueAt"] === "string" ? new Date(input["dueAt"]) : null,
        completedAt: null,
        assignedUserId: str(input, "assignedUserId") || null,
        assignedAgentId: null,
        relatedType: str(input, "relatedType") || null,
        relatedId: str(input, "relatedId") || null,
        createdBy: `workflow:${context.workflowRunId}`,
        metadata: { workflowRunId: context.workflowRunId, stepId: context.stepId },
      });
      return { output: { taskId: task.id }, cost: money(0) };
    },
    async compensate(_input, context) {
      const tasks = await deps.store.tasks.all({
        where: { organizationId: context.organizationId, relatedId: context.workflowRunId } as never,
      });
      for (const task of tasks) {
        await deps.store.tasks.update(task.id, { status: "cancelled" });
      }
    },
  };

  const emailSend: ActionHandler = {
    type: "email.send",
    describe: (input) => `send ${str(input, "purpose", "transactional")} email to ${str(input, "to", "(unknown)")}`,
    async execute(input, context) {
      const outcome = await deps.communications.sendEmail({
        organizationId: context.organizationId,
        ventureId: context.ventureId,
        to: str(input, "to"),
        from: str(input, "from", "no-reply@example.invalid"),
        subject: str(input, "subject", "(no subject)"),
        body: str(input, "body"),
        purpose: str(input, "purpose", "transactional") === "marketing" ? "marketing" : "transactional",
        contactId: str(input, "contactId") || null,
        accountId: str(input, "accountId") || null,
        workflowRunId: context.workflowRunId,
        frequencyCap: typeof input["frequencyCap"] === "number" ? input["frequencyCap"] : undefined,
      });
      return {
        output: {
          status: outcome.status,
          ...(outcome.status !== "blocked" ? { communicationId: outcome.communication.id } : {}),
          ...("reason" in outcome ? { reason: outcome.reason } : {}),
        },
        cost: money(0),
        needsReview: outcome.status !== "sent",
      };
    },
  };

  const agentRun: ActionHandler = {
    type: "agent.run",
    describe: (input) => `run agent "${str(input, "agentKey")}"`,
    async execute(input, context) {
      const agentKey = str(input, "agentKey");
      const definition = deps.agents.get(agentKey);
      const result = await deps.agentRunner.run(
        definition,
        (input["input"] ?? {}) as never,
        {
          organizationId: context.organizationId,
          ventureId: context.ventureId,
          correlationId: context.correlationId,
          workflowRunId: context.workflowRunId,
          customerAccountId: str(input, "customerAccountId") || null,
        },
        {
          knowledgeQuery: str(input, "knowledgeQuery") || undefined,
          promptVariables: (input["promptVariables"] ?? {}) as never,
        },
      );

      if (!result.ok) {
        const failure: JsonObject = {
          agentRunId: result.error.runId,
          status: result.error.status,
          reason: result.error.reason,
        };
        return { output: failure, cost: money(0), needsReview: true };
      }
      const success: JsonObject = {
        agentRunId: result.value.runId,
        status: "succeeded",
        output: result.value.output as JsonObject,
        citations: [...result.value.citations],
      };
      return { output: success, cost: money(result.value.costMinor) };
    },
  };

  const recordUpdate: ActionHandler = {
    type: "record.update",
    describe: (input) => `update ${str(input, "entity")} ${str(input, "id")}`,
    async execute(input, context) {
      const entity = str(input, "entity");
      const id = str(input, "id");
      const patch = (input["patch"] ?? {}) as JsonObject;
      const collection = (deps.store as unknown as Record<string, { update(id: string, patch: unknown): Promise<{ id: string }> }>)[entity];
      if (!collection) {
        throw new Error(`record.update: unknown entity collection "${entity}"`);
      }
      const updated = await collection.update(id, patch);
      deps.logger.debug("record updated by workflow", {
        entity, id, stepId: context.stepId, workflowRunId: context.workflowRunId,
      });
      return { output: { id: updated.id, entity }, cost: money(0) };
    },
  };

  const recordTag: ActionHandler = {
    type: "record.tag",
    describe: (input) => `tag ${str(input, "entity")} ${str(input, "id")} with "${str(input, "tag")}"`,
    async execute(input) {
      const entity = str(input, "entity");
      const id = str(input, "id");
      const tag = str(input, "tag");
      const collection = (deps.store as unknown as Record<string, {
        get(id: string): Promise<{ tags?: string[] } | null>;
        update(id: string, patch: unknown): Promise<unknown>;
      }>)[entity];
      if (!collection) throw new Error(`record.tag: unknown entity collection "${entity}"`);
      const record = await collection.get(id);
      const tags = new Set(record?.tags ?? []);
      tags.add(tag);
      await collection.update(id, { tags: [...tags] });
      return { output: { id, tags: [...tags] }, cost: money(0) };
    },
  };

  const approvalRequest: ActionHandler = {
    type: "approval.request",
    describe: (input) => `request human approval: ${str(input, "title")}`,
    async execute(input, context) {
      const approval = await deps.approvals.request(
        {
          organizationId: context.organizationId,
          ventureId: context.ventureId,
          actionKind: str(input, "actionKind", "human.notify"),
          title: str(input, "title", "Approval required"),
          summary: str(input, "summary", "A workflow requested a human decision."),
          reason: str(input, "reason", "Requested explicitly by a workflow step."),
          evidence: (input["evidence"] ?? {}) as JsonObject,
          financialImpact: typeof input["financialImpactMinor"] === "number"
            ? money(input["financialImpactMinor"])
            : undefined,
          requestedBy: `workflow:${context.workflowRunId}`,
          requestedByType: "workflow",
          workflowRunId: context.workflowRunId,
          payload: (input["payload"] ?? {}) as JsonObject,
        },
        { type: "workflow", id: context.workflowRunId },
      );
      return { output: { approvalId: approval.id }, cost: money(0), needsReview: true };
    },
  };

  const humanNotify: ActionHandler = {
    type: "human.notify",
    describe: (input) => `notify humans: ${str(input, "message")}`,
    async execute(input, context) {
      deps.logger.info("workflow notification", {
        message: str(input, "message"),
        ventureId: context.ventureId,
        workflowRunId: context.workflowRunId,
      });
      const note = await deps.store.notes.create({
        id: newId("not"),
        organizationId: context.organizationId,
        ventureId: context.ventureId,
        body: str(input, "message"),
        authorType: "system",
        authorId: context.workflowRunId,
        relatedType: "workflow_run",
        relatedId: context.workflowRunId,
        metadata: {},
      });
      return { output: { noteId: note.id }, cost: money(0) };
    },
  };

  for (const handler of [
    taskCreate, emailSend, agentRun, recordUpdate, recordTag, approvalRequest, humanNotify,
  ]) {
    registry.register(handler);
  }

  // Not built yet — registered as explicitly simulated so workflows using them
  // remain runnable and honest. See docs/KNOWN_LIMITATIONS.md.
  const notBuilt: Array<[Parameters<typeof simulatedHandler>[0], string]> = [
    ["sms.send", "SMS delivery is not implemented; no message was sent."],
    ["call.start", "Telephony is not implemented; no call was placed."],
    ["document.generate", "Document generation is not implemented; no file was produced."],
    ["invoice.create", "Invoice creation via workflow is not wired; use the billing service directly."],
    ["followup.schedule", "Scheduling is not implemented; no follow-up was booked."],
    ["content.publish", "Publishing is not implemented; nothing was published."],
    ["file.export", "Export is not implemented; no file left the system."],
    ["webhook.trigger", "Outbound webhooks are not implemented; nothing was sent."],
    ["campaign.pause", "Ad platform integrations are not implemented; no campaign changed."],
    ["case.escalate", "Escalation routing is not implemented; the case was not reassigned."],
  ];
  for (const [type, note] of notBuilt) {
    registry.register(simulatedHandler(type, note));
  }
}
