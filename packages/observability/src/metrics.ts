export type MetricLabels = Readonly<Record<string, string>>;

interface Sample {
  readonly name: string;
  readonly labels: MetricLabels;
  value: number;
  readonly kind: "counter" | "gauge" | "histogram";
  readonly observations?: number[];
}

function labelKey(name: string, labels: MetricLabels): string {
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  return `${name}{${entries.map(([k, v]) => `${k}=${v}`).join(",")}}`;
}

/**
 * A deliberately small metrics registry. It exists so that queue depth, agent
 * latency, delivery failures and cost-per-run are recorded the same way
 * everywhere; exporting to a real backend is an adapter concern.
 */
export class MetricsRegistry {
  private readonly samples = new Map<string, Sample>();

  increment(name: string, labels: MetricLabels = {}, by = 1): void {
    const key = labelKey(name, labels);
    const existing = this.samples.get(key);
    if (existing) existing.value += by;
    else this.samples.set(key, { name, labels, value: by, kind: "counter" });
  }

  gauge(name: string, value: number, labels: MetricLabels = {}): void {
    this.samples.set(labelKey(name, labels), { name, labels, value, kind: "gauge" });
  }

  observe(name: string, value: number, labels: MetricLabels = {}): void {
    const key = labelKey(name, labels);
    const existing = this.samples.get(key);
    if (existing?.observations) {
      existing.observations.push(value);
      existing.value = existing.observations.length;
    } else {
      this.samples.set(key, {
        name, labels, value: 1, kind: "histogram", observations: [value],
      });
    }
  }

  async time<T>(name: string, labels: MetricLabels, fn: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      return await fn();
    } finally {
      this.observe(name, performance.now() - started, labels);
    }
  }

  snapshot(): ReadonlyArray<{
    name: string;
    labels: MetricLabels;
    kind: Sample["kind"];
    value: number;
    p50?: number;
    p95?: number;
  }> {
    return [...this.samples.values()].map((s) => {
      if (!s.observations || s.observations.length === 0) {
        return { name: s.name, labels: s.labels, kind: s.kind, value: s.value };
      }
      const sorted = [...s.observations].sort((a, b) => a - b);
      const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
      return {
        name: s.name, labels: s.labels, kind: s.kind, value: s.value,
        p50: at(0.5), p95: at(0.95),
      };
    });
  }

  reset(): void {
    this.samples.clear();
  }
}

export const METRICS = {
  workflowRuns: "workflow_runs_total",
  workflowFailures: "workflow_failures_total",
  workflowLatency: "workflow_latency_ms",
  agentRuns: "agent_runs_total",
  agentFailures: "agent_failures_total",
  agentLatency: "agent_latency_ms",
  agentTokens: "agent_tokens_total",
  agentCostMinor: "agent_cost_minor_total",
  approvalsPending: "approvals_pending",
  queueDepth: "queue_depth",
  emailsSent: "emails_sent_total",
  emailsSuppressed: "emails_suppressed_total",
  smsSent: "sms_sent_total",
  paymentFailures: "payment_failures_total",
  webhookFailures: "webhook_failures_total",
} as const;
