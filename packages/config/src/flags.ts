/**
 * Feature flags and kill switches.
 *
 * Two distinct uses, one mechanism:
 *  - `feature.*` gates incomplete or unproven functionality (playbook rule 17).
 *  - `killswitch.*` stops something that is already running (rule 29). Kill
 *    switches are inverted: `true` means STOPPED.
 */
export type FlagStatus = "incomplete" | "experimental" | "stable" | "deprecated";

export interface FlagDefinition {
  readonly key: string;
  readonly description: string;
  readonly defaultValue: boolean;
  readonly status: FlagStatus;
  /** Who decides when this flips. */
  readonly owner: string;
  /** Ventures the flag is relevant to; empty means holding-company wide. */
  readonly ventures?: readonly string[];
}

export interface FlagOverride {
  readonly key: string;
  readonly value: boolean;
  readonly organizationId?: string;
  readonly ventureId?: string;
  readonly reason: string;
  readonly setBy: string;
  readonly setAt: Date;
}

export interface FlagContext {
  readonly organizationId?: string;
  readonly ventureId?: string;
}

/**
 * Flags that ship with the platform. Anything a venture module adds registers
 * itself at startup through `FlagRegistry.define`.
 */
export const PLATFORM_FLAGS: readonly FlagDefinition[] = [
  {
    key: "feature.workflow_engine",
    description: "Trigger/condition/action workflow engine.",
    defaultValue: true,
    status: "stable",
    owner: "platform",
  },
  {
    key: "feature.agent_runner",
    description: "AI agent execution. Uses the mock model provider unless a paid provider is approved.",
    defaultValue: true,
    status: "stable",
    owner: "platform",
  },
  {
    key: "feature.outbound_email",
    description: "Allow workflows to enqueue outbound email. Delivery still depends on the configured provider.",
    defaultValue: true,
    status: "stable",
    owner: "platform",
  },
  {
    key: "feature.outbound_sms",
    description: "Allow workflows to enqueue outbound SMS.",
    defaultValue: false,
    status: "incomplete",
    owner: "platform",
  },
  {
    key: "feature.outbound_calling",
    description: "AI call centre outbound dialling. Not built; kept off.",
    defaultValue: false,
    status: "incomplete",
    owner: "platform",
  },
  {
    key: "feature.billing_charges",
    description: "Create real charges through the payment provider. Off until a human enables live billing.",
    defaultValue: false,
    status: "incomplete",
    owner: "finance",
  },
  {
    key: "feature.command_center_capital_allocation",
    description: "Capital allocation recommendations in the command center (advisory only).",
    defaultValue: true,
    status: "experimental",
    owner: "owner",
  },
  {
    key: "killswitch.all_automation",
    description: "Global stop. When true, no workflow and no agent will execute.",
    defaultValue: false,
    status: "stable",
    owner: "owner",
  },
  {
    key: "killswitch.outbound_communications",
    description: "Stop all outbound email/SMS/calls without touching workflow definitions.",
    defaultValue: false,
    status: "stable",
    owner: "owner",
  },
  {
    key: "killswitch.agent_spend",
    description: "Stop all model inference, e.g. when a cost anomaly is detected.",
    defaultValue: false,
    status: "stable",
    owner: "finance",
  },
];

export class FlagRegistry {
  private readonly definitions = new Map<string, FlagDefinition>();
  private readonly overrides: FlagOverride[] = [];

  constructor(definitions: readonly FlagDefinition[] = PLATFORM_FLAGS) {
    for (const def of definitions) this.define(def);
  }

  define(definition: FlagDefinition): void {
    const existing = this.definitions.get(definition.key);
    if (existing && existing.owner !== definition.owner) {
      throw new Error(
        `Flag "${definition.key}" is already defined by ${existing.owner}; refusing silent redefinition.`,
      );
    }
    this.definitions.set(definition.key, definition);
  }

  list(): readonly FlagDefinition[] {
    return [...this.definitions.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  get(key: string): FlagDefinition | undefined {
    return this.definitions.get(key);
  }

  setOverride(override: FlagOverride): void {
    if (!this.definitions.has(override.key)) {
      throw new Error(`Cannot override unknown flag "${override.key}".`);
    }
    if (!override.reason.trim()) {
      throw new Error(`Flag overrides require a reason (key=${override.key}).`);
    }
    this.overrides.push(override);
  }

  listOverrides(): readonly FlagOverride[] {
    return [...this.overrides];
  }

  /**
   * Most specific override wins: venture+org, then venture, then org, then the
   * definition default.
   */
  isEnabled(key: string, context: FlagContext = {}): boolean {
    const definition = this.definitions.get(key);
    if (!definition) {
      // Unknown flags are off. A typo must never silently enable something.
      return false;
    }
    const scored = this.overrides
      .filter((o) => o.key === key)
      .filter((o) => !o.organizationId || o.organizationId === context.organizationId)
      .filter((o) => !o.ventureId || o.ventureId === context.ventureId)
      .map((o) => ({ o, score: (o.ventureId ? 2 : 0) + (o.organizationId ? 1 : 0) }))
      .sort((a, b) => b.score - a.score || b.o.setAt.getTime() - a.o.setAt.getTime());

    return scored[0]?.o.value ?? definition.defaultValue;
  }

  /** `true` means the switch is PULLED and the thing must not run. */
  isStopped(killSwitchKey: string, context: FlagContext = {}): boolean {
    return this.isEnabled(killSwitchKey, context);
  }

  /** Convenience: any global stop that would block automation right now. */
  automationStopped(context: FlagContext = {}): boolean {
    return this.isStopped("killswitch.all_automation", context);
  }
}
