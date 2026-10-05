// Small browser adapters: clock, timer, package loading, storage.

import type { AssetLoader, Clock, Scheduler, Storage, Unsubscribe } from "../core/ports.ts";

export const wallClock: Clock = { now: () => Date.now() };

export const intervalScheduler: Scheduler = {
  every(ms: number, fn: () => void): Unsubscribe {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  },
};

export const fetchAssets: AssetLoader = {
  async json(path: string): Promise<unknown> {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  },
  async text(path: string): Promise<string> {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.text();
  },
};

/** localStorage, or memory when storage is blocked (private mode, some WebViews). */
export function browserStorage(): Storage {
  const mem = new Map<string, string>();
  return {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return mem.get(key) ?? null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        mem.set(key, value);
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        mem.delete(key);
      }
    },
  };
}

/** Offer a JSON value as a file download. */
export function download(name: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
