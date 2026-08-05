import Link from "next/link";
import {
  Badge,
  Callout,
  Card,
  Disclaimer,
  Metric,
  MetricGrid,
  Table,
  STAGE_TONE,
} from "@holdco/design-system";
import { formatMinor, formatPercent, getPlatform } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { platform, organizationId, periodKey } = await getPlatform();
  const summary = await platform.analytics.portfolio(organizationId, periodKey);
  const approvals = await platform.approvals.summary(organizationId);
  const automation = await platform.analytics.automationHealth(organizationId);

  const shutdownCandidates = summary.ventures.filter(
    (v) => v.killRecommendation === "shutdown_recommended",
  );
  const reviewCandidates = summary.ventures.filter((v) => v.killRecommendation === "review");

  return (
    <>
      <h1 className="page-title">Portfolio overview</h1>
      <p className="page-subtitle">
        Period {periodKey} · {summary.ventures.length} ventures ·{" "}
        {summary.counts.launched ?? 0} launched, {summary.counts.validation ?? 0} in validation
      </p>

      {shutdownCandidates.length > 0 && (
        <Callout tone="negative" title={`${shutdownCandidates.length} venture(s) recommended for shutdown or sale`}>
          {shutdownCandidates.map((v) => v.ventureKey).join(", ")}. Work already invested is not a
          reason to keep funding them.
        </Callout>
      )}
      {reviewCandidates.length > 0 && (
        <Callout tone="caution" title={`${reviewCandidates.length} venture(s) have a kill criterion triggered`}>
          {reviewCandidates.map((v) => v.ventureKey).join(", ")}. Decide deliberately rather than
          drifting.
        </Callout>
      )}

      <Card title="This period">
        <MetricGrid>
          <Metric label="Revenue" value={formatMinor(summary.totalRevenue.amountMinor)} />
          <Metric
            label="Gross profit"
            value={formatMinor(summary.totalGrossProfit.amountMinor)}
            tone={summary.totalGrossProfit.amountMinor >= 0 ? "positive" : "negative"}
          />
          <Metric
            label="Net contribution"
            value={formatMinor(summary.totalNetContribution.amountMinor)}
            tone={summary.totalNetContribution.amountMinor >= 0 ? "positive" : "negative"}
          />
          <Metric label="Total spend" value={formatMinor(summary.totalSpend.amountMinor)} />
          <Metric
            label="Cash burn"
            value={formatMinor(summary.cashBurn.amountMinor)}
            tone={summary.cashBurn.amountMinor > 0 ? "caution" : "positive"}
            hint="Spend minus revenue"
          />
          <Metric label="AI inference" value={formatMinor(summary.totalAiSpend.amountMinor)} />
          <Metric
            label="Pending approvals"
            value={String(approvals.pending)}
            tone={approvals.pending > 0 ? "caution" : "neutral"}
            hint={approvals.overdue > 0 ? `${approvals.overdue} overdue` : undefined}
          />
          <Metric label="Open support cases" value={String(summary.openSupportCases)} />
        </MetricGrid>
        <Disclaimer>{summary.disclaimer}</Disclaimer>
      </Card>

      <Card
        title="Ventures"
        subtitle="Health is scored only over dimensions with evidence; coverage says how much of the picture is measured."
      >
        <Table
          headers={[
            "Venture", "Stage", "Revenue", "Gross profit", "Spend", "MRR",
            "Customers", "Automation", "Health", "Signal",
          ]}
        >
          {summary.ventures.map((venture) => (
            <tr key={venture.ventureId}>
              <td>
                <div className="stack">
                  <Link href={`/ventures/${venture.ventureKey}`}>{venture.name}</Link>
                  <span className="small muted">{venture.brandName}</span>
                </div>
              </td>
              <td>
                <Badge tone={STAGE_TONE[venture.stage] ?? "neutral"}>
                  {venture.stage.replace(/_/g, " ")}
                </Badge>
              </td>
              <td className="num">{formatMinor(venture.revenue?.amountMinor) ?? <span className="muted small">not measured</span>}</td>
              <td className="num">{formatMinor(venture.grossProfit?.amountMinor) ?? <span className="muted small">—</span>}</td>
              <td className="num">{formatMinor(venture.spend.amountMinor)}</td>
              <td className="num">{formatMinor(venture.mrr.amountMinor)}</td>
              <td className="num">{venture.customerCount ?? <span className="muted small">—</span>}</td>
              <td className="num">
                {formatPercent(venture.automationPercent) ?? <span className="muted small">—</span>}
              </td>
              <td>
                {venture.health?.score === null || venture.health === null ? (
                  <span className="muted small">unscored</span>
                ) : (
                  <div className="stack">
                    <span className="num">{venture.health.score}/100</span>
                    <span className="small muted">
                      {(venture.health.coverage * 100).toFixed(0)}% evidenced
                    </span>
                  </div>
                )}
              </td>
              <td>
                {venture.killRecommendation === "shutdown_recommended" ? (
                  <Badge tone="negative">shutdown</Badge>
                ) : venture.killRecommendation === "review" ? (
                  <Badge tone="caution">review</Badge>
                ) : venture.killRecommendation === "continue" ? (
                  <Badge tone="positive">continue</Badge>
                ) : (
                  <span className="muted small">no data</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Automation reliability" subtitle="Last 7 days across every venture.">
        <MetricGrid>
          <Metric label="Workflow runs" value={String(automation.workflowRuns)} />
          <Metric
            label="Workflow failures"
            value={String(automation.workflowFailures)}
            tone={automation.workflowFailures > 0 ? "caution" : "positive"}
          />
          <Metric label="Agent runs" value={String(automation.agentRuns)} />
          <Metric
            label="Agent failures"
            value={String(automation.agentFailures)}
            tone={automation.agentFailures > 0 ? "caution" : "positive"}
          />
          <Metric
            label="Escalations"
            value={String(automation.escalations)}
            hint="Handed to a human"
          />
          <Metric
            label="Failure rate"
            value={formatPercent(automation.failureRate)}
            unmeasuredReason="No runs yet"
          />
        </MetricGrid>
      </Card>

      {summary.measurementGaps.length > 0 && (
        <Card title="Measurement gaps" subtitle="What the platform cannot currently tell you.">
          <ul className="small">
            {summary.measurementGaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
