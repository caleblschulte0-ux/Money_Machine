# Autonomy levels

Every workflow and every agent carries an autonomy level. The level is a
**ceiling granted by a human**, not a claim about how capable the automation is.

| Level | Name | What happens |
| --- | --- | --- |
| 0 | Manual | A human does the work. The system only records it. |
| 1 | Assisted | AI drafts or recommends. A human does the work. |
| 2 | Human Approval | AI completes the work; a human approves before it takes effect. |
| 3 | Rules-Based Autonomous | AI executes within explicit numeric limits and logs everything. |
| 4 | Exception-Based Oversight | AI executes normally and escalates exceptions. |
| 5 | Fully Automated | AI completes the workflow with no routine human involvement. |

---

## Risk classes cap the level

The granted level is not the final word. Every action has an `actionKind` with
a risk class, and each class has a hard ceiling that the grant cannot exceed:

| Risk class | Ceiling | Examples |
| --- | --- | --- |
| `low` | 5 | report generation, internal tagging, analytics, backup verification |
| `medium` | 4 | transactional email, marketing email, scheduled publishing, agent runs |
| `high` | 2 | payments, refunds, invoices, contracts, discounts, campaign launch, data export, deploys, venture activation, capital allocation |
| `prohibited` | denied | legal advice, medical advice, hiring, termination, regulator communication, property transactions, fabricated reviews, impersonation |

`decideAutonomy()` in `packages/core/src/autonomy.ts` is the single place this
is decided. It returns `execute`, `require_approval`, or `deny`.

Two properties are load-bearing:

**Unknown action kinds are `high` risk.** `riskClassFor()` falls back to `high`
for anything not in the table. A newly added action does not get to be cheap by
default; someone has to classify it deliberately.

**The ceiling always beats the grant.** Granting a venture level 5 cannot make
a refund unattended. There is a test for each of these.

---

## Additional escalation triggers

Beyond the class ceiling, an action escalates when:

- **Financial impact meets or exceeds the approval threshold**
  (`APPROVAL_THRESHOLD_USD`, default $100). At or above, not merely above.
- **The action is declared irreversible.** `reversible: false` caps the
  effective level at 2 regardless of risk class.
- **The effective level is 0, 1 or 2.** Those levels mean a human decides, by
  definition.

---

## Where levels are set

```ts
// A venture's ceiling — every workflow in it is capped here.
venture.maxAutonomyLevel = 3;

// A workflow's grant.
export const LEAD_INTAKE: WorkflowDefinition = { autonomyLevel: 3, ... };

// An agent's grant.
export const RESEARCH_AGENT: AgentDefinition = { autonomyLevel: 1, ... };
```

An agent's level governs its **tool calls**: a write tool whose action kind
exceeds the agent's level causes the run to escalate rather than proceed.

---

## Level 5 is rare on purpose

Level 5 is only permitted for low-risk, reversible processes. Reasonable
candidates:

- Report generation and analytics recomputation
- Data cleaning and internal tagging
- Content format conversion
- Scheduling already-approved posts
- Backup verification
- Routine reminders

Everything involving contracts, money movement, legal claims, regulatory
communication, hiring, termination, medical or financial advice, property
transactions, major refunds or public crisis response stays at 2 or below —
and several are prohibited outright.

---

## Additional constraints on high autonomy

Enforced at definition time, not by convention:

- **A workflow at level 3+ must declare `trigger.idempotencyPath`.**
  Unattended execution without idempotency duplicates work on every replay.
  `validateWorkflow()` rejects it.
- **An agent at level 3+ must have `hasTestSuite: true`.**
  `validateAgentDefinition()` rejects unattended execution without tests.
- **Every agent must declare at least one escalation rule.** An agent with
  nowhere to escalate hides its failures.
- **Every agent must have a positive cost budget.** An uncapped agent can
  bankrupt a venture.

---

## Raising a level

1. Run the workflow at its current level long enough to see its failure modes.
2. Confirm every step is genuinely reversible, or mark the irreversible ones.
3. Confirm the idempotency key is correct — replay the same trigger twice in
   staging and check exactly one run executes.
4. Set a cost ceiling that a runaway loop cannot exceed meaningfully.
5. Confirm the kill switch works.
6. Raise the level by one. Never two.
7. Watch the run history and the escalation rate for a full cycle.

Lowering a level needs no ceremony. Do it immediately when something surprises
you.
