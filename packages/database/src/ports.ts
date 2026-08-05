import type { Page, PageRequest } from "@holdco/core";
import type { EntityMap, EntityName } from "./types.ts";

/**
 * A deliberately narrow persistence port.
 *
 * The filter grammar below is the intersection of what the in-memory store and
 * a relational store can both express faithfully. Anything richer (joins,
 * aggregates, full-text) belongs in a driver-specific query object rather than
 * being smuggled in as a predicate function — a predicate would work in memory
 * and silently table-scan or fail against Postgres.
 */
export type ComparableFilter<V> = {
  equals?: V;
  not?: V;
  in?: readonly V[];
  notIn?: readonly V[];
  gt?: V;
  gte?: V;
  lt?: V;
  lte?: V;
  contains?: string;
  /** Matches when the stored array field contains this value. */
  has?: unknown;
};

export type Where<T> = {
  [K in keyof T]?: T[K] | ComparableFilter<T[K]> | null;
};

export interface QueryOptions<T> {
  where?: Where<T>;
  orderBy?: { field: keyof T & string; direction: "asc" | "desc" };
  page?: PageRequest;
}

export type CreateInput<T> = Omit<T, "createdAt" | "updatedAt"> & {
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateInput<T> = Partial<Omit<T, "id" | "organizationId" | "createdAt">>;

export interface Collection<T extends { id: string }> {
  create(input: CreateInput<T>): Promise<T>;
  createMany(inputs: readonly CreateInput<T>[]): Promise<readonly T[]>;
  get(id: string): Promise<T | null>;
  /** Throws `not_found` instead of returning null. */
  require(id: string): Promise<T>;
  findFirst(options?: QueryOptions<T>): Promise<T | null>;
  list(options?: QueryOptions<T>): Promise<Page<T>>;
  all(options?: Omit<QueryOptions<T>, "page">): Promise<readonly T[]>;
  count(where?: Where<T>): Promise<number>;
  update(id: string, patch: UpdateInput<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

export type Collections = {
  [K in EntityName]: Collection<EntityMap[K]>;
};

export interface Store extends Collections {
  readonly driver: "memory" | "prisma";
  /**
   * Runs `fn` atomically where the driver supports it. The memory driver
   * snapshots and rolls back on throw; Prisma uses a real transaction.
   */
  transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T>;
  disconnect(): Promise<void>;
  /** Development/test only — wipes everything the driver owns. */
  reset(): Promise<void>;
}
