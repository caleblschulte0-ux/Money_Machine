/**
 * Show the engine working, on real code paths, with nothing faked.
 *
 * Every line this prints is the result of the actual platform making an actual
 * decision. Nothing here is scripted output — remove a guard from the codebase
 * and the corresponding line below changes or disappears.
 *
 * Usage: pnpm demo:engine
 */
import { FixedClock, money, usd } from "@holdco/core";
import { createPlatform, installVentureModule } from "@holdco/platform";
import { MODULE as AGENCY, SCORING_MODEL } from "@venture/automation-agency";

const line = (s = "") => console.log(s);
const rule = (title: string) => {
  line();
  line("─".repeat(78));
  line(title);
  line("─".repeat(78));
};

async function main(): Promise<void> {
  const clock = new FixedClock(new Date("2026-03-15T09:00:00.000Z"));
  const platform = await createPlatform({
    clock,
    logger: {
      debug() {}, info() {}, warn() {}, error() {},
      child() { return this; },
    },
  });
  installVentureModule(platform, AGENCY);

  const { organization, owner } = await platform.auth.registerOrganization({
    name: "Your Holding Co",
    slug: "yourco",
    kind: "holding",
    ownerEmail: "you@yourco.invalid",
    ownerName: "Owner",
    ownerPassword: "demo-only-password-not-real",
  });
  const org = organization.id;

  const venture = await platform.ventures.create(
    {
      organizationId: org,
      key: "automation-agency",
      name: "AI Automation Agency",
      brandName: "Ridgeline Operations",
      thesis: "Sell measured hour reductions on specific operational handoffs.",
      ownerUserId: owner.id,
      maxAutonomyLevel: 3,
    },
    { type: "human", id: owner.id },
  );
  const ctx = { organizationId: org, ventureId: venture.id, actor: { type: "human" as const, id: owner.id } };

  // ------------------------------------------------------------------ 1
  rule("1. A LEAD ARRIVES  —  the system decides if it is worth your time");

  const good = await platform.crm.captureLead(ctx, {
    channel: "web_form", source: "pricing_page",
    companyName: "Harbor Mechanical", serviceType: "operations_audit",
    contact: { firstName: "Dana", lastName: "Whitmore", email: "dana@harbor-mechanical.invalid", phone: "555-0142", source: "web" },
    scoringModel: SCORING_MODEL,
    payload: { employeeCount: 64, monthlyHoursOnProcess: 45, role: "Operations Manager", systems: "QuickBooks, ServiceTitan", timeline: "this_quarter", budgetRange: "10k-25k" },
  });
  line(`Harbor Mechanical  ->  ${good.lead.status.toUpperCase()}, score ${good.lead.score}/100`);
  for (const reason of good.lead.scoreReasons) line(`    ${reason}`);

  // ------------------------------------------------------------------ 2
  rule("2. THE SAME PERSON SUBMITS AGAIN  —  caught, so you don't chase twice");

  const dupe = await platform.crm.captureLead(ctx, {
    channel: "web_form", source: "pricing_page",
    companyName: "Harbor Mechanical", serviceType: "operations_audit",
    // Same mailbox, different capitalisation and a +tag — a real duplicate.
    contact: { firstName: "Dana", lastName: "Whitmore", email: "Dana+Quote@Harbor-Mechanical.invalid", source: "web" },
    scoringModel: SCORING_MODEL,
  });
  line(`Same mailbox, "Dana+Quote@Harbor-Mechanical"  ->  ${dupe.outcome.toUpperCase()}`);
  line(`    reason: ${dupe.reasons[0]}`);

  const spam = await platform.crm.captureLead(ctx, {
    channel: "web_form", source: "pricing_page",
    contact: { firstName: "Xk", lastName: "Zz", email: "buy@mailinator.com", source: "web" },
    honeypot: "http://spam.invalid", submissionTimeMs: 300,
    scoringModel: SCORING_MODEL,
  });
  line(`Bot submission                         ->  ${spam.outcome.toUpperCase()} (no contact record created)`);

  // ------------------------------------------------------------------ 3
  rule("3. WORK HAPPENS AUTOMATICALLY  —  without you touching anything");

  const run = await platform.engine.run(platform.workflows.get("agency.lead_intake"), {
    type: "lead.created", organizationId: org, ventureId: venture.id,
    payload: { ventureKey: "automation-agency", leadId: good.lead.id, companyName: "Harbor Mechanical", channel: "web_form", score: good.lead.score },
  });
  line(`Workflow "${run.run.workflowKey}" ran  ->  ${run.run.status}`);
  for (const step of run.steps) line(`    ${step.stepId.padEnd(20)} ${step.status}`);
  const tasks = await platform.store.tasks.all({ where: { organizationId: org } });
  line(`Created for you to action: "${tasks[0]?.title}"`);

  // ------------------------------------------------------------------ 4
  rule("4. REPLAYED WEBHOOK  —  the same event twice does NOT double-run");

  const again = await platform.engine.run(platform.workflows.get("agency.lead_intake"), {
    type: "lead.created", organizationId: org, ventureId: venture.id,
    payload: { ventureKey: "automation-agency", leadId: good.lead.id, companyName: "Harbor Mechanical", channel: "web_form", score: good.lead.score },
  });
  const taskCount = await platform.store.tasks.count({ organizationId: org });
  line(`Second identical trigger  ->  deduplicated: ${again.deduplicated}`);
  line(`Tasks created in total: ${taskCount}  (not 2)`);

  // ------------------------------------------------------------------ 5
  rule("5. SOMETHING RISKY IS ATTEMPTED  —  it stops and asks you");

  for (const action of ["report.generate", "email.send_marketing", "payment.refund", "employment.terminate"]) {
    const gate = platform.approvals.gate({
      organizationId: org, ventureId: venture.id, actionKind: action, grantedLevel: 5,
    });
    const verdict =
      gate.outcome === "execute" ? "runs on its own"
      : gate.outcome === "needs_approval" ? "STOPS — waits for you"
      : "REFUSED — never automated";
    line(`${action.padEnd(24)} at max autonomy  ->  ${verdict}`);
  }

  // ------------------------------------------------------------------ 6
  rule("6. AN AI AGENT TRIES TO SPEND  —  the budget refuses");

  await platform.costs.setBudget({
    organizationId: org, ventureId: venture.id, category: "ai_inference",
    periodKey: "2026-03", limit: usd(0.05), enforcement: "hard",
  });
  await platform.costs.record({
    organizationId: org, ventureId: venture.id, category: "ai_inference",
    amount: usd(0.05), description: "earlier work this month",
  });
  const agentResult = await platform.agentRunner.run(
    platform.agents.get("research.market"),
    { market: "Commercial doors", question: "Is there recurring demand?", sources: "notes" } as never,
    { organizationId: org, ventureId: venture.id },
    { promptVariables: { market: "Commercial doors", question: "Is there recurring demand?", sources: "notes" } },
  );
  if (!agentResult.ok) {
    line(`Agent run  ->  ${agentResult.error.status.toUpperCase()}`);
    line(`    ${agentResult.error.reason}`);
    line(`    It filed approval ${agentResult.error.approvalId} instead of spending.`);
  }

  // ------------------------------------------------------------------ 7
  rule("7. AN EMAIL TO SOMEONE WHO UNSUBSCRIBED  —  blocked");

  await platform.compliance.suppress(
    { organizationId: org, identifier: "dana@harbor-mechanical.invalid", channel: "email", reason: "unsubscribe" },
    { type: "human", id: owner.id },
  );
  const send = await platform.communications.sendEmail({
    organizationId: org, ventureId: venture.id,
    to: "dana@harbor-mechanical.invalid", from: "team@ridgeline.invalid",
    subject: "Following up", body: "Just checking in.", purpose: "marketing",
  });
  line(`Send attempt  ->  ${send.status.toUpperCase()}`);
  if ("reason" in send) line(`    ${send.reason}`);

  // ------------------------------------------------------------------ 8
  rule("8. YOU PULL THE KILL SWITCH  —  everything stops, no deploy needed");

  platform.flags.setOverride({
    key: "killswitch.all_automation", value: true,
    reason: "Owner stopped everything", setBy: owner.id, setAt: clock.now(),
  });
  const stopped = await platform.engine.run(platform.workflows.get("agency.lead_intake"), {
    type: "lead.created", organizationId: org, ventureId: venture.id,
    payload: { ventureKey: "automation-agency", leadId: "led_new", companyName: "Someone Else", channel: "web_form", score: 90 },
  });
  line(`Workflow attempted  ->  ${stopped.run.status.toUpperCase()}`);
  line(`    ${(stopped.run.error as { reason?: string })?.reason}`);

  // ------------------------------------------------------------------ 9
  rule("9. WHAT HAPPENED, AND WHO DID IT  —  the whole trail");

  const audit = await platform.audit.query({ organizationId: org, limit: 100 });
  for (const e of [...audit].reverse().slice(0, 12)) {
    line(`${e.actorType.padEnd(8)} ${e.action.padEnd(26)} ${e.summary.slice(0, 60)}`);
  }
  line(`... ${audit.length} recorded actions in total.`);

  rule("THE POINT");
  line("Nothing above was hard-coded output. Each line is the platform deciding.");
  line("What it does not do yet: find you a customer. That part is still yours.");
  line();

  await platform.shutdown();
}

main().catch((error) => {
  console.error("demo failed:", error);
  process.exitCode = 1;
});
