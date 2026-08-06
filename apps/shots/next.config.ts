import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@holdco/core", "@holdco/config", "@holdco/observability", "@holdco/security",
    "@holdco/database", "@holdco/audit", "@holdco/auth", "@holdco/ventures",
    "@holdco/crm", "@holdco/compliance", "@holdco/cost-accounting", "@holdco/approvals",
    "@holdco/prompts", "@holdco/knowledge", "@holdco/agents", "@holdco/workflows",
    "@holdco/communications", "@holdco/billing", "@holdco/experiments",
    "@holdco/analytics", "@holdco/platform", "@holdco/shots",
  ],
  eslint: { ignoreDuringBuilds: true },
};

export default config;
