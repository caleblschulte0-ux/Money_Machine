import { errors, normalizeLimit, type Page } from "@holdco/core";
import type {
  Collection,
  CreateInput,
  QueryOptions,
  Store,
  UpdateInput,
  Where,
} from "./ports.ts";
import { ENTITY_NAMES, ENTITY_TO_PRISMA_MODEL, type EntityName } from "./entities.ts";

/**
 * Prisma-backed store.
 *
 * The filter grammar in `ports.ts` was chosen to be a subset of Prisma's own
 * `where` syntax, so this adapter forwards filters unchanged rather than
 * translating them. Cursor pagination uses Prisma's `cursor`/`skip`.
 *
 * The client is imported dynamically: the generated client does not exist
 * until `pnpm db:generate` has been run, and the memory driver must keep
 * working on a machine that has never run Prisma.
 */
interface PrismaDelegate {
  create(args: { data: unknown }): Promise<unknown>;
  findUnique(args: { where: { id: string } }): Promise<unknown>;
  findFirst(args: Record<string, unknown>): Promise<unknown>;
  findMany(args: Record<string, unknown>): Promise<unknown[]>;
  count(args: Record<string, unknown>): Promise<number>;
  update(args: { where: { id: string }; data: unknown }): Promise<unknown>;
  delete(args: { where: { id: string } }): Promise<unknown>;
  deleteMany(args: Record<string, unknown>): Promise<unknown>;
}

type PrismaLike = Record<string, PrismaDelegate> & {
  $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
  $disconnect(): Promise<void>;
};

class PrismaCollection<T extends { id: string }> implements Collection<T> {
  constructor(
    private readonly entity: EntityName,
    private readonly delegate: PrismaDelegate,
  ) {}

  async create(input: CreateInput<T>): Promise<T> {
    return (await this.delegate.create({ data: input })) as T;
  }

  async createMany(inputs: readonly CreateInput<T>[]): Promise<readonly T[]> {
    // Sequential rather than createMany() so each row comes back hydrated and
    // a partial failure surfaces the offending row.
    const out: T[] = [];
    for (const input of inputs) out.push(await this.create(input));
    return out;
  }

  async get(id: string): Promise<T | null> {
    return ((await this.delegate.findUnique({ where: { id } })) as T | null) ?? null;
  }

  async require(id: string): Promise<T> {
    const found = await this.get(id);
    if (!found) throw errors.notFound(this.entity, id);
    return found;
  }

  async findFirst(options: QueryOptions<T> = {}): Promise<T | null> {
    return ((await this.delegate.findFirst(this.args(options))) as T | null) ?? null;
  }

  async list(options: QueryOptions<T> = {}): Promise<Page<T>> {
    const limit = normalizeLimit(options.page?.limit);
    const rows = (await this.delegate.findMany({
      ...this.args(options),
      take: limit + 1,
      ...(options.page?.cursor
        ? { cursor: { id: options.page.cursor }, skip: 1 }
        : {}),
    })) as T[];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async all(options: Omit<QueryOptions<T>, "page"> = {}): Promise<readonly T[]> {
    return (await this.delegate.findMany(this.args(options))) as T[];
  }

  async count(where?: Where<T>): Promise<number> {
    return this.delegate.count({ where: where ?? {} });
  }

  async update(id: string, patch: UpdateInput<T>): Promise<T> {
    return (await this.delegate.update({ where: { id }, data: patch })) as T;
  }

  async delete(id: string): Promise<void> {
    await this.delegate.delete({ where: { id } });
  }

  private args(options: QueryOptions<T>): Record<string, unknown> {
    const args: Record<string, unknown> = {};
    if (options.where) args["where"] = options.where;
    args["orderBy"] = options.orderBy
      ? { [options.orderBy.field]: options.orderBy.direction }
      : { id: "asc" };
    return args;
  }
}

function buildStore(client: PrismaLike): Store {
  const store: Record<string, unknown> = {
    driver: "prisma" as const,

    async transaction<R>(fn: (tx: Store) => Promise<R>): Promise<R> {
      return client.$transaction(async (tx) => fn(buildStore(tx as PrismaLike)));
    },

    async disconnect(): Promise<void> {
      await client.$disconnect();
    },

    async reset(): Promise<void> {
      if (process.env["NODE_ENV"] === "production") {
        throw errors.policyViolation("store.reset() is not permitted in production");
      }
      // Reverse order is a rough dependency order; there are no FK constraints
      // declared, but deleting children first keeps behaviour predictable.
      for (const name of [...ENTITY_NAMES].reverse()) {
        const delegate = client[ENTITY_TO_PRISMA_MODEL[name]];
        if (delegate) await delegate.deleteMany({});
      }
    },
  };

  for (const name of ENTITY_NAMES) {
    const modelName = ENTITY_TO_PRISMA_MODEL[name];
    const delegate = client[modelName];
    if (!delegate) {
      throw new Error(
        `Prisma client has no model "${modelName}" for collection "${name}". ` +
          `Run "pnpm db:generate" after changing prisma/schema.prisma.`,
      );
    }
    store[name] = new PrismaCollection(name, delegate);
  }

  return store as unknown as Store;
}

export async function createPrismaStore(databaseUrl?: string): Promise<Store> {
  let PrismaClient: new (options?: unknown) => PrismaLike;
  try {
    ({ PrismaClient } = (await import("@prisma/client")) as unknown as {
      PrismaClient: new (options?: unknown) => PrismaLike;
    });
  } catch (cause) {
    throw new Error(
      "The Prisma client is not generated. Run `pnpm db:generate` (and `pnpm db:push` " +
        "against a running Postgres) before selecting STORE_DRIVER=prisma.",
      { cause },
    );
  }
  const client = new PrismaClient(
    databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
  );
  return buildStore(client);
}
