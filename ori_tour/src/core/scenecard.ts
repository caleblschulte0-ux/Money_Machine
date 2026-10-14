// The stop's scene, standing in the world. On a phone screen the scene is a
// square card over the camera; on glasses it belongs out there, beside the
// landmark it is about, where the wearer looked when the story began. This
// module decides WHAT the card says and WHERE it stands, in tracking space; a
// port only draws a flat panel at the pose it is given (three.js plane here,
// a Text component on Spectacles).
//
// The card is world-locked like the figures: it is placed once, when the
// scene first comes up at a stop, and keeps that spot while the visitor stays
// at that stop. It turns (about the vertical only) to keep facing them.
// Pictures only when standing still (ori_tour/CLAUDE.md): the card is VISIBLE
// only while the engine shows the scene, so it hides when they walk and comes
// back in the same spot when they stop. Leaving the stop takes it down.

import type { TrackedFrame } from "./ports.ts";
import { add, groundDist, scale, toRad, vec, yawOf, yawQuat, yawToward, type Pose, type Vec3 } from "./space.ts";
import { targetBearing } from "./tour.ts";
import type { Stop } from "./types.ts";

export interface CardRow {
  /** A short lead in front of the text (a year), or null. */
  lead: string | null;
  text: string;
}

/** What a scene card says, already laid out as rows; nothing device-specific. */
export interface SceneCard {
  stopId: string;
  kicker: string;
  title: string;
  /** "quote" rows are set as a quotation; others as a plain list. */
  style: "quote" | "list";
  rows: CardRow[];
  /** A credit line under the rows (a quotation's source), or null. */
  credit: string | null;
  /** Always shown: the content is a draft until it is reviewed. */
  flag: string;
}

export const DRAFT_FLAG = "Prototype · content not yet reviewed";

export function sceneCard(stop: Stop): SceneCard {
  const s = stop.scene;
  const base = { stopId: stop.id, kicker: s.kicker ?? "", title: s.title, flag: DRAFT_FLAG };
  if (s.kind === "timeline")
    return {
      ...base,
      style: "list",
      rows: (s.timeline ?? []).map((t) => ({ lead: t.year, text: t.text })),
      credit: null,
    };
  if (s.kind === "quote")
    return {
      ...base,
      style: "quote",
      rows: (s.lines ?? []).map((text) => ({ lead: null, text })),
      credit: s.attribution ?? null,
    };
  return { ...base, style: "list", rows: (s.lines ?? []).map((text) => ({ lead: null, text })), credit: null };
}

export interface SceneCardOptions {
  /** How far in front of the visitor the card stands, metres. Default 4. */
  distanceM?: number;
  /** Turned this far from the landmark line, degrees (- = left), so it does not cover the landmark or the figure. Default -25. */
  sideDeg?: number;
  /** Card centre above the visitor's eyes, metres. Default 0.15. */
  liftM?: number;
  /** Width of the card in the world, metres (the port keeps the aspect). Default 1.4. */
  widthM?: number;
}

const D: Required<SceneCardOptions> = { distanceM: 4, sideDeg: -25, liftM: 0.15, widthM: 1.4 };

export interface SceneCardInput {
  frame: TrackedFrame;
  /** The stop whose scene is up (the engine's `showing`), or null. */
  showing: Stop | null;
  /** The stop the visitor is at (the engine's `atStop`), or null between stops. */
  at: { id: string } | null;
  /** Tracking-space turn to the map (TourFiguresView.northYaw), or null while it is learned. */
  northYaw: number | null;
}

export interface SceneCardView {
  card: SceneCard;
  /** Centre of the card; its +z (the readable face) turned toward the visitor. */
  pose: Pose;
  widthM: number;
  /** Shown now: the scene is up (the visitor is still and facing it). Hidden, it keeps its spot. */
  visible: boolean;
  /** "landmark": aimed by map and compass; "gaze": where the visitor looked when the scene came up. */
  aimedBy: "landmark" | "gaze";
}

export class SceneCards {
  private readonly o: Required<SceneCardOptions>;
  private lastYaw = 0;
  private placed: { card: SceneCard; at: Vec3; aimedBy: SceneCardView["aimedBy"] } | null = null;

  constructor(opts: SceneCardOptions = {}) {
    this.o = { ...D, ...opts };
  }

  update(i: SceneCardInput): SceneCardView | null {
    // leaving the stop takes the card down; the next stop's scene places its own
    if (this.placed && this.placed.card.stopId !== i.at?.id) this.placed = null;
    const viewer = i.frame.viewer;
    if (!this.placed && i.showing && viewer && i.frame.quality === "normal") {
      const towards =
        i.northYaw != null
          ? { yaw: i.northYaw - toRad(targetBearing(i.showing)), by: "landmark" as const }
          : { yaw: yawOf(viewer.orientation), by: "gaze" as const };
      const yaw = towards.yaw + toRad(this.o.sideDeg);
      const ahead = scale(vec(-Math.sin(yaw), 0, -Math.cos(yaw)), this.o.distanceM);
      const at = add(add(viewer.position, ahead), vec(0, this.o.liftM, 0));
      this.placed = { card: sceneCard(i.showing), at, aimedBy: towards.by };
    }
    if (!this.placed) return null;
    const { at } = this.placed;
    // keep facing the visitor; from right on top of it, keep the last turn
    const yaw = viewer && groundDist(viewer.position, at) > 0.3 ? yawToward(viewer.position, at) : this.lastYaw;
    this.lastYaw = yaw;
    return {
      card: this.placed.card,
      pose: { position: at, orientation: yawQuat(yaw) },
      widthM: this.o.widthM,
      visible: i.showing?.id === this.placed.card.stopId,
      aimedBy: this.placed.aimedBy,
    };
  }
}
