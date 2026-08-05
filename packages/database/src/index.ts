import type { Env } from "@holdco/config";
import { createMemoryStore } from "./memory-store.ts";
import { createPrismaStore } from "./prisma-store.ts";
import type { Store } from "./ports.ts";

export * from "./types.ts";
export * from "./ports.ts";
export * from "./entities.ts";
export { createMemoryStore } from "./memory-store.ts";
export { createPrismaStore } from "./prisma-store.ts";

export interface CreateStoreOptions {
  driver?: Env["STORE_DRIVER"];
  databaseUrl?: string | undefined;
  now?: () => Date;
}

/**
 * Pick a store from configuration. Defaults to memory so that a fresh clone
 * runs with no database and no credentials.
 */
export async function createStore(options: CreateStoreOptions = {}): Promise<Store> {
  const driver = options.driver ?? "memory";
  if (driver === "prisma") return createPrismaStore(options.databaseUrl);
  return createMemoryStore(options.now);
}
