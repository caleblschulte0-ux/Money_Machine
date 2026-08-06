/**
 * Background worker.
 *
 * Runs the maintenance jobs that keep the platform honest over time:
 * expiring approvals nobody decided, expiring knowledge nobody renewed,
 * flagging experiments that are quietly becoming permanent expenses, draining
 * the workflow failure queue, and pruning dead sessions.
 *
 * It deliberately does not *start* new commercial work — nothing here sends a
 * message, charges a customer or launches a campaign. Those all originate from
 * a trigger with a human or a workflow behind it.
 *
 * Usage: pnpm worker
 */
import { createPlatform, type Platform } from "@holdco/platform";
import { errorContext } from "@holdco/observability";
import { SHOTS, ShotScoreboard } from "@holdco/shots";

interface JobResult {
  readonly job: string;
  readonly outcome: string;
  readonly durationMs: number;
}

async function forEachOrganization(
  platform: Platform,
  fn: (organizationId: string) => Promise<string>,
): Promise<string> {
  const organizations = await platform.store.organizations.all({ where: { status: "active" } });
  if (organizations.length === 0) return "no active organizations";
  const results: string[] = [];
  for (const organization of organizations) {
    results.push(`${organization.slug}: ${await fn(organization.id)}`);
  }
  return results.join("; ");
}

const JOBS: Record<string, (platform: Platform) => Promise<string>> = {
  async expireApprovals(platform) {
    return forEachOrganization(platform, async (organizationId) => {
      const expired = await platform.approvals.expireOverdue(organizationId);
      return `${expired} approval(s) expired`;
    });
  },

  async expireKnowledge(platform) {
    return forEachOrganization(platform, async (organizationId) => {
      const expired = await platform.knowledge.expireStale(organizationId);
      return `${expired} document(s) expired`;
    });
  },

  async flagExperiments(platform) {
    return forEachOrganization(platform, async (organizationId) => {
      const due = await platform.experiments.reviewDue(organizationId);
      for (const report of due) {
        await platform.alerts.raise({
          key: `experiment.review_due:${report.experiment.id}`,
          severity: "warning",
          title: `Experiment "${report.experiment.key}" needs a decision`,
          description: report.reasons.join(" "),
          organizationId,
          ventureId: report.experiment.ventureId ?? undefined,
          context: {
            spentMinor: report.spend.amountMinor,
            maxLossMinor: report.experiment.maxLossMinor,
            daysRemaining: report.daysRemaining,
          },
        });
      }
      return `${due.length} experiment(s) awaiting a decision`;
    });
  },

  async pruneSessions(platform) {
    return forEachOrganization(platform, async (organizationId) => {
      const pruned = await platform.auth.pruneSessions(organizationId);
      return `${pruned} expired session(s) removed`;
    });
  },

  async reportAutomationHealth(platform) {
    return forEachOrganization(platform, async (organizationId) => {
      const health = await platform.analytics.automationHealth(organizationId, 1);
      if (health.failureRate !== null && health.failureRate > 0.2) {
        await platform.alerts.raise({
          key: `automation.failure_rate:${organizationId}`,
          severity: "high",
          title: "Automation failure rate above 20% in the last 24 hours",
          description:
            `${health.workflowFailures} workflow and ${health.agentFailures} agent failures ` +
            `across ${health.workflowRuns + health.agentRuns} runs.`,
          organizationId,
          context: { failureRate: health.failureRate },
        });
      }
      return `${health.workflowRuns} workflow runs, ${health.workflowFailures} failures`;
    });
  },

  /**
   * Email the owner a digest of how every shot is doing. This is the
   * hands-off loop: nothing to check, the numbers arrive. Requires
   * OWNER_NOTIFY_EMAIL and a delivering email provider; otherwise reports
   * what is missing instead of pretending it sent.
   */
  async shotsDigest(platform) {
    const to = platform.env.OWNER_NOTIFY_EMAIL;
    if (!to) return "skipped — OWNER_NOTIFY_EMAIL is not set";

    return forEachOrganization(platform, async (organizationId) => {
      const scoreboard = new ShotScoreboard(platform.store, platform.clock);
      const results = await scoreboard.scoreAll(organizationId, SHOTS);
      const lines = results.map(
        (r) =>
          `${r.shot.name.padEnd(24)} seen ${String(r.uniqueVisitors).padStart(4)}  ` +
          `signups ${String(r.signups).padStart(3)}  ${r.verdict.replace(/_/g, " ")}\n  -> ${r.whatToDo}`,
      );
      const outcome = await platform.communications.sendEmail({
        organizationId,
        ventureId: null,
        to,
        from: platform.env.SMTP_FROM ?? "shots@localhost",
        subject: `Shots digest — ${scoreboard.summarize(results)}`,
        body: `${scoreboard.summarize(results)}\n\n${lines.join("\n\n")}\n`,
        purpose: "transactional",
      });
      return `digest ${outcome.status}` + ("reason" in outcome ? ` (${outcome.reason})` : "");
    });
  },

  async drainFailureQueue(platform) {
    const now = platform.clock.now();
    const due = await platform.store.scheduledJobs.all({
      where: { status: "scheduled", runAt: { lte: now } } as never,
    });
    if (due.length === 0) return "no queued retries due";

    let handled = 0;
    for (const job of due) {
      // Phase 1 records the retry and surfaces it; automatic re-execution of a
      // failed workflow is not built, because replaying a half-completed run
      // without knowing which side effects landed can double-charge or
      // double-send. See docs/KNOWN_LIMITATIONS.md.
      await platform.store.scheduledJobs.update(job.id, {
        status: "failed",
        lastError:
          "Automatic workflow retry is not implemented. A human must inspect the failed run " +
          "and decide whether re-running is safe.",
      });
      await platform.alerts.raise({
        key: `workflow.retry_needs_human:${job.id}`,
        severity: "warning",
        title: `Queued workflow retry needs a human: ${job.key}`,
        description:
          "A workflow step failed and was queued for retry. Automatic replay is not implemented; " +
          "inspect the run before re-triggering it.",
        organizationId: job.organizationId,
        ventureId: job.ventureId ?? undefined,
        context: { jobKey: job.key },
      });
      handled++;
    }
    return `${handled} queued retry/retries escalated to a human`;
  },
};

async function main(): Promise<void> {
  const platform = await createPlatform();
  const logger = platform.logger.child({ component: "worker" });
  const only = process.argv[2];

  const jobNames = only ? [only] : Object.keys(JOBS);
  const unknown = jobNames.filter((name) => !JOBS[name]);
  if (unknown.length > 0) {
    logger.error("unknown job", { requested: unknown, available: Object.keys(JOBS) });
    process.exitCode = 1;
    await platform.shutdown();
    return;
  }

  logger.info("worker starting", { jobs: jobNames, storeDriver: platform.store.driver });

  const results: JobResult[] = [];
  for (const name of jobNames) {
    const startedAt = Date.now();
    try {
      const outcome = await JOBS[name]!(platform);
      results.push({ job: name, outcome, durationMs: Date.now() - startedAt });
      logger.info("job finished", { job: name, outcome });
    } catch (error) {
      results.push({ job: name, outcome: "FAILED", durationMs: Date.now() - startedAt });
      logger.error("job failed", { job: name, ...errorContext(error) });
      process.exitCode = 1;
    }
  }

  logger.info("worker finished", {
    jobs: results.length,
    failures: results.filter((r) => r.outcome === "FAILED").length,
  });

  if (platform.store.driver === "memory") {
    logger.warn(
      "worker ran against the in-memory store, so it operated on an empty world. " +
        "Set STORE_DRIVER=prisma to run against real data.",
      {},
    );
  }

  await platform.shutdown();
}

main().catch((error) => {
  console.error("Worker failed to start:", error);
  process.exitCode = 1;
});
