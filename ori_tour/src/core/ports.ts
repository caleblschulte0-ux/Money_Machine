// THE PORTING CONTRACT.
//
// Everything a device must provide to run an ORI tour is declared here. The
// core (src/core) never touches a screen, a speaker, a sensor API, the
// network or a timer directly; it only calls these interfaces. A new device
// (a phone browser, Meta Ray-Ban Display, Snap Spectacles in Lens Studio, an
// Android app for XREAL or RayNeo) is a set of adapters implementing them,
// plus a Display that draws the device-neutral ViewModel.
//
// src/web/ implements all of them for browsers. docs/PORTING.md walks through
// each one for Lens Studio and Android.
//
// Units, everywhere: time in milliseconds on one monotonic-enough clock,
// angles in degrees clockwise from TRUE north, distances in metres,
// acceleration in m/s^2.

import type { CaptionCue, LatLon, Narration } from "./types.ts";
import type { ViewModel } from "./view.ts";

/** One position reading, or an error sentence the visitor can read. */
export type LocationReading =
  { t: number; pos: LatLon; accuracy: number; speed: number | null; error?: undefined } | { t: number; error: string };

export type Unsubscribe = () => void;

/** Time. Live: wall clock. Replay and tests: a virtual clock. */
export interface Clock {
  now(): number;
}

/** Repeating timer (the engine re-evaluates "still for 2 s" with no new reading). */
export interface Scheduler {
  every(ms: number, fn: () => void): Unsubscribe;
}

/** GPS, or whatever gives position: phone GPS, a paired phone, a replayed walk. */
export interface LocationSource {
  start(sink: (r: LocationReading) => void): Unsubscribe;
}

/**
 * Compass heading the visitor's FACE points (for glasses) or the back of the
 * phone points (phone held up like a viewfinder), degrees from true north.
 * Raw is fine; the core smooths it. Devices without one omit this source and
 * run with requireFacing: false.
 */
export interface HeadingSource {
  /** Ask for permission where the platform needs a user gesture. Returns an error sentence or null. */
  request?(): Promise<string | null>;
  start(sink: (degrees: number, t: number) => void): Unsubscribe;
}

/** Magnitude of acceleration INCLUDING gravity, about 10-50 Hz. Optional but it makes "standing still" fast and reliable. */
export interface MotionSource {
  start(sink: (magnitude: number, t: number) => void): Unsubscribe;
}

/** Speaks a stop's narration and reports captions as it goes. */
export interface AudioPort {
  /** Called inside a user gesture where the platform requires one before audio may start. */
  unlock?(): void;
  /**
   * Play the narration. Must call onCaption with each caption line (empty
   * string to clear) and onEnd exactly once when it finishes. If there is no
   * audio output at all, still run the captions at reading pace and end.
   */
  play(narration: Narration, onCaption: (text: string) => void, onEnd: () => void): void;
  stop(): void;
  muted: boolean;
}

/** Draws the ViewModel. The only thing a device's UI has to understand. */
export interface Display {
  render(view: ViewModel): void;
  /** A short transient message ("Stop 1 done"). A glasses display may ignore it while a scene is up. */
  notify?(text: string): void;
}

/** Small persistent key-value storage (site-walk placements, settings). */
export interface Storage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Reads package files. Browsers fetch; Lens Studio reads bundled assets; Android reads app assets. */
export interface AssetLoader {
  json(path: string): Promise<unknown>;
  text(path: string): Promise<string>;
}

/** Caption cues for pre-generated audio, as AssetLoader returns them. */
export type Cues = CaptionCue[];
