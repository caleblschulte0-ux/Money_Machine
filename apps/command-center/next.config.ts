import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source with no build step, so Next
  // compiles them alongside the app.
  transpilePackages: [
    "@holdco/core",
    "@holdco/config",
    "@holdco/observability",
    "@holdco/security",
    "@holdco/database",
    "@holdco/audit",
    "@holdco/auth",
    "@holdco/ventures",
    "@holdco/crm",
    "@holdco/compliance",
    "@holdco/cost-accounting",
    "@holdco/approvals",
    "@holdco/prompts",
    "@holdco/knowledge",
    "@holdco/agents",
    "@holdco/workflows",
    "@holdco/communications",
    "@holdco/billing",
    "@holdco/experiments",
    "@holdco/analytics",
    "@holdco/design-system",
    "@holdco/platform",
    "@holdco/demo-data",
    "@venture/automation-agency",
    "@venture/ai-visibility",
    "@venture/lead-generation",
  ],
  eslint: { ignoreDuringBuilds: true },
};

export default config;
