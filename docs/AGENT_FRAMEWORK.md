# Agent framework

`packages/agents` — every AI agent in the portfolio is defined, budgeted,
permissioned and logged the same way.

## An agent definition

Every field the platform requires is mandatory, enforced by
`validateAgentDefinition()` rather than by convention:

```ts
export const RESEARCH_AGENT: AgentDefinition<Input, Output> = {
  key: "research.market",
  version: 1,
  name: "Research Agent",
  ventureKey: null,                    // null = shared across the portfolio
  role: "Market and competitor research",
  objective: "Summarise what supplied sources establish, name what they do not…",
  allowedTools: ["knowledge.search"],
  prohibitedActions: ["email.send_marketing", "payment.charge", "contract.send"],
  inputSchema: z.object({ /* … */ }),
  outputSchema: z.object({ text: z.string().min(1) }),
  promptKey: "research.market_scan",
  promptVersion: 1,
  model: { provider: "mock", model: "mock-large", maxOutputTokens: 2000 },
  costBudgetMinor: 50,                 // hard per-run cap
  timeoutMs: 60_000,
  maxRetries: 1,
  autonomyLevel: 1,
  escalationRules: [ /* at least one required */ ],
  appliesActionKind: null,
  hasTestSuite: true,
  status: "active",
};
```

Rejected at registration:

- `costBudgetMinor <= 0` — an uncapped agent can bankrupt a venture
- zero escalation rules — an agent with nowhere to escalate hides failures
- `autonomyLevel >= 3` with `hasTestSuite: false` — no unattended execution
  without tests
- a tool that appears in both `allowedTools` and `prohibitedActions`

---

## The runner's pre-flight checks

`AgentRunner.run()` performs six checks before any inference happens. Nothing is
charged, sent or written until all six pass:

1. **Kill switches** — `killswitch.all_automation`, `killswitch.agent_spend`
2. **Feature flag** — `feature.agent_runner`
3. **Definition status** — must be `active`; live mode also requires a test suite
4. **Input schema** — Zod validation, with the failing paths in the error
5. **Provider checks** —
   - a billable provider requires `ALLOW_PAID_PROVIDERS`
   - the injected provider must match the one the definition was priced for
   - a billable model needs a human-verified price in `MODEL_PRICES`
6. **Budget** — venture AI budget for the period. If exhausted, the run files an
   approval and returns `budget_exceeded` rather than failing silently into a
   retry loop

The result is a `Result<AgentRunOutcome, AgentRunFailure>`, not an exception —
callers are expected to handle refusal as a normal outcome.

---

## Tools

An agent may only call tools on its allow-list, and that is enforced **at call
time**, not merely declared to the model. A model asking for a tool it was
never given is a signal worth logging, not a request to satisfy.

```ts
const tool: Tool = {
  name: "knowledge.search",
  description: "Search approved knowledge documents.",
  inputSchema: { /* JSON Schema */ },
  actionKind: "knowledge.index",   // feeds the risk classifier
  readOnly: true,                  // read-only tools skip the approval gate
  execute: async (input, context) => { /* … */ },
};
```

Write tools go through the same autonomy policy as workflow steps: a write tool
whose action kind exceeds the agent's level escalates the run instead of
executing.

Phase 1 ships read-only tools only (`knowledge.search`, `crm.find_contact`,
`venture.metrics`). `crm.find_contact` deliberately withholds phone and raw
email — an agent that never sees a contact detail cannot leak one into
generated copy.

---

## Prompts are versioned artefacts

`packages/prompts` holds an immutable registry. Registering an existing
`key@version` throws; editing means adding a version. Every agent run records
the prompt key and version, so a regression traces to a prompt change.

Every platform prompt inherits `BASE_GUARDRAILS`, which put the portfolio's
prohibitions into the model's context rather than only into documentation:

- Never invent facts, sources, citations, statistics or integration results
- Say so and stop when the context lacks the answer
- Never claim a legal review or certification exists
- Never promise guaranteed rankings or revenue
- Never state that a customer can eliminate all staff
- Never give legal, medical or individualised financial advice
- Cite the document or record id for every factual claim about a customer

---

## Knowledge grounding

Passing `knowledgeQuery` retrieves context from `packages/knowledge` and returns
the citations on the run outcome. Only **approved, in-effect** documents are
visible — draft, expired and archived knowledge is invisible to agents, so an
unreviewed page cannot become a customer commitment. There is a test for this.

---

## Cost accounting

Cost is computed from token usage and the model's price entry, **rounded up to
the cent** — under-reporting AI spend is the failure mode that quietly destroys
margin. Every entry is attributed to the agent run, the workflow run, the
venture and the customer.

`MODEL_PRICES` ships with mock entries priced at zero. A real model requires a
human to add its price with a verification date; the runner refuses to spend
against an unverified rate.

---

## The platform roster

| Agent | Level | Notes |
| --- | --- | --- |
| Research | 1 | Drafts only |
| Sales Development | 1 | Drafts outreach; cannot send |
| Support | 2 | Drafts replies from approved knowledge; escalates gaps |
| Quality Control | 3 | Adversarial reviewer; cannot publish |
| Finance | 2 | Categorises expenses; cannot move money |
| Operations | 1, draft | Needs monitoring tools that do not exist |
| Engineering | 1, draft | **Has no deploy tool by design** |

The engineering agent's exclusion is the clearest example of the framework's
approach: rather than trusting a rule that says "do not deploy without
approval", the capability simply is not granted.
