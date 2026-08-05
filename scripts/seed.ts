/**
 * Seed the platform with fictional data.
 *
 * The data itself lives in `@holdco/demo-data` so that this CLI and the
 * Command Center's in-memory mode show exactly the same world.
 *
 * Usage: pnpm seed
 */
import { FixedClock } from "@holdco/core";
import { createPlatform } from "@holdco/platform";
import { seedDemoData } from "@holdco/demo-data";

async function main(): Promise<void> {
  const clock = new FixedClock(new Date("2026-03-15T14:00:00.000Z"));
  const platform = await createPlatform({ clock });

  console.log(`Seeding with the ${platform.store.driver} store driver.`);
  if (platform.store.driver === "memory") {
    console.log(
      "NOTE: the memory driver is in use, so this data disappears when the process exits.\n" +
        "      Set STORE_DRIVER=prisma with a running Postgres to persist it.",
    );
  }

  const result = await seedDemoData(platform);
  const summary = await platform.analytics.portfolio(result.organizationId, result.periodKey);

  console.log("\nSeed complete.");
  console.log(`  Organization: ${result.organizationId}`);
  console.log(`  Owner login:  owner@northbridge.invalid`);
  console.log(`  Ventures:     ${summary.ventures.map((v) => `${v.ventureKey} [${v.stage}]`).join(", ")}`);
  console.log(`  Leads:        ${await platform.store.leads.count({ organizationId: result.organizationId })}`);
  console.log(`  Tasks:        ${await platform.store.tasks.count({ organizationId: result.organizationId })}`);
  console.log(`  Approvals:    ${summary.pendingApprovals} pending`);
  console.log(`  Total spend:  $${(summary.totalSpend.amountMinor / 100).toFixed(2)} (${result.periodKey})`);
  console.log(`  Money moved:  $0.00 — every provider is a mock.`);

  await platform.shutdown();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
