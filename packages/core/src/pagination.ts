export interface PageRequest {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly total?: number;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

export function normalizeLimit(limit: number | undefined): number {
  if (!limit || limit <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(limit, MAX_PAGE_SIZE);
}

/** In-memory pagination over an already-sorted array. */
export function paginate<T extends { id: string }>(
  items: readonly T[],
  request: PageRequest = {},
): Page<T> {
  const limit = normalizeLimit(request.limit);
  const start = request.cursor ? items.findIndex((i) => i.id === request.cursor) + 1 : 0;
  const slice = items.slice(start, start + limit);
  const last = slice.at(-1);
  const nextCursor = start + limit < items.length && last ? last.id : null;
  return { items: slice, nextCursor, total: items.length };
}
