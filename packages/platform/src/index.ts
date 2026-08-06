import { money, systemClock, type Clock } from "@holdco/core";
import { FlagRegistry, loadEnv, type Env } from "@holdco/config";
import { createStore, type Store } from "@holdco/database";
import { AuditLog } from "@holdco/audit";
import { AuthService } from "@holdco/auth";
import { VentureRegistry, VentureModuleRegistry } from "@holdco/ventures";
import { CrmService } from "@holdco/crm";
import { ComplianceService } from "@holdco/compliance";
import { CostLedger } from "@holdco/cost-accounting";
import { ApprovalService } from "@holdco/approvals";
import { createPlatformPromptRegistry, PromptRegistry } from "@holdco/prompts";
import { KnowledgeBase } from "@holdco/knowledge";
import {
  AgentRunner,
  ToolRegistry,
  createModelProvider,
  createPlatformAgentRegistry,
  type AgentRegistry,
  type ModelProvider,
} from "@holdco/agents";
import {
  ActionRegistry,
  WorkflowEngine,
  WorkflowRegistry,
} from "@holdco/workflows";
import {
  CommunicationsService,
  createEmailProvider,
  createSmsProvider,
  type EmailProvider,
  type SmsProvider,
} from "@holdco/communications";
import { BillingService, createPaymentProvider, type PaymentProvider } from "@holdco/billing";
import { ExperimentService } from "@holdco/experiments";
import { AnalyticsService } from "@holdco/analytics";
import {
  Alerter,
  MemoryAlertSink,
  MetricsRegistry,
  createLogger,
  type AlertSink,
  type Logger,
} from "@holdco/observability";
import { registerPlatformActions } from "./actions.ts";
import { registerPlatformTools } from "./tools.ts";

export * from "./actions.ts";
export * from "./tools.ts";

/**
 * The composition root.
 *
 * Every service is constructed here, once, with its dependencies injected.
 * Nothing below this layer reads `process.env`, constructs a database client,
 * or picks a provider — which is what makes the whole platform testable with
 * in-memory adapters and a fixed clock.
 */
export interface Platform {
  readonly env: Env;
  readonly clock: Clock;
  readonly store: Store;
  readonly flags: FlagRegistry;
  readonly logger: Logger;
  readonly metrics: MetricsRegistry;
  readonly alerts: Alerter;
  readonly audit: AuditLog;
  readonly auth: AuthService;
  readonly ventures: VentureRegistry;
  readonly ventureModules: VentureModuleRegistry;
  readonly crm: CrmService;
  readonly compliance: ComplianceService;
  readonly costs: CostLedger;
  readonly approvals: ApprovalService;
  readonly prompts: PromptRegistry;
  readonly knowledge: KnowledgeBase;
  readonly agents: AgentRegistry;
  readonly agentRunner: AgentRunner;
  readonly tools: ToolRegistry;
  readonly actions: ActionRegistry;
  readonly workflows: WorkflowRegistry;
  readonly engine: WorkflowEngine;
  readonly communications: CommunicationsService;
  readonly billing: BillingService;
  readonly experiments: ExperimentService;
  readonly analytics: AnalyticsService;
  readonly providers: {
    readonly model: ModelProvider;
    readonly email: EmailProvider;
    readonly sms: SmsProvider;
    readonly payments: PaymentProvider;
  };
  shutdown(): Promise<void>;
}

export interface CreatePlatformOptions {
  env?: Env;
  clock?: Clock;
  store?: Store;
  logger?: Logger;
  alertSink?: AlertSink;
  /** Overrides for tests. */
  providers?: Partial<Platform["providers"]>;
}

export async function createPlatform(options: CreatePlatformOptions = {}): Promise<Platform> {
  const env = options.env ?? loadEnv();
  const clock = options.clock ?? systemClock;

  const logger =
    options.logger ??
    createLogger({
      level: env.LOG_LEVEL,
      base: { service: "holdco", nodeEnv: env.NODE_ENV },
      now: () => clock.now(),
    });

  const store =
    options.store ??
    (await createStore({
      driver: env.STORE_DRIVER,
      databaseUrl: env.DATABASE_URL,
      now: () => clock.now(),
    }));

  const flags = new FlagRegistry();
  const metrics = new MetricsRegistry();
  const alerts = new Alerter(options.alertSink ?? new MemoryAlertSink(), () => clock.now());

  const audit = new AuditLog(store, clock);
  const auth = new AuthService(store, audit, clock);
  const ventures = new VentureRegistry(store, audit, clock);
  const ventureModules = new VentureModuleRegistry();
  const crm = new CrmService(store, audit, clock);
  const compliance = new ComplianceService(store, audit, clock);
  const costs = new CostLedger(store, clock);
  const approvals = new ApprovalService(
    store,
    audit,
    clock,
    money(Math.round(env.APPROVAL_THRESHOLD_USD * 100)),
  );
  const prompts = createPlatformPromptRegistry();
  const knowledge = new KnowledgeBase(store, clock);

  const modelProvider =
    options.providers?.model ??
    createModelProvider({
      provider: env.MODEL_PROVIDER,
      allowPaidProviders: env.ALLOW_PAID_PROVIDERS,
    });
  const emailProvider =
    options.providers?.email ??
    createEmailProvider({
      email: env.EMAIL_PROVIDER,
      sms: env.SMS_PROVIDER,
      allowPaidProviders: env.ALLOW_PAID_PROVIDERS,
      ...(env.SMTP_HOST
        ? {
            smtp: {
              host: env.SMTP_HOST,
              port: env.SMTP_PORT,
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
              secure: env.SMTP_SECURE,
            },
          }
        : {}),
    });
  const smsProvider =
    options.providers?.sms ??
    createSmsProvider({
      email: env.EMAIL_PROVIDER,
      sms: env.SMS_PROVIDER,
      allowPaidProviders: env.ALLOW_PAID_PROVIDERS,
    });
  const paymentProvider =
    options.providers?.payments ??
    createPaymentProvider({
      provider: env.PAYMENT_PROVIDER,
      allowPaidProviders: env.ALLOW_PAID_PROVIDERS,
    });

  const tools = new ToolRegistry();
  registerPlatformTools(tools, { store, knowledge });

  const agents = createPlatformAgentRegistry();
  const agentRunner = new AgentRunner({
    store, audit, costs, approvals, prompts, knowledge, tools,
    provider: modelProvider,
    flags, logger, metrics, clock,
    allowPaidProviders: env.ALLOW_PAID_PROVIDERS,
  });

  const communications = new CommunicationsService({
    store, audit, compliance, flags, logger, metrics,
    email: emailProvider,
    sms: smsProvider,
    clock,
    allowLiveCommunications: env.ALLOW_LIVE_COMMUNICATIONS,
  });

  const billing = new BillingService({ store, audit, flags, payments: paymentProvider, clock });
  const experiments = new ExperimentService(store, audit, clock);
  const analytics = new AnalyticsService(store, costs, billing, clock);

  const actions = new ActionRegistry();
  registerPlatformActions(actions, {
    store, communications, agents, agentRunner, approvals, logger,
  });

  const workflows = new WorkflowRegistry();
  const engine = new WorkflowEngine({
    store, audit, approvals, costs, actions, flags, logger, metrics, clock,
  });

  logger.info("platform initialised", {
    storeDriver: store.driver,
    modelProvider: modelProvider.name,
    emailProvider: emailProvider.name,
    paymentProvider: paymentProvider.name,
    paidProvidersAllowed: env.ALLOW_PAID_PROVIDERS,
    liveCommunicationsAllowed: env.ALLOW_LIVE_COMMUNICATIONS,
  });

  return {
    env, clock, store, flags, logger, metrics, alerts, audit, auth,
    ventures, ventureModules, crm, compliance, costs, approvals, prompts,
    knowledge, agents, agentRunner, tools, actions, workflows, engine,
    communications, billing, experiments, analytics,
    providers: {
      model: modelProvider,
      email: emailProvider,
      sms: smsProvider,
      payments: paymentProvider,
    },
    async shutdown() {
      await store.disconnect();
    },
  };
}

/**
 * Register a venture module's manifest, workflows and agents.
 *
 * Disabling a venture is exactly "do not call this" — nothing else in the
 * platform needs to change, which is the isolation guarantee from rule 15.
 */
export interface VentureModule {
  manifest: Parameters<VentureModuleRegistry["register"]>[0];
  workflows?: readonly Parameters<WorkflowRegistry["register"]>[0][];
  agents?: readonly Parameters<AgentRegistry["register"]>[0][];
  prompts?: readonly Parameters<PromptRegistry["register"]>[0][];
  flags?: readonly Parameters<FlagRegistry["define"]>[0][];
}

export function installVentureModule(platform: Platform, module: VentureModule): void {
  platform.ventureModules.register(module.manifest);
  for (const flag of module.flags ?? []) platform.flags.define(flag);
  for (const prompt of module.prompts ?? []) platform.prompts.register(prompt);
  for (const agent of module.agents ?? []) platform.agents.register(agent);
  for (const workflow of module.workflows ?? []) platform.workflows.register(workflow);
  platform.logger.info("venture module installed", {
    venture: module.manifest.key,
    status: module.manifest.status,
    workflows: module.workflows?.length ?? 0,
    agents: module.agents?.length ?? 0,
  });
}
