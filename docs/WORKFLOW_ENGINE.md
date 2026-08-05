# Workflow engine

`packages/workflows` — a trigger → condition → action engine shared by every
venture.

## Definitions are immutable data

A `WorkflowDefinition` is a plain object. Publishing a change means publishing a
new version; a run records the exact version it executed, so "why did it do
that in March" is answerable.

```ts
export const LEAD_INTAKE: WorkflowDefinition = {
  key: "agency.lead_intake",
  version: 1,
  name: "Automation audit lead intake",
  description: "Scores an inbound request and creates the qualification task.",
  ventureKey: "automation-agency",
  trigger: {
    type: "lead.created",
    when: { op: "equals", path: "ventureKey", value: "automation-agency" },
    idempotencyPath: "leadId",
  },
  autonomyLevel: 3,
  maxRunCostMinor: 100,
  killSwitchKey: "killswitch.automation_agency_outreach",
  status: "active",
  steps: [ /* ... */ ],
};
```

## Conditions are data, not code

```ts
{ op: "all", conditions: [
  { op: "gte", path: "trigger.score", value: 60 },
  { op: "not", condition: { op: "equals", path: "trigger.status", value: "spam" } },
]}
```

Operators: `equals`, `not_equals`, `exists`, `missing`, `gt`, `gte`, `lt`,
`lte`, `contains`, `in`, `matches`, plus `all` / `any` / `not`.

No `eval`, no template language, no predicate functions. A workflow definition
should be reviewable by someone who does not read TypeScript, and it must
evaluate identically in dry-run and live mode. Every evaluation produces a
human-readable trace that is stored on the step run.

Action inputs support `{{path}}` substitution against the run context —
substitution only, no expressions.

---

## Execution guarantees

Enforced in this order:

**1. Kill switches.** `killswitch.all_automation`, the engine's feature flag,
and the workflow's own switch. Any one stops the run before anything executes.

**2. Trigger condition.** Fails → run recorded as `cancelled` with the trace.

**3. Idempotency.** If `trigger.idempotencyPath` is set, a key is derived from
that path plus the workflow version. A replayed webhook returns the original
run instead of executing again. Records expire after 7 days.

**4. Per-step approval gating.** Each step's `actionKind` goes through
`approvals.gate()`. Three outcomes:
- `execute` — proceed
- `needs_approval` — file an approval with the exact payload, mark the run
  `waiting_approval`, stop
- `denied` — prohibited action; the step is marked `denied` and **no approval is
  filed**, because a prohibited action must not become approvable by asking

**5. Cost ceiling.** Checked *before* each step against
`maxRunCostMinor`. A step that would breach it does not run.

**6. Retries.** Per-step `maxRetries`. Only retryable errors are retried —
a `forbidden` or `policy_violation` fails immediately rather than hammering a
closed door.

**7. Failure handling.** `onFailure` is `stop` (default), `continue`, or
`queue`. `queue` writes a scheduled job for the worker.

**8. Compensation.** On failure, completed steps are compensated in reverse
order. A step's declared `compensate` action wins; otherwise the handler's own
`compensate()` is used. A step with neither is reported in the plan as
`NOT COMPENSATED — no undo is defined for this action` rather than silently
implying the world was restored.

---

## Modes

| Mode | Behaviour |
| --- | --- |
| `live` | Executes. Records costs, idempotency, audit. |
| `dry_run` | Evaluates conditions and resolves inputs, then records what each step *would* do. Executes nothing, writes no cost, consumes no idempotency key. |
| `mock` | Executes against mock adapters. |

```ts
const plan = await engine.dryRun(definition, trigger);
console.log(plan.plan);
// [ "[tag] would record.tag {...}", "[task] would create task ..." ]
```

---

## Actions

Handlers are supplied by the composition root, so the engine knows nothing
about email or documents. Built handlers: `task.create`, `email.send`,
`agent.run`, `record.update`, `record.tag`, `approval.request`, `human.notify`.

Unbuilt actions are registered as **simulated** handlers rather than omitted.
They run, record what they would have done, and return `simulated: true` in
their output — so a workflow referencing them stays runnable and no report can
mistake the result for a real effect.

---

## What a run records

- `WorkflowRunRecord` — status, mode, trigger payload, idempotency key,
  correlation id, cost, error, output
- One `WorkflowStepRunRecord` per step — resolved input, output, error,
  approval id, cost, attempts, and the condition trace when skipped
- Audit events for start and finish
- Metrics: run count, failure count, latency

Everything a human needs to reconstruct the decision is on those records.

---

## Adding a workflow

1. Write the definition in the venture module. Give every step an `actionKind`.
2. Mark irreversible steps `reversible: false`.
3. Set `maxRunCostMinor` above the sum of step estimates —
   `validateWorkflow()` rejects a workflow that could never complete.
4. Add `trigger.idempotencyPath` if autonomy is 3+ (required).
5. Register it in the module's `MODULE.workflows`.
6. Dry-run it before setting `status: "active"`.
