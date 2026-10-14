// The content package, schema "ori.tour/1". The JSON Schema in
// schemas/ori.tour-1.schema.json describes the same shape for tools that are
// not TypeScript (Lens Studio scripts, Python, an editor); a test holds the
// two in agreement.

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Facing {
  /** What the visitor should face, by name ("Middle Sioux Falls"). */
  target_name: string;
  /** A point on the landmark. The bearing to face is computed from the stop. */
  target?: LatLon;
  /** Or an explicit bearing, degrees from true north (set on site; wins over target). */
  bearing_deg?: number | null;
  /** How far off the bearing still counts as facing it. */
  tolerance_deg: number;
  /** Short instruction shown while turning ("Face the falls"). */
  hint: string;
}

export interface Narration {
  text: string;
  /** Pre-generated audio, relative to the package. */
  audio?: string | null;
  /** Caption cues for the audio, relative to the package. */
  cues?: string | null;
  duration_s?: number;
  /** Who or what speaks it, e.g. "generated (...)". */
  voice?: string;
  /** First 16 hex of sha256(text) when the audio was made: stale-audio guard. */
  text_sha?: string;
  /** Review status, said plainly. Never empty. */
  review: string;
}

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

export interface TimelineItem {
  year: string;
  text: string;
}

/** A 2.5D layer: an image with depth for parallax and simple motion. */
export interface SceneLayer {
  src: string;
  depth?: number;
  motion?: "none" | "drift" | "rise" | "fade-in";
  alt?: string;
}

export interface Scene {
  kind: "falls" | "quote" | "timeline" | "list" | "image" | "layers";
  kicker?: string;
  title: string;
  lines?: string[];
  attribution?: string;
  timeline?: TimelineItem[];
  image?: string | null;
  layers?: SceneLayer[];
  /** What is missing and why, shown on the scene until it is resolved. */
  placeholder?: string;
}

export interface Source {
  label: string;
  url: string;
}

/**
 * A world-locked 3D figure that stands near a stop while the visitor is
 * there (a mammoth, a settler). It stays in one spot as they walk around it
 * and is gone between stops (audio only while walking between stops).
 */
export interface StopFigure {
  /** A figure id from src/core/figures.ts ("mammoth", "settler"). */
  model: string;
  /** 1 = true size. */
  scale: number;
  /** Ground distance from the stop's position to where the figure stands, metres. */
  offset_m: number;
  /** Direction from the stop to the figure, degrees from true north. Null: the stop's facing bearing (in front of the landmark view). */
  bearing_deg?: number | null;
  /** Which way it is turned, degrees counter-clockwise from facing the stop. 90 shows it side-on. */
  yaw_deg: number;
  /**
   * auto: put it on the detected ground on arrival, from the stop's position and
   * the compass, without a tap; the visitor can tap to move it.
   * tap: the visitor taps the ground to place it.
   */
  anchoring: "auto" | "tap";
  /** Why this figure is here, or its review status, said plainly. Never empty. */
  note: string;
}

export interface Stop {
  id: string;
  order: number;
  name: string;
  position: LatLon;
  radius_m: number;
  placement: string;
  facing: Facing;
  narration: Narration;
  scene: Scene;
  sources: Source[];
  todo: string[];
  /** Optional world-locked figure at this stop. */
  figure?: StopFigure | null;
}

export interface Safety {
  pictures_only_when_still: boolean;
  still_below_mps: number;
  still_for_seconds: number;
  keep_lower_field_clear?: boolean;
  note?: string;
}

export interface Tour {
  schema: "ori.tour/1";
  id: string;
  title: string;
  subtitle: string;
  version: string;
  status: string;
  credits: string[];
  safety: Safety;
  start: { name: string; position: LatLon; note?: string };
  stops: Stop[];
}

export interface MapLeg {
  from: string;
  to: string;
  metres: number;
  routed: boolean;
  /** [lat, lon] pairs */
  line: [number, number][];
}

export interface TourMap {
  attribution: string;
  layers: Record<string, [number, number][][]>;
  labels: unknown[];
  legs: MapLeg[];
}
