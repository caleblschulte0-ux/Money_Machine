// The ViewModel: everything any display needs, decided once, device-neutral.
// A phone draws all of it; 600x600 glasses draw the scene, the guide line and
// the caption; a Lens Studio port anchors the scene in the world. None of them
// re-derive what to say.

import type { EngineState, TourEngine } from "./engine.ts";
import { bearing, compassWord, distance, turn } from "./geo.ts";
import { targetBearing } from "./tour.ts";
import type { Stop } from "./types.ts";

export type Level = "ok" | "warn" | "bad";

export interface Guide {
  /** Turn arrow, degrees relative to straight ahead (+ right), or null for no arrow. */
  arrow: number | null;
  title: string;
  detail: string;
}

/** Raw-ish numbers for the sensor readout (test-anywhere and staff screens). */
export interface SensorReadout {
  accuracyM: number | null;
  headingDeg: number | null;
  headingSteady: boolean;
  speedMps: number;
  moving: boolean;
  still: boolean;
  stillSource: "motion" | "gps";
  next: { name: string; order: number; distanceM: number | null; bearingDeg: number | null; radiusM: number } | null;
  /** at a stop: how far the visitor's heading is from the landmark */
  offTargetDeg: number | null;
  facing: boolean;
}

export interface ViewModel {
  mode: "scene" | "guide";
  /** the stop whose scene is up */
  scene: Stop | null;
  guide: Guide;
  caption: string;
  status: {
    gps: { text: string; level: Level };
    heading: { text: string; level: Level };
    movement: { text: string; level: Level };
  };
  sensors: SensorReadout;
  controls: { calibrate: boolean; force: boolean; skip: boolean };
  progress: { visited: ReadonlySet<string>; nextId: string | null; legIndex: number; done: boolean };
}

export function guidance(engine: TourEngine, opts: { hasMap?: boolean } = {}): Guide {
  const hasMap = opts.hasMap ?? true;
  const st = engine.state;
  const next = engine.tour.stops.find((s) => s.id === st.nextId);
  if (!next) return { arrow: null, title: "Tour complete", detail: "Head back to the start when you're ready." };
  if (!st.pos)
    return { arrow: null, title: `Stop ${next.order}: ${next.name}`, detail: st.error ?? "Waiting for GPS…" };
  if (st.atStop) {
    const s = st.atStop;
    const t = targetBearing(s);
    if (st.heading == null) {
      return {
        arrow: null,
        title: s.facing.hint,
        detail: `Face ${compassWord(t)}, toward ${s.facing.target_name}. No compass here: tap "Show scene".`,
      };
    }
    if (!st.facing && engine.requireFacing) {
      const d = turn(st.heading, t);
      return {
        arrow: d,
        title: s.facing.hint,
        detail:
          `Turn ${d > 0 ? "right" : "left"} about ${Math.abs(Math.round(d / 5) * 5)}°, toward ${s.facing.target_name}` +
          (st.headingSteady ? "" : `. Compass unsteady: if you are facing it, tap "I'm facing it".`),
      };
    }
    return { arrow: null, title: "Stand still for a moment", detail: "The scene appears when you stop walking." };
  }
  const d = distance(st.pos, next.position);
  const b = bearing(st.pos, next.position);
  return {
    arrow: st.heading == null ? null : turn(st.heading, b),
    title: `Stop ${next.order}: ${next.name}`,
    detail: `${Math.round(d)} m ${st.heading == null ? compassWord(b) : "ahead"}${hasMap ? " · follow the bright line on the map" : ""}`,
  };
}

function readout(engine: TourEngine): SensorReadout {
  const st: EngineState = engine.state;
  const next = engine.tour.stops.find((s) => s.id === st.nextId) ?? null;
  return {
    accuracyM: st.accuracy,
    headingDeg: st.heading,
    headingSteady: st.headingSteady,
    speedMps: st.speed,
    moving: st.moving,
    still: st.still,
    stillSource: st.stillSource,
    next: next && {
      name: next.name,
      order: next.order,
      radiusM: next.radius_m,
      distanceM: st.pos ? distance(st.pos, next.position) : null,
      bearingDeg: st.pos ? bearing(st.pos, next.position) : null,
    },
    offTargetDeg: st.atStop && st.heading != null ? turn(st.heading, targetBearing(st.atStop)) : null,
    facing: st.facing,
  };
}

export function buildView(engine: TourEngine, caption: string, opts: { hasMap?: boolean } = {}): ViewModel {
  const st = engine.state;
  return {
    mode: st.showing ? "scene" : "guide",
    scene: st.showing,
    guide: guidance(engine, opts),
    caption,
    status: {
      gps: {
        text: st.error ? st.error : st.pos ? `GPS ±${Math.round(st.accuracy ?? 0)} m` : "Finding GPS…",
        level: st.error ? "bad" : st.accuracy != null && st.accuracy <= 10 ? "ok" : "warn",
      },
      heading: {
        text: st.heading == null ? "No compass" : `Facing ${Math.round(st.heading)}° ${compassWord(st.heading)}`,
        level: st.heading == null ? "warn" : st.headingSteady ? "ok" : "warn",
      },
      movement: {
        text: st.moving ? "Walking · audio only" : st.still ? "Still" : "Stopping…",
        level: "ok",
      },
    },
    sensors: readout(engine),
    controls: { calibrate: !!(st.atStop && st.raw != null), force: !st.showing, skip: !!st.nextId },
    progress: { visited: st.visited, nextId: st.nextId, legIndex: st.legIndex, done: st.done },
  };
}
