import "server-only";
import { createPlatform, type Platform } from "@holdco/platform";
import { SHOTS, ShotCapture, ShotRegistry, ShotScoreboard, type Shot } from "@holdco/shots";

/**
 * One process serves every shot page. Adding idea number forty costs one entry
 * in shots.config.ts — no new app, no new deploy target, no new database.
 */
declare global {
  // eslint-disable-next-line no-var
  var __shotsContext: Promise<ShotsContext> | undefined;
}

export interface ShotsContext {
  platform: Platform;
  registry: ShotRegistry;
  capture: ShotCapture;
  scoreboard: ShotScoreboard;
  organizationId: string;
}

async function boot(): Promise<ShotsContext> {
  const platform = await createPlatform();

  const registry = new ShotRegistry();
  for (const shot of SHOTS) registry.register(shot);

  // Shots belong to the holding company itself until one graduates into a
  // venture of its own.
  let holding = await platform.store.organizations.findFirst({ where: { kind: "holding" } });
  holding ??= await platform.store.organizations.create({
    id: "org_shots",
    name: "Holding Company",
    slug: "holdco",
    kind: "holding",
    status: "active",
    metadata: {},
  });

  return {
    platform,
    registry,
    capture: new ShotCapture(platform.store, platform.crm, platform.clock),
    scoreboard: new ShotScoreboard(platform.store, platform.clock),
    organizationId: holding.id,
  };
}

export function getShots(): Promise<ShotsContext> {
  globalThis.__shotsContext ??= boot();
  return globalThis.__shotsContext;
}

export function formatPrice(shot: Shot): string {
  if (shot.priceMinor === 0) return shot.priceNote ?? "Free";
  const amount = (shot.priceMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return shot.priceNote ? `$${amount} ${shot.priceNote}` : `$${amount}`;
}
