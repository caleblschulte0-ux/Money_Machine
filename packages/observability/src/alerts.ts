import type { JsonObject } from "@holdco/core";

/**
 * Alert severities (playbook §35). The rule that matters is the last one:
 * an alert nobody acts on is a defect, so every severity here has a stated
 * response expectation and `critical` requires a runbook link.
 */
export type AlertSeverity = "info" | "warning" | "high" | "critical";

export const SEVERITY_EXPECTATIONS: Record<AlertSeverity, string> = {
  info: "No response expected. Visible in the command center only.",
  warning: "Review within one business day.",
  high: "Review same day; customer impact is likely.",
  critical: "Immediate response; customers are affected or money is at risk.",
};

export interface Alert {
  readonly key: string;
  readonly severity: AlertSeverity;
  readonly title: string;
  readonly description: string;
  readonly ventureId?: string;
  readonly organizationId?: string;
  readonly context: JsonObject;
  readonly runbook?: string;
  readonly raisedAt: Date;
}

export interface AlertSink {
  publish(alert: Alert): void | Promise<void>;
}

export class MemoryAlertSink implements AlertSink {
  readonly alerts: Alert[] = [];
  publish(alert: Alert): void {
    this.alerts.push(alert);
  }
  bySeverity(severity: AlertSeverity): readonly Alert[] {
    return this.alerts.filter((a) => a.severity === severity);
  }
  clear(): void {
    this.alerts.length = 0;
  }
}

export interface RaiseAlertInput {
  key: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  ventureId?: string;
  organizationId?: string;
  context?: JsonObject;
  runbook?: string;
}

export class Alerter {
  /** Suppression window per alert key, to keep repeat failures from spamming. */
  private readonly lastSent = new Map<string, number>();

  constructor(
    private readonly sink: AlertSink,
    private readonly now: () => Date = () => new Date(),
    private readonly dedupeWindowMs = 15 * 60_000,
  ) {}

  async raise(input: RaiseAlertInput): Promise<boolean> {
    if (input.severity === "critical" && !input.runbook) {
      throw new Error(
        `Critical alert "${input.key}" must reference a runbook. ` +
          `A critical page with no documented response is noise.`,
      );
    }
    const now = this.now().getTime();
    const previous = this.lastSent.get(input.key);
    if (previous !== undefined && now - previous < this.dedupeWindowMs) return false;
    this.lastSent.set(input.key, now);

    await this.sink.publish({
      key: input.key,
      severity: input.severity,
      title: input.title,
      description: input.description,
      ventureId: input.ventureId,
      organizationId: input.organizationId,
      context: input.context ?? {},
      runbook: input.runbook,
      raisedAt: this.now(),
    });
    return true;
  }
}
