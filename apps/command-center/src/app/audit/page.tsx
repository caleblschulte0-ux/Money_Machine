import { Badge, Card, EmptyState, Table } from "@holdco/design-system";
import { getPlatform } from "@/lib/platform";

export const dynamic = "force-dynamic";

const ACTOR_TONE: Record<string, "positive" | "info" | "caution" | "neutral"> = {
  human: "positive",
  agent: "info",
  workflow: "info",
  system: "neutral",
  customer: "caution",
};

export default async function AuditPage() {
  const { platform, organizationId } = await getPlatform();
  const events = await platform.audit.query({ organizationId, limit: 100 });

  return (
    <>
      <h1 className="page-title">Audit trail</h1>
      <p className="page-subtitle">
        Every consequential action, with who took it. Payloads are redacted before storage, so this
        is safe to read.
      </p>

      <Card title={`Last ${events.length} events`}>
        {events.length === 0 ? (
          <EmptyState title="No events" description="Nothing has happened yet." />
        ) : (
          <Table headers={["When", "Actor", "Action", "Entity", "Summary"]}>
            {events.map((event) => (
              <tr key={event.id}>
                <td className="small num">
                  {event.occurredAt.toISOString().slice(0, 19).replace("T", " ")}
                </td>
                <td>
                  <div className="stack">
                    <Badge tone={ACTOR_TONE[event.actorType] ?? "neutral"}>{event.actorType}</Badge>
                    {event.actorId && <span className="small muted mono">{event.actorId}</span>}
                  </div>
                </td>
                <td className="small mono">{event.action}</td>
                <td className="small muted">
                  <div className="stack">
                    <span>{event.entityType}</span>
                    {event.entityId && <span className="mono">{event.entityId}</span>}
                  </div>
                </td>
                <td className="small">{event.summary}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
