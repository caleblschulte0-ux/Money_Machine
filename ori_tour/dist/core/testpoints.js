// Test points: a tester's own figure sites, saved on the device. Stand
// somewhere (a parking lot, the falls), put a figure down, and "Set test
// point here" remembers where you stood and where the figure stood relative
// to you. Walk away, come back, and TourFigures puts it there again on its
// own, through the same code a tour stop uses. They live in Storage, survive
// reloads, and never touch the tour package.
import { figureById } from "./figures.js";
import { isLatLon, validateFigure } from "./tour.js";
export const TEST_POINTS_SCHEMA = "ori.testpoints/1";
/** Problems with a stored test point, or none. */
export function validateTestPoint(raw, at = "test point") {
    if (typeof raw !== "object" || raw === null)
        return [`${at}: not an object`];
    const p = raw;
    const errs = [];
    if (typeof p.id !== "string" || !p.id)
        errs.push(`${at}: id missing`);
    if (typeof p.name !== "string" || !p.name)
        errs.push(`${at}: name missing`);
    if (!isLatLon(p.position))
        errs.push(`${at}: position invalid`);
    if (typeof p.radius_m !== "number" || !(p.radius_m > 0 && p.radius_m <= 100))
        errs.push(`${at}: radius_m invalid`);
    if (typeof p.facingDeg !== "number" || !Number.isFinite(p.facingDeg))
        errs.push(`${at}: facingDeg invalid`);
    if (typeof p.savedAt !== "number")
        errs.push(`${at}: savedAt invalid`);
    errs.push(...validateFigure(p.figure, at));
    return errs;
}
export class TestPoints {
    storage;
    key;
    points;
    /** Problems found when loading (bad entries are dropped, not fatal). */
    loadProblems = [];
    constructor(storage, key = "ori-test-points") {
        this.storage = storage;
        this.key = key;
        this.points = this.load();
    }
    list() {
        return this.points;
    }
    /** The points as figure sites, for TourFigures. */
    sites() {
        return [...this.points];
    }
    add(p) {
        const n = this.points.reduce((m, x) => Math.max(m, Number(/^test-(\d+)$/.exec(x.id)?.[1] ?? 0)), 0) + 1;
        const name = figureById(p.figure.model)?.name ?? p.figure.model;
        const point = {
            id: `test-${n}`,
            name: `Test point ${n} (${name})`,
            position: { lat: p.position.lat, lon: p.position.lon },
            radius_m: p.radius_m ?? 8,
            facingDeg: p.facingDeg,
            savedAt: p.savedAt,
            figure: {
                ...p.figure,
                bearing_deg: p.figure.bearing_deg ?? null,
                anchoring: "auto",
                note: "Saved on this phone as a test point; not part of any tour.",
            },
        };
        const errs = validateTestPoint(point);
        if (errs.length)
            throw new Error(errs.join("; "));
        this.points = [...this.points, point];
        this.save();
        return point;
    }
    remove(id) {
        this.points = this.points.filter((p) => p.id !== id);
        this.save();
    }
    clear() {
        this.points = [];
        this.storage.remove(this.key);
    }
    save() {
        this.storage.set(this.key, JSON.stringify({ schema: TEST_POINTS_SCHEMA, points: this.points }));
    }
    load() {
        const raw = this.storage.get(this.key);
        if (!raw)
            return [];
        let doc;
        try {
            doc = JSON.parse(raw);
        }
        catch {
            this.loadProblems.push("stored test points are not JSON; ignored");
            return [];
        }
        const d = doc;
        if (d?.schema !== TEST_POINTS_SCHEMA || !Array.isArray(d.points)) {
            this.loadProblems.push(`stored test points are not ${TEST_POINTS_SCHEMA}; ignored`);
            return [];
        }
        const out = [];
        d.points.forEach((p, i) => {
            const errs = validateTestPoint(p, `test point ${i + 1}`);
            if (errs.length)
                this.loadProblems.push(...errs);
            else
                out.push(p);
        });
        return out;
    }
}
