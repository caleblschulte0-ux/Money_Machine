import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./memory-store.ts";

const org = "org_test";

function seedVentureInput(key: string, stage: string) {
  return {
    id: `vnt_${key}`,
    organizationId: org,
    key,
    name: key,
    brandName: key,
    stage: stage as never,
    thesis: "test",
    ownerUserId: null,
    domains: [],
    maxAutonomyLevel: 2,
    monthlyBudgetMinor: 0,
    stopLossMinor: 0,
    launchedAt: null,
    closedAt: null,
    stageReason: null,
    metadata: {},
  };
}

describe("memory store", () => {
  it("round-trips records and rejects duplicate ids", async () => {
    const store = createMemoryStore();
    await store.ventures.create(seedVentureInput("alpha", "idea"));
    const found = await store.ventures.get("vnt_alpha");
    expect(found?.key).toBe("alpha");
    await expect(store.ventures.create(seedVentureInput("alpha", "idea"))).rejects.toThrow(/already exists/);
  });

  it("returns clones so callers cannot mutate stored state", async () => {
    const store = createMemoryStore();
    await store.ventures.create(seedVentureInput("alpha", "idea"));
    const first = await store.ventures.require("vnt_alpha");
    first.domains.push("hacked.invalid");
    const second = await store.ventures.require("vnt_alpha");
    expect(second.domains).toEqual([]);
  });

  it("supports the filter grammar", async () => {
    const store = createMemoryStore();
    await store.ventures.create(seedVentureInput("alpha", "idea"));
    await store.ventures.create(seedVentureInput("beta", "launched"));
    await store.ventures.create(seedVentureInput("gamma", "paused"));

    expect((await store.ventures.all({ where: { stage: "launched" } })).length).toBe(1);
    expect(
      (await store.ventures.all({ where: { stage: { in: ["idea", "paused"] } } })).length,
    ).toBe(2);
    expect((await store.ventures.all({ where: { stage: { not: "idea" } } })).length).toBe(2);
    expect((await store.ventures.all({ where: { key: { contains: "ET" } } })).length).toBe(1);
    expect(await store.ventures.count({ organizationId: org })).toBe(3);
  });

  it("filters by date range", async () => {
    const store = createMemoryStore();
    const early = new Date("2026-01-01T00:00:00Z");
    const late = new Date("2026-06-01T00:00:00Z");
    await store.ventures.create({ ...seedVentureInput("alpha", "idea"), createdAt: early, updatedAt: early });
    await store.ventures.create({ ...seedVentureInput("beta", "idea"), createdAt: late, updatedAt: late });

    const recent = await store.ventures.all({
      where: { createdAt: { gte: new Date("2026-03-01T00:00:00Z") } },
    });
    expect(recent.map((v) => v.key)).toEqual(["beta"]);
  });

  it("orders and paginates", async () => {
    const store = createMemoryStore();
    for (const key of ["delta", "alpha", "charlie", "bravo"]) {
      await store.ventures.create(seedVentureInput(key, "idea"));
    }
    const page = await store.ventures.list({
      orderBy: { field: "key", direction: "asc" },
      page: { limit: 2 },
    });
    expect(page.items.map((v) => v.key)).toEqual(["alpha", "bravo"]);
    expect(page.nextCursor).toBe("vnt_bravo");

    const next = await store.ventures.list({
      orderBy: { field: "key", direction: "asc" },
      page: { limit: 2, cursor: page.nextCursor! },
    });
    expect(next.items.map((v) => v.key)).toEqual(["charlie", "delta"]);
    expect(next.nextCursor).toBeNull();
  });

  it("rolls back a failed transaction", async () => {
    const store = createMemoryStore();
    await store.ventures.create(seedVentureInput("alpha", "idea"));

    await expect(
      store.transaction(async (tx) => {
        await tx.ventures.create(seedVentureInput("beta", "idea"));
        await tx.ventures.update("vnt_alpha", { stage: "launched" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await store.ventures.get("vnt_beta")).toBeNull();
    expect((await store.ventures.require("vnt_alpha")).stage).toBe("idea");
  });

  it("commits a successful transaction", async () => {
    const store = createMemoryStore();
    await store.transaction(async (tx) => {
      await tx.ventures.create(seedVentureInput("alpha", "idea"));
    });
    expect(await store.ventures.get("vnt_alpha")).not.toBeNull();
  });
});
