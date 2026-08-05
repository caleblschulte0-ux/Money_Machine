import "server-only";
import { FixedClock, systemClock } from "@holdco/core";
import { createPlatform, type Platform } from "@holdco/platform";
import { seedDemoData } from "@holdco/demo-data";

/**
 * The Command Center's platform instance.
 *
 * On the memory driver — the zero-config default — the instance is seeded with
 * fictional demo data so a fresh clone shows a working dashboard. On the
 * Prisma driver nothing is seeded and the dashboard shows whatever is really
 * in the database, including nothing at all.
 */
declare global {
  // eslint-disable-next-line no-var
  var __holdcoPlatform: Promise<PlatformContext> | undefined;
}

export interface PlatformContext {
  platform: Platform;
  organizationId: string;
  periodKey: string;
  /** True when the data on screen is seeded fiction, not real operations. */
  demoMode: boolean;
}

async function boot(): Promise<PlatformContext> {
  // Demo data is opt-in, never the default.
  //
  // It used to seed automatically whenever the store was in-memory, which meant
  // a fresh clone opened on a dashboard confidently reporting revenue that does
  // not exist. A "Demo data" banner does not fix that: the rest of the screen
  // still reads as a real business performing well. An empty dashboard is the
  // honest default, because the honest answer today is "nothing is operating".
  const demoRequested = process.env["DEMO_DATA"] === "true";

  const platform = await createPlatform(
    process.env["STORE_DRIVER"] === "prisma"
      ? {}
      : { clock: demoRequested ? new FixedClock(new Date("2026-03-15T14:00:00.000Z")) : systemClock },
  );

  if (platform.store.driver === "memory" && demoRequested) {
    const seeded = await seedDemoData(platform);
    return {
      platform,
      organizationId: seeded.organizationId,
      periodKey: seeded.periodKey,
      demoMode: true,
    };
  }

  const holding = await platform.store.organizations.findFirst({ where: { kind: "holding" } });
  const now = systemClock.now();
  return {
    platform,
    organizationId: holding?.id ?? "",
    periodKey: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
    demoMode: false,
  };
}

export function getPlatform(): Promise<PlatformContext> {
  // Cached on globalThis so Next's dev-mode module reloading does not spawn a
  // new in-memory world (and a new set of seeded ids) on every request.
  globalThis.__holdcoPlatform ??= boot();
  return globalThis.__holdcoPlatform;
}

export function formatMinor(amountMinor: number | null | undefined): string | null {
  if (amountMinor === null || amountMinor === undefined) return null;
  const sign = amountMinor < 0 ? "-" : "";
  return `${sign}$${(Math.abs(amountMinor) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(ratio: number | null | undefined): string | null {
  if (ratio === null || ratio === undefined) return null;
  return `${(ratio * 100).toFixed(1)}%`;
}

export function formatRelative(ms: number | null): string {
  if (ms === null) return "—";
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
