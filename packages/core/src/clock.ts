/**
 * Time is injected, never read from the ambient environment inside business
 * logic. Deterministic tests depend on this, and so does replaying a workflow
 * run for an audit.
 */
export interface Clock {
  now(): Date;
  epochMillis(): number;
}

export const systemClock: Clock = {
  now: () => new Date(),
  epochMillis: () => Date.now(),
};

export class FixedClock implements Clock {
  private current: number;

  constructor(start: Date | number = 0) {
    this.current = typeof start === "number" ? start : start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  epochMillis(): number {
    return this.current;
  }

  advance(millis: number): void {
    this.current += millis;
  }

  set(value: Date | number): void {
    this.current = typeof value === "number" ? value : value.getTime();
  }
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** `YYYY-MM` bucket used by budgets, P&L rollups and cost attribution. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}
