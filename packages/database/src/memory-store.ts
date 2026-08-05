import { errors, paginate, type Page } from "@holdco/core";
import type {
  Collection,
  ComparableFilter,
  CreateInput,
  QueryOptions,
  Store,
  UpdateInput,
  Where,
} from "./ports.ts";
import { ENTITY_NAMES, type EntityName } from "./entities.ts";

const FILTER_KEYS = ["equals", "not", "in", "notIn", "gt", "gte", "lt", "lte", "contains", "has"];

function isFilterObject(value: unknown): value is ComparableFilter<unknown> {
  if (typeof value !== "object" || value === null || value instanceof Date || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => FILTER_KEYS.includes(k));
}

function compare(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return String(a).localeCompare(String(b));
}

function valueEquals(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => valueEquals(v, b[i]));
  }
  return a === b;
}

function matchesFilter(actual: unknown, filter: ComparableFilter<unknown>): boolean {
  if ("equals" in filter && !valueEquals(actual, filter.equals)) return false;
  if ("not" in filter && valueEquals(actual, filter.not)) return false;
  if (filter.in && !filter.in.some((v) => valueEquals(actual, v))) return false;
  if (filter.notIn && filter.notIn.some((v) => valueEquals(actual, v))) return false;
  if (filter.gt !== undefined && compare(actual, filter.gt) <= 0) return false;
  if (filter.gte !== undefined && compare(actual, filter.gte) < 0) return false;
  if (filter.lt !== undefined && compare(actual, filter.lt) >= 0) return false;
  if (filter.lte !== undefined && compare(actual, filter.lte) > 0) return false;
  if (filter.contains !== undefined) {
    if (typeof actual !== "string") return false;
    if (!actual.toLowerCase().includes(String(filter.contains).toLowerCase())) return false;
  }
  if (filter.has !== undefined) {
    if (!Array.isArray(actual)) return false;
    if (!actual.some((v) => valueEquals(v, filter.has))) return false;
  }
  return true;
}

function matches<T>(record: T, where: Where<T> | undefined): boolean {
  if (!where) return true;
  for (const [key, expected] of Object.entries(where)) {
    if (expected === undefined) continue;
    const actual = (record as Record<string, unknown>)[key];
    if (isFilterObject(expected)) {
      if (!matchesFilter(actual, expected)) return false;
    } else if (!valueEquals(actual, expected)) {
      return false;
    }
  }
  return true;
}

/** Deep clone so callers can never mutate stored state by accident. */
function clone<T>(value: T): T {
  return structuredClone(value);
}

class MemoryCollection<T extends { id: string }> implements Collection<T> {
  constructor(
    private readonly name: string,
    private readonly rows: Map<string, T>,
    private readonly now: () => Date,
  ) {}

  async create(input: CreateInput<T>): Promise<T> {
    if (this.rows.has(input.id)) {
      throw errors.conflict(`${this.name} with id ${input.id} already exists`, { id: input.id });
    }
    const timestamp = this.now();
    const record = {
      ...clone(input),
      createdAt: input.createdAt ?? timestamp,
      updatedAt: input.updatedAt ?? timestamp,
    } as unknown as T;
    this.rows.set(record.id, record);
    return clone(record);
  }

  async createMany(inputs: readonly CreateInput<T>[]): Promise<readonly T[]> {
    const out: T[] = [];
    for (const input of inputs) out.push(await this.create(input));
    return out;
  }

  async get(id: string): Promise<T | null> {
    const found = this.rows.get(id);
    return found ? clone(found) : null;
  }

  async require(id: string): Promise<T> {
    const found = await this.get(id);
    if (!found) throw errors.notFound(this.name, id);
    return found;
  }

  private select(options: QueryOptions<T> = {}): T[] {
    const filtered = [...this.rows.values()].filter((r) => matches(r, options.where));
    const order = options.orderBy;
    if (order) {
      filtered.sort((a, b) => {
        const result = compare(
          (a as Record<string, unknown>)[order.field],
          (b as Record<string, unknown>)[order.field],
        );
        return order.direction === "desc" ? -result : result;
      });
    } else {
      filtered.sort((a, b) => a.id.localeCompare(b.id));
    }
    return filtered.map(clone);
  }

  async findFirst(options: QueryOptions<T> = {}): Promise<T | null> {
    return this.select(options)[0] ?? null;
  }

  async list(options: QueryOptions<T> = {}): Promise<Page<T>> {
    return paginate(this.select(options), options.page ?? {});
  }

  async all(options: Omit<QueryOptions<T>, "page"> = {}): Promise<readonly T[]> {
    return this.select(options);
  }

  async count(where?: Where<T>): Promise<number> {
    return this.select({ where }).length;
  }

  async update(id: string, patch: UpdateInput<T>): Promise<T> {
    const existing = this.rows.get(id);
    if (!existing) throw errors.notFound(this.name, id);
    const updated = { ...existing, ...clone(patch), updatedAt: this.now() } as T;
    this.rows.set(id, updated);
    return clone(updated);
  }

  async delete(id: string): Promise<void> {
    if (!this.rows.delete(id)) throw errors.notFound(this.name, id);
  }
}

/**
 * The default store. Zero configuration, deterministic, and fast enough that
 * every test can own one. It is not a production driver — `@holdco/config`
 * rejects `STORE_DRIVER=memory` when NODE_ENV=production.
 */
export function createMemoryStore(now: () => Date = () => new Date()): Store {
  const tables = new Map<EntityName, Map<string, { id: string }>>();
  for (const name of ENTITY_NAMES) tables.set(name, new Map());

  const store: Record<string, unknown> = {
    driver: "memory" as const,

    async transaction<R>(fn: (tx: Store) => Promise<R>): Promise<R> {
      const snapshot = new Map(
        [...tables.entries()].map(([name, rows]) => [
          name,
          new Map([...rows.entries()].map(([k, v]) => [k, structuredClone(v)])),
        ]),
      );
      try {
        return await fn(store as unknown as Store);
      } catch (error) {
        // Restore in place so existing collection references stay valid.
        for (const [name, rows] of tables) {
          rows.clear();
          for (const [k, v] of snapshot.get(name) ?? []) rows.set(k, v);
        }
        throw error;
      }
    },

    async disconnect(): Promise<void> {
      /* nothing to release */
    },

    async reset(): Promise<void> {
      for (const rows of tables.values()) rows.clear();
    },
  };

  for (const name of ENTITY_NAMES) {
    store[name] = new MemoryCollection(name, tables.get(name)! as Map<string, { id: string }>, now);
  }

  return store as unknown as Store;
}
