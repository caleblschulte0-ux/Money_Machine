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
import { add, groundDist, scale, toRad, vec, yawOf, yawQuat, yawToward } from "./space.js";
import { targetBearing } from "./tour.js";
export const DRAFT_FLAG = "Prototype · content not yet reviewed";
export function sceneCard(stop) {
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
const D = { distanceM: 4, sideDeg: -25, liftM: 0.15, widthM: 1.4 };
export class SceneCards {
    o;
    lastYaw = 0;
    placed = null;
    constructor(opts = {}) {
        this.o = { ...D, ...opts };
    }
    update(i) {
        // leaving the stop takes the card down; the next stop's scene places its own
        if (this.placed && this.placed.card.stopId !== i.at?.id)
            this.placed = null;
        const viewer = i.frame.viewer;
        if (!this.placed && i.showing && viewer && i.frame.quality === "normal") {
            const towards = i.northYaw != null
                ? { yaw: i.northYaw - toRad(targetBearing(i.showing)), by: "landmark" }
                : { yaw: yawOf(viewer.orientation), by: "gaze" };
            const yaw = towards.yaw + toRad(this.o.sideDeg);
            const ahead = scale(vec(-Math.sin(yaw), 0, -Math.cos(yaw)), this.o.distanceM);
            const at = add(add(viewer.position, ahead), vec(0, this.o.liftM, 0));
            this.placed = { card: sceneCard(i.showing), at, aimedBy: towards.by };
        }
        if (!this.placed)
            return null;
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
