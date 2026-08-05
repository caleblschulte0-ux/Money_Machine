import { Badge, Callout, Card, Disclaimer, EmptyState, Metric, MetricGrid, Table } from "@holdco/design-system";
import { buildAllocationPlan, type VentureAllocationInput } from "@holdco/cost-accounting";
import { computeVentureHealth, evaluateKillCriteria } from "@holdco/ventures";
import { money } from "@holdco/core";
import { formatMinor, formatPercent, getPlatform } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const { platform, organizationId, periodKey } = await getPlatform();

  // EMPTY_PLATFORM_GUARD — nothing is operating; say so rather than render zeros.
  if (!organizationId) {
    return (
      <>
        <h1 className="page-title">Costs and capital</h1>
        <EmptyState
          title="Nothing is operating"
          description="No spend has been recorded because nothing is operating. Run DEMO_DATA=true pnpm dev to explore with fictional data, or create a real organization and venture first."
        />
      </>
    );
  }

  const byCategory = await platform.costs.byCategory(organizationId, periodKey);
  const byVenture = await platform.costs.byVenture(organizationId, periodKey);
  const ventures = await platform.ventures.list(organizationId);
  const entries = await platform.costs.entries({ organizationId, periodKey });

  const allocationInputs: VentureAllocationInput[] = [];
  for (const venture of ventures) {
    const snapshot = await platform.ventures.snapshot(venture.id, periodKey);
    const health = snapshot ? computeVentureHealth({ ventureId: venture.id, current: snapshot }) : null;
    const kill = snapshot
      ? evaluateKillCriteria({ snapshot, stopLossMinor: venture.stopLossMinor || undefined })
      : null;
    const readiness = await platform.ventures.launchReadiness(venture.id);

    allocationInputs.push({
      ventureId: venture.id,
      ventureKey: venture.key,
      stage: venture.stage,
      healthScore: health?.score ?? null,
      healthCoverage: health?.coverage ?? 0,
      monthlyRevenue: money(snapshot?.revenueMinor ?? 0),
      monthlyGrossProfit: health?.grossProfit ?? money(0),
      monthlySpend: byVenture.get(venture.id) ?? money(0),
      currentBudget: money(venture.monthlyBudgetMinor),
      killCriteriaTriggered: kill?.triggered.length ?? 0,
      gatesPassed: readiness.ready,
    });
  }

  const totalBudget = allocationInputs.reduce((sum, v) => sum + v.currentBudget.amountMinor, 0);
  const plan = buildAllocationPlan(periodKey, money(totalBudget), allocationInputs);
  const showAllocation = platform.flags.isEnabled(
    "feature.command_center_capital_allocation",
    { organizationId },
  );

  return (
    <>
      <h1 className="page-title">Costs and capital</h1>
      <p className="page-subtitle">
        Every expense is attributed to a venture, and where applicable to a customer, campaign,
        product and experiment. Period {periodKey}.
      </p>

      <Card title="Spend by category">
        {Object.keys(byCategory).length === 0 ? (
          <EmptyState title="No spend recorded" description="Nothing has been charged this period." />
        ) : (
          <MetricGrid>
            {Object.entries(byCategory).map(([category, amount]) => (
              <Metric
                key={category}
                label={category.replace(/_/g, " ")}
                value={formatMinor(amount.amountMinor)}
              />
            ))}
          </MetricGrid>
        )}
      </Card>

      <Card title="Spend by venture">
        <Table headers={["Venture", "Spend", "Monthly budget", "Utilisation", "Stop-loss"]}>
          {ventures.map((venture) => {
            const spend = byVenture.get(venture.id)?.amountMinor ?? 0;
            const utilisation = venture.monthlyBudgetMinor > 0 ? spend / venture.monthlyBudgetMinor : null;
            return (
              <tr key={venture.id}>
                <td>{venture.name}</td>
                <td className="num">{formatMinor(spend)}</td>
                <td className="num">{formatMinor(venture.monthlyBudgetMinor)}</td>
                <td>
                  {utilisation === null ? (
                    <span className="muted small">no budget set</span>
                  ) : (
                    <div className="row">
                      <div className="bar" style={{ width: 90 }}>
                        <div
                          className="bar-fill"
                          style={{
                            width: `${Math.min(100, utilisation * 100)}%`,
                            background: utilisation >= 1 ? "#9b2c2c" : undefined,
                          }}
                        />
                      </div>
                      <span className="num small">{formatPercent(utilisation)}</span>
                    </div>
                  )}
                </td>
                <td className="num">{formatMinor(venture.stopLossMinor)}</td>
              </tr>
            );
          })}
          <tr>
            <td>
              <em>Holding company</em>
            </td>
            <td className="num">{formatMinor(byVenture.get(null)?.amountMinor ?? 0)}</td>
            <td className="num muted">—</td>
            <td className="muted small">shared costs</td>
            <td className="num muted">—</td>
          </tr>
        </Table>
      </Card>

      {showAllocation && (
        <Card
          title="Capital allocation recommendation"
          subtitle="Advisory only. The platform never moves, commits or authorises money."
        >
          <Callout tone="info" title="This is a recommendation, not an action">
            A human with the <span className="mono">capital:allocate</span> permission must approve
            any change. Confidence tracks how much of each venture&apos;s health is actually
            evidenced.
          </Callout>
          <Table headers={["Venture", "Action", "Current", "Recommended", "Delta", "Confidence", "Rationale"]}>
            {plan.recommendations.map((rec) => {
              const current = allocationInputs.find((v) => v.ventureId === rec.ventureId)!;
              return (
                <tr key={rec.ventureId}>
                  <td>{rec.ventureKey}</td>
                  <td>
                    <Badge
                      tone={
                        rec.action === "increase"
                          ? "positive"
                          : rec.action === "wind_down"
                            ? "negative"
                            : rec.action === "decrease" || rec.action === "freeze"
                              ? "caution"
                              : "neutral"
                      }
                    >
                      {rec.action.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="num">{formatMinor(current.currentBudget.amountMinor)}</td>
                  <td className="num">{formatMinor(rec.recommendedBudget.amountMinor)}</td>
                  <td className="num">{formatMinor(rec.delta.amountMinor)}</td>
                  <td className="num">{formatPercent(rec.confidence)}</td>
                  <td className="small muted">{rec.rationale.join(" ")}</td>
                </tr>
              );
            })}
          </Table>
          {plan.notes.map((note) => (
            <p key={note} className="small muted">
              {note}
            </p>
          ))}
          <Disclaimer>{plan.disclaimer}</Disclaimer>
        </Card>
      )}

      <Card title="Cost ledger" subtitle="Each entry carries its attribution dimensions.">
        {entries.length === 0 ? (
          <EmptyState title="No entries" description="Nothing recorded for this period." />
        ) : (
          <Table headers={["Date", "Category", "Amount", "Description", "Venture", "Customer", "Vendor"]}>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="small num">{entry.incurredAt.toISOString().slice(0, 10)}</td>
                <td className="small">{entry.category.replace(/_/g, " ")}</td>
                <td className="num">{formatMinor(entry.amountMinor)}</td>
                <td className="small">{entry.description}</td>
                <td className="small mono muted">{entry.ventureId ?? "holdco"}</td>
                <td className="small mono muted">{entry.customerAccountId ?? "—"}</td>
                <td className="small muted">{entry.vendorName ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
        <Disclaimer>
          Internal management figures derived from recorded platform events. Not audited financial
          statements and not a substitute for bookkeeping.
        </Disclaimer>
      </Card>
    </>
  );
}
