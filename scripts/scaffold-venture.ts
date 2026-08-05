/**
 * Scaffold a new venture module.
 *
 * Creates the package, a manifest that will not validate until real content is
 * supplied, and the nine required documents as prompts rather than filler.
 *
 * Usage: pnpm venture:scaffold <key> "<Venture Name>" "<Brand Name>"
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [, , key, name, brandName] = process.argv;

if (!key || !name || !brandName) {
  console.error('Usage: pnpm venture:scaffold <key> "<Venture Name>" "<Brand Name>"');
  process.exit(1);
}

if (!/^[a-z][a-z0-9-]{2,40}$/.test(key)) {
  console.error(`Invalid key "${key}". Use lowercase letters, digits and hyphens, starting with a letter.`);
  process.exit(1);
}

const root = join(process.cwd(), "ventures", key);
if (existsSync(join(root, "package.json"))) {
  console.error(`ventures/${key} already exists as a package.`);
  process.exit(1);
}

mkdirSync(join(root, "src"), { recursive: true });

const workspaceDeps = [
  "core", "ventures", "workflows", "agents", "crm", "prompts",
  "cost-accounting", "approvals", "communications", "database", "config",
];

writeFileSync(
  join(root, "package.json"),
  JSON.stringify(
    {
      name: `@venture/${key}`,
      version: "0.1.0",
      private: true,
      type: "module",
      main: "./src/index.ts",
      types: "./src/index.ts",
      exports: { ".": "./src/index.ts" },
      scripts: { typecheck: "tsc --noEmit" },
      dependencies: {
        ...Object.fromEntries(workspaceDeps.map((d) => [`@holdco/${d}`, "workspace:*"])),
        zod: "^4.4.3",
      },
    },
    null,
    2,
  ) + "\n",
);

writeFileSync(
  join(root, "tsconfig.json"),
  JSON.stringify(
    { extends: "../../tsconfig.base.json", compilerOptions: {}, include: ["src/**/*.ts"] },
    null,
    2,
  ) + "\n",
);

const flagKey = `feature.venture.${key.replace(/-/g, "_")}`;

writeFileSync(
  join(root, "src", "index.ts"),
  `import type { VentureManifest } from "@holdco/ventures";
import type { FlagDefinition } from "@holdco/config";

/**
 * ${name}
 *
 * TODO: this manifest will NOT validate until you replace the placeholders.
 * validateManifest() rejects a venture with no kill criteria, and rejects any
 * offer that states no non-claims. Both refusals are deliberate.
 */
export const FLAGS: readonly FlagDefinition[] = [
  {
    key: "${flagKey}",
    description: "${name} venture module.",
    defaultValue: false,
    status: "incomplete",
    owner: "venture_lead",
    ventures: ["${key}"],
  },
];

export const MANIFEST: VentureManifest = {
  key: "${key}",
  name: "${name}",
  brandName: "${brandName}",
  thesis: "TODO: why this business, for whom, and why now. At least 20 characters and worth reading.",
  phase: 9,
  maxAutonomyLevel: 2,
  featureFlagKey: "${flagKey}",
  status: "docs_only",
  offers: [
    // TODO: every offer needs a concrete deliverable, a price, an outcome you
    // can defend in writing, and nonClaims stating what it does NOT promise.
  ],
  workflowKeys: [],
  agentKeys: [],
  metrics: [
    // TODO: mark exactly one metric isNorthStar.
  ],
  killCriteria: [
    // TODO: at least one. Agree the thresholds before launch, not after.
  ],
  legalNotes: [],
};

export const MODULE = {
  manifest: MANIFEST,
  workflows: [],
  agents: [],
  prompts: [],
  flags: FLAGS,
} as const;
`,
);

const docs: Record<string, string> = {
  "README.md": `# ${name}\n\n**Brand:** ${brandName} · **Phase:** TBD · **Status:** scaffolded\n\nTODO: one paragraph on what this venture does and for whom.\n\n## Status\n\nScaffolded by \`pnpm venture:scaffold\`. The manifest does not yet validate.\n`,
  "BUSINESS_MODEL.md": `# Business model\n\n## Revenue\n\nTODO: how money is made, with actual prices.\n\n## Cost structure\n\nTODO: what it costs to deliver one unit, including human minutes and AI cost.\n\n## The economic bet\n\nTODO: state the assumption this venture is betting on, and how you would know\nit was wrong.\n\n## Where it feeds the portfolio\n\nTODO: which arrow of the flywheel this strengthens. A venture that strengthens\nnone is a separate company.\n`,
  "CUSTOMER.md": `# Customer\n\n## Who buys\n\nTODO: a named segment with a countable population and a way to reach them.\n\n## What they say\n\nTODO: quotes from at least three real conversations, with dates and roles.\n\n## Who does not buy\n\nTODO: be specific. Knowing who to decline is worth as much as knowing who to\npursue.\n\n## How they are reached\n\nTODO: the channel, and why it is that one.\n`,
  "OFFER.md": `# Offer\n\n## Offer 1 — TODO\n\n**Deliverable:** TODO — a scope a stranger could deliver against.\n\n**Outcome claimed:** TODO — measurable, and defensible in writing.\n\n**Explicitly not claimed:**\n- TODO\n\n## The claim boundary\n\nTODO: what this venture refuses to promise, and why refusing is commercially\nbetter than promising.\n`,
  "PRICING.md": `# Pricing\n\n| Offer | Price | Interval |\n| --- | --- | --- |\n| TODO | TODO | TODO |\n\n## Reasoning\n\nTODO: why this number. "Competitors charge it" is not reasoning.\n\n## Review triggers\n\nTODO: what would make you change the price.\n`,
  "WORKFLOWS.md": `# Workflows\n\nTODO: each workflow with its trigger, steps, autonomy level and kill switch.\n\nThe operational launch gate requires the delivery workflow to exist **in the\nengine**, not merely to be described here.\n`,
  "METRICS.md": `# Metrics\n\n## North star\n\nTODO: the single number that tells you this is working.\n\n## Tracked\n\n| Metric | Unit | Why |\n| --- | --- | --- |\n| TODO | TODO | TODO |\n\n## Where the numbers come from\n\nTODO: and be explicit about which are entered by a human rather than measured.\n`,
  "LEGAL.md": `# Legal\n\n**Not legal advice. Nothing here has been reviewed by an attorney.**\n\n## Constraints\n\nTODO: what this venture must not do, and which jurisdictions matter.\n\n## Before the first customer\n\n- [ ] TODO\n`,
  "LAUNCH_PLAN.md": `# Launch plan\n\n## Stage 1 — TODO\n\nTODO: the cheapest test that would tell you whether to continue.\n\n## Gates\n\nTODO: what must be true before each stage begins.\n`,
  "KILL_CRITERIA.md": `# Kill criteria\n\n| Criterion | Threshold | Measured by |\n| --- | --- | --- |\n| TODO | TODO | TODO |\n\n## Decision rules\n\nOne criterion triggered → review. Two or more, or the stop-loss →\nshutdown recommended.\n\nWork already invested is not an input.\n`,
};

for (const [filename, content] of Object.entries(docs)) {
  writeFileSync(join(root, filename), content);
}

console.log(`Scaffolded ventures/${key}`);
console.log("");
console.log("Next:");
console.log("  1. pnpm install");
console.log("  2. Fill in the manifest — it will not validate until you do");
console.log("  3. Replace every TODO in the nine documents with real evidence");
console.log("  4. Register it: installVentureModule(platform, MODULE)");
