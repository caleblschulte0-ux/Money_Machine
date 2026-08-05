# Incident response

## First action, always

**Pull the kill switch before diagnosing.**

```ts
platform.flags.setOverride({
  key: "killswitch.all_automation",
  value: true,
  reason: "Incident <date>: <one line>",
  setBy: "<who>",
  setAt: new Date(),
});
```

Narrower switches: `killswitch.outbound_communications` (stops sending),
`killswitch.agent_spend` (stops inference), and per-venture switches.

Switches take effect immediately and need no deploy. Stopping a working system
for an hour costs less than an hour of a broken one running.

## Severity

| Severity | Meaning | Response |
| --- | --- | --- |
| Critical | Customer data exposed, money moved incorrectly, or automation actively causing harm | Immediate; kill switch first |
| High | Customer-impacting outage, or a failure rate above 20% | Same day |
| Warning | Degraded behaviour, no customer impact yet | Next business day |
| Info | Recorded for the record | No response expected |

The alerting layer refuses to raise a `critical` alert without a runbook link —
a critical page with no documented response is noise.

## Procedure

**1. Contain.** Kill switch. If credentials are implicated, revoke them.

**2. Assess.** The audit trail is the primary tool. Every consequential action
has an actor, a timestamp and a correlation id.

```ts
await platform.audit.query({ organizationId, since: incidentStart, limit: 500 });
await platform.audit.history(organizationId, "approval", approvalId);
```

Workflow and agent runs record their inputs, outputs, errors and costs.

**3. Determine blast radius.**
- Which organizations and ventures are affected?
- Was customer data read or exported? (`data.export` is a high-risk action and
  is always audited.)
- Did money move? Check `payments` — and note whether the provider was a mock.
- Did anything go out? Check `communications` by status.

**4. Notify.** Customers first if their data or service is affected. Say what
happened, what you know, and what you are doing. Do not speculate about cause
before you know.

**5. Recover.** Fix the cause, not the symptom. Restore from backup only after
confirming the backup predates the incident.

**6. Postmortem.** Written into the knowledge base as `kind: "postmortem"`,
blameless, and specific:
- Timeline with timestamps from the audit trail
- What the system did and what it should have done
- Which control failed, or which control did not exist
- What changes, and who owns each change

**7. Re-enable.** Clear the kill switch only after the fix is verified, and
watch the run history for a full cycle.

## Specific scenarios

**Runaway agent spend.** `killswitch.agent_spend`. Check `costEntries` by
`agentRunId` to find the loop. Lower the venture's budget before re-enabling —
the budget check is what should have caught it, so fix that too.

**Mass incorrect send.** `killswitch.outbound_communications`. Query
`communications` for status `sent` in the window. Suppress affected recipients
if appropriate. Notify. The likely root cause is a compliance check that was
bypassed rather than the transport itself.

**Suspected data exposure.** Revoke sessions and API keys. Audit-query for
`data.export` and `record.created` by the suspect actor. Preserve logs before
they rotate. Treat legal notification obligations as jurisdiction-specific and
get advice.

**Wrong charge.** Stop `feature.billing_charges`. Reconcile `payments` against
`invoices`. Refund proactively — a refund is cheaper than a dispute. Every
refund is a high-risk action and goes through the approval queue.
