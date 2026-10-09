// The content package: version check, validation, asset resolution and
// on-site placement edits. Pure; loading goes through the AssetLoader port.

import { figureById } from "./figures.ts";
import { bearing, distance, ll, norm, offset } from "./geo.ts";
import type { AssetLoader } from "./ports.ts";
import type { LatLon, Stop, StopFigure, Tour, TourMap } from "./types.ts";

/** The schema this player reads. A package with another major version is refused. */
export const SCHEMA = "ori.tour/1";

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
export const isLatLon = (p: unknown): p is LatLon =>
  isObj(p) && isNum(p.lat) && isNum(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/**
 * Every problem with a package, as plain sentences. Empty means usable.
 * Kept in step with schemas/ori.tour-1.schema.json by test/schema.test.ts.
 */
export function validateTour(input: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(input)) return ["package is not an object"];
  const t = input;
  if (t.schema !== SCHEMA) errs.push(`schema is ${String(t.schema)}, this player reads ${SCHEMA}`);
  for (const k of ["id", "title", "version", "status"]) if (!isStr(t[k])) errs.push(`${k} missing`);
  if (!isObj(t.start) || !isLatLon(t.start.position)) errs.push("start.position missing or invalid");
  const safety = isObj(t.safety) ? t.safety : {};
  if (typeof safety.pictures_only_when_still !== "boolean") errs.push("safety.pictures_only_when_still missing");
  for (const k of ["still_below_mps", "still_for_seconds"]) if (!isNum(safety[k])) errs.push(`safety.${k} missing`);
  if (!Array.isArray(t.stops) || t.stops.length === 0) {
    errs.push("no stops");
    return errs;
  }
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const raw of t.stops as unknown[]) {
    if (!isObj(raw)) {
      errs.push("a stop is not an object");
      continue;
    }
    const s = raw;
    const at = `stop ${isStr(s.id) ? s.id : "?"}`;
    if (!isStr(s.id) || !/^[a-z0-9-]+$/.test(s.id)) errs.push(`${at}: id must be lowercase letters, digits, dashes`);
    else if (ids.has(s.id)) errs.push(`${at}: duplicate id`);
    else ids.add(s.id);
    if (!isNum(s.order)) errs.push(`${at}: order missing`);
    else if (orders.has(s.order)) errs.push(`${at}: duplicate order ${s.order}`);
    else orders.add(s.order);
    if (!isStr(s.name)) errs.push(`${at}: name missing`);
    if (!isLatLon(s.position)) errs.push(`${at}: position missing or invalid`);
    if (!isNum(s.radius_m) || s.radius_m <= 0) errs.push(`${at}: radius_m must be positive`);
    if (!isStr(s.placement)) errs.push(`${at}: placement must say how the stop was placed`);
    const f = isObj(s.facing) ? s.facing : null;
    if (!f) errs.push(`${at}: facing missing`);
    else {
      if (!isLatLon(f.target) && !isNum(f.bearing_deg)) errs.push(`${at}: facing needs a target or bearing_deg`);
      if (!isNum(f.tolerance_deg) || f.tolerance_deg <= 0 || f.tolerance_deg > 180)
        errs.push(`${at}: facing.tolerance_deg must be in (0, 180]`);
      if (!isStr(f.target_name)) errs.push(`${at}: facing.target_name missing`);
      if (!isStr(f.hint)) errs.push(`${at}: facing.hint missing`);
    }
    const n = isObj(s.narration) ? s.narration : null;
    if (!n || !isStr(n.text)) errs.push(`${at}: no narration text`);
    if (!n || !isStr(n.review)) errs.push(`${at}: narration.review must say its review status`);
    if (n && n.audio && !isStr(n.cues)) errs.push(`${at}: narration audio needs a cues file for captions`);
    const sc = isObj(s.scene) ? s.scene : null;
    if (!sc || !isStr(sc.title)) errs.push(`${at}: no scene title`);
    if (!Array.isArray(s.sources)) errs.push(`${at}: sources must be a list (empty is honest, missing is not)`);
    if (!Array.isArray(s.todo)) errs.push(`${at}: todo must be a list`);
    if (s.figure != null) errs.push(...validateFigure(s.figure, at));
  }
  return errs;
}

/** Problems with a figure entry (a stop's, or a saved test point's), or none. */
export function validateFigure(raw: unknown, at: string): string[] {
  if (!isObj(raw)) return [`${at}: figure must be an object`];
  const f = raw;
  const errs: string[] = [];
  if (!isStr(f.model) || !figureById(f.model))
    errs.push(`${at}: figure.model ${String(f.model)} is not a known figure`);
  if (!isNum(f.scale) || f.scale <= 0 || f.scale > 4) errs.push(`${at}: figure.scale must be in (0, 4]`);
  if (!isNum(f.offset_m) || f.offset_m < 0 || f.offset_m > 60) errs.push(`${at}: figure.offset_m must be 0 to 60`);
  if (f.bearing_deg != null && (!isNum(f.bearing_deg) || f.bearing_deg < 0 || f.bearing_deg >= 360))
    errs.push(`${at}: figure.bearing_deg must be in [0, 360) or null`);
  if (!isNum(f.yaw_deg)) errs.push(`${at}: figure.yaw_deg missing`);
  if (f.anchoring !== "auto" && f.anchoring !== "tap") errs.push(`${at}: figure.anchoring must be auto or tap`);
  if (!isStr(f.note)) errs.push(`${at}: figure.note must say why it is there`);
  return errs;
}

/** Where a stop's figure stands on the ground. */
export function figurePosition(stop: Stop, figure: StopFigure): LatLon {
  const b = figure.bearing_deg ?? targetBearing(stop);
  return figure.offset_m > 0 ? offset(stop.position, figure.offset_m, norm(b)) : { ...stop.position };
}

/** Bearing the visitor must face at a stop. */
export const targetBearing = (s: Stop): number =>
  s.facing.bearing_deg != null ? s.facing.bearing_deg : bearing(s.position, s.facing.target ?? s.position);

/** Resolve the package's relative asset paths against where it was loaded from, and order the stops. */
export function prepareTour(tour: Tour, map: TourMap, base = ""): { tour: Tour; map: TourMap } {
  for (const s of tour.stops) {
    const n = s.narration;
    if (n.audio) n.audio = base + n.audio;
    if (n.cues) n.cues = base + n.cues;
    if (s.scene.image) s.scene.image = base + s.scene.image;
    for (const layer of s.scene.layers ?? []) layer.src = base + layer.src;
  }
  tour.stops.sort((a, b) => a.order - b.order);
  return { tour, map };
}

export class TourPackageError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super("Tour package problems: " + problems.join("; "));
    this.problems = problems;
  }
}

/** Load, validate and prepare a package from `base` (e.g. "content/falls-park/"). */
export async function loadTour(base: string, assets: AssetLoader): Promise<{ tour: Tour; map: TourMap }> {
  const [tour, map] = await Promise.all([assets.json(base + "tour.json"), assets.json(base + "map.json")]);
  const errs = validateTour(tour);
  if (errs.length) throw new TourPackageError(errs);
  return prepareTour(tour as Tour, map as TourMap, base);
}

export type Placements = Record<string, { position?: LatLon; bearing?: number }>;

/**
 * Apply on-site placements made in site-walk mode. Returns true if anything
 * changed. A moved stop no longer matches its pre-routed path, so its legs
 * fall back to straight guide lines.
 */
export function applyPlacements(tour: Tour, map: TourMap, edits: Placements | null): boolean {
  if (!edits) return false;
  let changed = false;
  for (const s of tour.stops) {
    const e = edits[s.id];
    if (!e) continue;
    if (e.position) s.position = e.position;
    if (e.bearing != null) s.facing.bearing_deg = e.bearing;
    changed = true;
  }
  const pts = [tour.start.position, ...tour.stops.map((s) => s.position)];
  map.legs.forEach((leg, i) => {
    const a = pts[i];
    const b = pts[i + 1];
    const first = leg.line[0];
    const last = leg.line[leg.line.length - 1];
    if (!a || !b || !first || !last) return;
    if (distance(a, ll(first)) > 10 || distance(b, ll(last)) > 10) {
      leg.line = [
        [a.lat, a.lon],
        [b.lat, b.lon],
      ];
      leg.routed = false;
    }
  });
  return changed;
}
