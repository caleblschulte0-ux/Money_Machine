import { Badge, Card, EmptyState, Table } from "@holdco/design-system";
import { AUTONOMY_LABELS, type AutonomyLevel } from "@holdco/core";
import { formatMinor, getPlatform } from "@/lib/platform";

export const dynamic = "force-dynamic";

const RUN_TONE: Record<string, "positive" | "caution" | "negative" | "neutral" | "info"> = {
  succeeded: "positive",
  running: "info",
  pending: "neutral",
  dry_run: "info",
  waiting_approval: "caution",
  failed: "negative",
  cancelled: "neutral",
  escalated: "caution",
  denied: "negative",
  budget_exceeded: "negative",
  timeout: "negative",
};

export default async function AutomationPage() {
  const { platform, organizationId } = await getPlatform();

  // EMPTY_PLATFORM_GUARD — nothing is operating; say so rather than render zeros.
  if (!organizationId) {
    return (
      <>
        <h1 className="page-title">Automation</h1>
        <EmptyState
          title="Nothing is operating"
          description="Workflows and agents are registered by venture modules; none are installed. Run DEMO_DATA=true pnpm dev to explore with fictional data, or create a real organization and venture first."
        />
      </>
    );
  }

  const workflows = platform.workflows.list();
  const agents = platform.agents.list();
  const runs = (
    await platform.store.workflowRuns.list({
      where: { organizationId },
      orderBy: { field: "createdAt", direction: "desc" },
      page: { limit: 15 },
    })
  ).items;
  const agentRuns = (
    await platform.store.agentRuns.list({
      where: { organizationId },
      orderBy: { field: "startedAt", direction: "desc" },
      page: { limit: 15 },
    })
  ).items;
  const flags = platform.flags.list();

  return (
    <>
      <h1 className="page-title">Automation</h1>
      <p className="page-subtitle">
        Workflows, agents and the switches that stop them. Every autonomy level is a ceiling granted
        by a human, not a claim about capability.
      </p>

      <Card title="Kill switches" subtitle="Pull one to stop work without editing any definition.">
        <Table headers={["Switch", "State", "Owner", "What it stops"]}>
          {flags
            .filter((flag) => flag.key.startsWith("killswitch."))
            .map((flag) => {
              const engaged = platform.flags.isEnabled(flag.key, { organizationId });
              return (
                <tr key={flag.key}>
                  <td className="mono">{flag.key}</td>
                  <td>
                    <Badge tone={engaged ? "negative" : "positive"}>
                      {engaged ? "engaged — stopped" : "clear"}
                    </Badge>
                  </td>
                  <td className="small muted">{flag.owner}</td>
                  <td className="small">{flag.description}</td>
                </tr>
              );
            })}
        </Table>
      </Card>

      <Card title="Registered workflows">
        {workflows.length === 0 ? (
          <EmptyState title="No workflows" description="No venture module has registered a workflow." />
        ) : (
          <Table headers={["Key", "Venture", "Trigger", "Autonomy", "Cost ceiling", "Status", "Steps"]}>
            {workflows.map((workflow) => (
              <tr key={`${workflow.key}@${workflow.version}`}>
                <td>
                  <div className="stack">
                    <span className="mono">{workflow.key}</span>
                    <span className="small muted">v{workflow.version} · {workflow.name}</span>
                  </div>
                </td>
                <td className="small">{workflow.ventureKey ?? "holding company"}</td>
                <td className="small mono">{workflow.trigger.type}</td>
                <td className="small">
                  L{workflow.autonomyLevel} — {AUTONOMY_LABELS[workflow.autonomyLevel as AutonomyLevel]}
                </td>
                <td className="num">{formatMinor(workflow.maxRunCostMinor)}</td>
                <td>
                  <Badge tone={workflow.status === "active" ? "positive" : "neutral"}>
                    {workflow.status}
                  </Badge>
                </td>
                <td className="num">{workflow.steps.length}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Registered agents">
        <Table headers={["Key", "Role", "Autonomy", "Budget/run", "Tools", "Tests", "Status"]}>
          {agents.map((agent) => (
            <tr key={agent.key}>
              <td>
                <div className="stack">
                  <span className="mono">{agent.key}</span>
                  <span className="small muted">{agent.name}</span>
                </div>
              </td>
              <td className="small">{agent.role}</td>
              <td className="small">L{agent.autonomyLevel}</td>
              <td className="num">{formatMinor(agent.costBudgetMinor)}</td>
              <td className="small mono">
                {agent.allowedTools.length > 0 ? agent.allowedTools.join(", ") : "none"}
              </td>
              <td>
                <Badge tone={agent.hasTestSuite ? "positive" : "caution"}>
                  {agent.hasTestSuite ? "tested" : "untested"}
                </Badge>
              </td>
              <td>
                <Badge tone={agent.status === "active" ? "positive" : "neutral"}>{agent.status}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Recent workflow runs">
        {runs.length === 0 ? (
          <EmptyState title="No runs yet" description="Workflow runs will appear here." />
        ) : (
          <Table headers={["Workflow", "Status", "Mode", "Trigger", "Cost", "Detail"]}>
            {runs.map((run) => (
              <tr key={run.id}>
                <td className="mono small">
                  {run.workflowKey} v{run.workflowVersion}
                </td>
                <td>
                  <Badge tone={RUN_TONE[run.status] ?? "neutral"}>{run.status.replace(/_/g, " ")}</Badge>
                </td>
                <td className="small">{run.mode}</td>
                <td className="small mono">{run.triggerType}</td>
                <td className="num">{formatMinor(run.costMinor)}</td>
                <td className="small muted">
                  {run.error ? JSON.stringify(run.error) : "—"}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Recent agent runs">
        {agentRuns.length === 0 ? (
          <EmptyState
            title="No agent runs yet"
            description="Agent runs record their prompt version, token usage and cost."
          />
        ) : (
          <Table headers={["Agent", "Status", "Provider", "Prompt", "Tokens", "Cost", "Latency"]}>
            {agentRuns.map((run) => (
              <tr key={run.id}>
                <td className="mono small">{run.agentKey}</td>
                <td>
                  <Badge tone={RUN_TONE[run.status] ?? "neutral"}>{run.status.replace(/_/g, " ")}</Badge>
                </td>
                <td className="small">
                  {run.provider}/{run.model}
                </td>
                <td className="small mono">
                  {run.promptKey} v{run.promptVersion}
                </td>
                <td className="num">{run.inputTokens + run.outputTokens}</td>
                <td className="num">{formatMinor(run.costMinor)}</td>
                <td className="num">{run.latencyMs}ms</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
