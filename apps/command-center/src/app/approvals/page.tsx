import {
  APPROVAL_TONE,
  Badge,
  Callout,
  Card,
  DefinitionList,
  EmptyState,
  Metric,
  MetricGrid,
  RISK_TONE,
} from "@holdco/design-system";
import { formatMinor, formatRelative, getPlatform } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const { platform, organizationId } = await getPlatform();
  const summary = await platform.approvals.summary(organizationId);
  const pending = await platform.approvals.pending(organizationId);
  const decided = [
    ...(await platform.approvals.byStatus(organizationId, "approved", 10)),
    ...(await platform.approvals.byStatus(organizationId, "denied", 10)),
  ].sort((a, b) => (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0));

  return (
    <>
      <h1 className="page-title">Human approval queue</h1>
      <p className="page-subtitle">
        Every high-risk action the automation refuses to take on its own. One queue, so there is
        exactly one place to look.
      </p>

      <Card>
        <MetricGrid>
          <Metric label="Pending" value={String(summary.pending)} tone={summary.pending > 0 ? "caution" : "positive"} />
          <Metric label="Overdue" value={String(summary.overdue)} tone={summary.overdue > 0 ? "negative" : "positive"} />
          <Metric label="Oldest waiting" value={formatRelative(summary.oldestPendingAgeMs)} />
          <Metric
            label="Financial impact pending"
            value={formatMinor(summary.pendingFinancialImpact.amountMinor)}
          />
        </MetricGrid>
      </Card>

      {summary.overdue > 0 && (
        <Callout tone="negative" title="Approvals have passed their deadline">
          An approval decided against stale context is worse than one that expired. Overdue
          requests are expired by the maintenance job rather than left actionable.
        </Callout>
      )}

      <Card title="Waiting on a human">
        {pending.length === 0 ? (
          <EmptyState
            title="Nothing waiting"
            description="No action is currently blocked on a human decision."
          />
        ) : (
          pending.map((approval) => (
            <div
              key={approval.id}
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 14,
                marginTop: 14,
              }}
            >
              <div className="row" style={{ marginBottom: 8 }}>
                <strong>{approval.title}</strong>
                <Badge tone={RISK_TONE[approval.riskClass] ?? "neutral"}>
                  {approval.riskClass} risk
                </Badge>
                <Badge tone={APPROVAL_TONE[approval.status] ?? "neutral"}>{approval.status}</Badge>
                {!approval.reversible && <Badge tone="negative">irreversible</Badge>}
              </div>
              <DefinitionList
                items={[
                  { term: "Proposed action", description: approval.summary },
                  { term: "Why it needs you", description: approval.reason },
                  {
                    term: "Financial impact",
                    description: formatMinor(approval.financialImpactMinor) ?? "$0.00",
                  },
                  {
                    term: "Requested by",
                    description: `${approval.requestedBy} (${approval.requestedByType})`,
                  },
                  {
                    term: "Reversible",
                    description: approval.reversible ? "Yes — can be undone" : "No — cannot be undone",
                  },
                  {
                    term: "Deadline",
                    description: approval.deadlineAt
                      ? approval.deadlineAt.toISOString().slice(0, 16).replace("T", " ")
                      : "None set",
                  },
                  {
                    term: "Evidence",
                    description: (
                      <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(approval.evidence, null, 2)}
                      </pre>
                    ),
                  },
                  {
                    term: "Action payload",
                    description: (
                      <pre className="mono" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                        {JSON.stringify(approval.payload, null, 2)}
                      </pre>
                    ),
                  },
                ]}
              />
              <p className="small muted" style={{ marginTop: 10 }}>
                Approving replays this payload verbatim. Deciding from this screen is not wired up
                in Phase 1 — see docs/KNOWN_LIMITATIONS.md.
              </p>
            </div>
          ))
        )}
      </Card>

      <Card title="Recently decided">
        {decided.length === 0 ? (
          <EmptyState title="No decisions yet" description="Decided approvals will appear here." />
        ) : (
          <ul className="small">
            {decided.map((approval) => (
              <li key={approval.id}>
                <Badge tone={APPROVAL_TONE[approval.status] ?? "neutral"}>{approval.status}</Badge>{" "}
                {approval.title} — decided by {approval.decidedByUserId ?? "unknown"}
                {approval.decisionNotes ? ` · ${approval.decisionNotes}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
