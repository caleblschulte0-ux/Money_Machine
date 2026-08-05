import { Badge, Callout, Card, EmptyState, Table } from "@holdco/design-system";
import { formatMinor, getPlatform } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default async function ExperimentsPage() {
  const { platform, organizationId } = await getPlatform();
  const experiments = await platform.experiments.list(organizationId);
  const dueForReview = await platform.experiments.reviewDue(organizationId);

  return (
    <>
      <h1 className="page-title">Experiments</h1>
      <p className="page-subtitle">
        Every new initiative starts here with an end date and a maximum loss, so it cannot quietly
        become a permanent expense.
      </p>

      {dueForReview.length > 0 && (
        <Callout tone="caution" title={`${dueForReview.length} experiment(s) need a decision`}>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {dueForReview.map((report) => (
              <li key={report.experiment.id}>
                <strong>{report.experiment.key}</strong> — {report.reasons.join(" ")}
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <Card title="All experiments">
        {experiments.length === 0 ? (
          <EmptyState
            title="No experiments"
            description="Nothing is currently being tested. New initiatives should be created as experiments."
          />
        ) : (
          <Table
            headers={["Key", "Status", "Hypothesis", "Price", "Budget", "Max loss", "Window", "Decision"]}
          >
            {experiments.map((experiment) => (
              <tr key={experiment.id}>
                <td className="mono small">{experiment.key}</td>
                <td>
                  <Badge
                    tone={
                      experiment.status === "running"
                        ? "info"
                        : experiment.status === "review_due"
                          ? "caution"
                          : experiment.status === "decided"
                            ? "positive"
                            : "neutral"
                    }
                  >
                    {experiment.status.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="small">{experiment.hypothesis}</td>
                <td className="num">{formatMinor(experiment.priceMinor)}</td>
                <td className="num">{formatMinor(experiment.budgetMinor)}</td>
                <td className="num">{formatMinor(experiment.maxLossMinor)}</td>
                <td className="small num">
                  {experiment.startsAt.toISOString().slice(0, 10)} →{" "}
                  {experiment.endsAt.toISOString().slice(0, 10)}
                </td>
                <td className="small">
                  {experiment.decision ? (
                    <Badge tone="positive">{experiment.decision}</Badge>
                  ) : (
                    <span className="muted">pending</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Success and failure criteria" subtitle="Declared before the experiment starts.">
        {experiments.length === 0 ? (
          <EmptyState title="Nothing to show" description="Criteria appear once an experiment exists." />
        ) : (
          <Table headers={["Experiment", "Success metric", "Success threshold", "Failure metric", "Failure threshold"]}>
            {experiments.map((experiment) => (
              <tr key={experiment.id}>
                <td className="mono small">{experiment.key}</td>
                <td className="small">{experiment.successMetric}</td>
                <td className="small">{experiment.successThreshold}</td>
                <td className="small">{experiment.failureMetric}</td>
                <td className="small">{experiment.failureThreshold}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
