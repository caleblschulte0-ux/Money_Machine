import { notFound } from "next/navigation";
import {
  Badge,
  Callout,
  Card,
  DefinitionList,
  EmptyState,
  Metric,
  MetricGrid,
  STAGE_TONE,
  Table,
} from "@holdco/design-system";
import { evaluateKillCriteria, computeVentureHealth } from "@holdco/ventures";
import { formatMinor, formatPercent, getPlatform } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function VenturePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { platform, organizationId, periodKey } = await getPlatform();

  const venture = await platform.ventures.get(organizationId, key);
  if (!venture) notFound();

  const manifest = platform.ventureModules.get(key);
  const snapshot = await platform.ventures.snapshot(venture.id, periodKey);
  const readiness = await platform.ventures.launchReadiness(venture.id);
  const gates = await platform.ventures.gateResults(venture.id);

  const health = snapshot
    ? computeVentureHealth({ ventureId: venture.id, current: snapshot })
    : null;
  const kill = snapshot
    ? evaluateKillCriteria({
        snapshot,
        stopLossMinor: venture.stopLossMinor || undefined,
      })
    : null;

  return (
    <>
      <h1 className="page-title">{venture.name}</h1>
      <p className="page-subtitle">
        Brand: {venture.brandName} · <Badge tone={STAGE_TONE[venture.stage] ?? "neutral"}>{venture.stage.replace(/_/g, " ")}</Badge>{" "}
        · Autonomy ceiling: level {venture.maxAutonomyLevel}
      </p>

      <Card title="Thesis">
        <p style={{ margin: 0 }}>{venture.thesis}</p>
        {venture.stageReason && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Current stage because: {venture.stageReason}
          </p>
        )}
      </Card>

      {kill && kill.recommendation !== "continue" && (
        <Callout
          tone={kill.recommendation === "shutdown_recommended" ? "negative" : "caution"}
          title={kill.summary}
        >
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {kill.triggered.map((t) => (
              <li key={t.key}>
                <strong>{t.label}:</strong> {t.detail}
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <Card title={`Metrics — ${periodKey}`}>
        {snapshot ? (
          <MetricGrid>
            <Metric label="Revenue" value={formatMinor(snapshot.revenueMinor)} />
            <Metric label="Gross profit" value={formatMinor(health?.grossProfit.amountMinor)} />
            <Metric label="Net contribution" value={formatMinor(health?.netContribution.amountMinor)} />
            <Metric label="AI spend" value={formatMinor(snapshot.aiSpendMinor)} />
            <Metric label="Marketing" value={formatMinor(snapshot.marketingSpendMinor)} />
            <Metric label="Customers" value={String(snapshot.customerCount)} />
            <Metric label="Churned" value={String(snapshot.churnedCustomers)} />
            <Metric label="Human hours" value={String(snapshot.humanHours)} hint="Owner + staff time" />
            <Metric
              label="Automation"
              value={formatPercent(
                snapshot.automatedActions + snapshot.manualActions > 0
                  ? snapshot.automatedActions / (snapshot.automatedActions + snapshot.manualActions)
                  : null,
              )}
            />
          </MetricGrid>
        ) : (
          <EmptyState
            title="No snapshot for this period"
            description="Revenue, retention and automation are unmeasured until a metric snapshot is recorded."
          />
        )}
      </Card>

      {health && (
        <Card
          title="Health dimensions"
          subtitle={`Score ${health.score ?? "unscored"}/100 over ${(health.coverage * 100).toFixed(0)}% evidenced weight.`}
        >
          <Table headers={["Dimension", "Weight", "Score", "Basis"]}>
            {health.dimensions.map((dimension) => (
              <tr key={dimension.key}>
                <td>{dimension.label}</td>
                <td className="num">{dimension.weight}</td>
                <td className="num">
                  {dimension.score === null ? (
                    <span className="muted small">unscored</span>
                  ) : (
                    dimension.score
                  )}
                </td>
                <td className="small muted">{dimension.explanation}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Card
        title="Launch gates"
        subtitle={
          readiness.ready
            ? "All five gates pass. This venture may enter build, launch or scaling."
            : `Blocked by: ${readiness.blockingGates.join(", ")}.`
        }
      >
        <Table headers={["Gate", "Status", "Missing evidence", "Last reviewed"]}>
          {readiness.evaluations.map((evaluation) => {
            const record = gates[evaluation.gate];
            return (
              <tr key={evaluation.gate}>
                <td style={{ textTransform: "capitalize" }}>{evaluation.gate}</td>
                <td>
                  <Badge tone={evaluation.passed ? "positive" : "caution"}>
                    {evaluation.passed ? "passed" : "not passed"}
                  </Badge>
                </td>
                <td className="small muted">
                  {evaluation.missing.length > 0
                    ? evaluation.missing.join(", ")
                    : evaluation.notes.join(" ") || "—"}
                </td>
                <td className="small muted">
                  {record?.reviewedAt
                    ? record.reviewedAt.toISOString().slice(0, 10)
                    : record
                      ? "recorded, not reviewed"
                      : "never recorded"}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {manifest ? (
        <>
          <Card title="Offers" subtitle="What this venture sells, and what it explicitly does not promise.">
            {manifest.offers.map((offer) => (
              <div key={offer.key} style={{ marginBottom: 16 }}>
                <div className="row">
                  <strong>{offer.name}</strong>
                  <span className="num muted">
                    {formatMinor(offer.priceMinor)} / {offer.billingInterval.replace("_", " ")}
                  </span>
                </div>
                <DefinitionList
                  items={[
                    { term: "Deliverable", description: offer.deliverable },
                    { term: "Outcome we defend", description: offer.outcomeClaim },
                    {
                      term: "We do not promise",
                      description: (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {offer.nonClaims.map((claim) => (
                            <li key={claim}>{claim}</li>
                          ))}
                        </ul>
                      ),
                    },
                  ]}
                />
              </div>
            ))}
          </Card>

          <Card title="Kill criteria" subtitle="Agreed in advance, so a decision to stop is not a debate.">
            <Table headers={["Criterion", "Threshold", "Measured by"]}>
              {manifest.killCriteria.map((criterion) => (
                <tr key={criterion.description}>
                  <td>{criterion.description}</td>
                  <td className="small">{criterion.threshold}</td>
                  <td className="small muted">{criterion.measuredBy}</td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card title="Legal constraints">
            <ul className="small">
              {manifest.legalNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <Card title="Venture module">
          <EmptyState
            title="No module installed"
            description="This venture exists in the registry but no code module is registered, so it contributes no workflows or agents."
          />
        </Card>
      )}
    </>
  );
}
