// Small browser adapters: clock, timer, package loading, storage.
export const wallClock = { now: () => Date.now() };
export const intervalScheduler = {
    every(ms, fn) {
        const id = setInterval(fn, ms);
        return () => clearInterval(id);
    },
};
export const fetchAssets = {
    async json(path) {
        const r = await fetch(path);
        if (!r.ok)
            throw new Error(`${path}: HTTP ${r.status}`);
        return r.json();
    },
    async text(path) {
        const r = await fetch(path);
        if (!r.ok)
            throw new Error(`${path}: HTTP ${r.status}`);
        return r.text();
    },
};
/** localStorage, or memory when storage is blocked (private mode, some WebViews). */
export function browserStorage() {
    const mem = new Map();
    return {
        get(key) {
            try {
                return localStorage.getItem(key);
            }
            catch {
                return mem.get(key) ?? null;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, value);
            }
            catch {
                mem.set(key, value);
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
            }
            catch {
                mem.delete(key);
            }
        },
    };
}
/** Offer a JSON value as a file download. */
export function download(name, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
