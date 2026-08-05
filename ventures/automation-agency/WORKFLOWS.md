# Workflows

## `agency.lead_intake` — active, autonomy level 3

Trigger: `lead.created` where `ventureKey = "automation-agency"`.
Idempotency: `leadId`. Kill switch: `killswitch.automation_agency_outreach`.

| Step | Action | Notes |
| --- | --- | --- |
| `tag_source` | `record.tag` | Tags the lead with its channel |
| `qualification_task` | `task.create` | High priority; instructs the human not to quote a saving without a baseline |
| `notify_lead_owner` | `human.notify` | Only when score ≥ 60 |

Level 3 is safe here because every step is low-risk, reversible and internal.
Nothing reaches the prospect: **the workflow does not send anything.** First
contact is a human decision.

## `agency.audit_delivery` — active, autonomy level 2

Trigger: `manual`, keyed on `projectId`. Cost ceiling: $3.00.

| Step | Action | Notes |
| --- | --- | --- |
| `analyse` | `agent.run` → `agency.audit_analyst` | Findings from client-supplied figures only |
| `quality_review` | `agent.run` → `quality.control` | Adversarial review of the findings |
| `proposal` | `document.generate` | Marked `reversible: false` |

At level 2 every step requires human approval, so in practice the run stops at
the first step and files an approval. That is intentional for a workflow whose
output is a priced commercial proposal.

`document.generate` is currently a **simulated** action — it records what it
would produce and returns `simulated: true`. See `docs/KNOWN_LIMITATIONS.md`.

## The audit analyst agent

`agency.audit_analyst`, autonomy level 1 (drafts only), budget $0.75 per run.

Its prompt enforces the venture's claim boundary at generation time:

- Report hours the client supplied; output "hours not supplied" rather than
  estimating
- Never claim a role or person can be eliminated — report hours, not headcount
- Flag any process touching payments, contracts, hiring, termination, medical or
  legal decisions as `REQUIRES_HUMAN_APPROVAL`

Prohibited actions: marketing email, contract sending, charging, termination.

## Lead scoring

`SCORING_MODEL` in `src/scoring.ts` (max 100, qualified at 60):

| Signal | Points |
| --- | --- |
| 20+ employees | +20 |
| Over 500 employees | −15 |
| States 20+ hours/month on the process | +25 |
| Budget range supplied | +15 |
| Contact has buying authority | +20 |
| Named the systems involved | +10 |
| Wants to move this quarter | +10 |
| Research, student or competitor | **disqualified** |
| Stated goal is eliminating staff | **disqualified** |

The last rule routes those conversations to a human rather than through
automated qualification — it is outside what this venture sells, and the reason
is recorded on the lead.

## Not built

Client onboarding, credential intake, change requests, service monitoring,
monthly ROI reporting, and renewal workflows. Each becomes a workflow once the
manual version has run enough times to know its real shape.
