// Figures inside the tour: each stop's figure (tour.json `figure`) stands near
// the stop while the visitor is there, in one spot, and is gone between stops.
//
// How it gets there without a tap ("auto"): the device's tracking space has
// no idea where north is, so TourFigures learns it. Every steady frame pairs
// the viewer's yaw in tracking space with the compass heading; their sum is
// the turn between tracking space and the map (a circular mean of recent
// pairs). The GPS fix then says how far and in which direction the figure's
// spot is from the visitor, and the ground height comes from the platform's
// ground hits. GPS is good to a few metres and the compass to a few degrees,
// so an auto figure lands NEAR its spot, not on it; once down it is anchored
// and does not move. Where the fix is too rough, the compass unsteady or no
// ground has been seen, it falls back to the visitor tapping the ground.
//
// Losing it: an anchor the platform cannot find for a few seconds while
// tracking is good is dropped and the figure re-placed from the stop's
// position. Surviving a reload or screen lock needs persistent anchors
// (WorldTracker.persistAnchor), which only some platforms have; without them
// the figure is re-placed from the stop's position when the visitor is back.
import { FigureStage } from "./anchoring.js";
import { figureById } from "./figures.js";
import { bearing, distance } from "./geo.js";
import { angleDiff, toRad, yawOf } from "./space.js";
import { figurePosition } from "./tour.js";
const D = {
    maxAccuracyM: 20,
    alignSamples: 20,
    alignSpreadDeg: 15,
    tapAfterMs: 12000,
    lostReplaceMs: 4000,
    keepBeyondM: 25,
};
export const stopFigureId = (stop) => `stop:${stop.id}`;
/** The FigureSpec for a stop's figure: the catalogue figure at the stop's scale and turn. */
export function stopFigureSpec(stop) {
    const f = stop.figure;
    if (!f)
        return null;
    const base = figureById(f.model);
    if (!base)
        return null;
    return {
        id: stopFigureId(stop),
        name: base.name,
        model: base.id,
        scale: f.scale,
        heightM: base.heightM * f.scale,
        footprintM: base.footprintM * f.scale,
        yawDeg: f.yaw_deg,
    };
}
export class TourFigures {
    stage;
    tour;
    tracker;
    o;
    pairs = [];
    groundY = null;
    active = null;
    arrivedT = null;
    placing = false;
    persisted = new Set();
    constructor(tracker, tour, opts = {}) {
        this.tracker = tracker;
        this.tour = tour;
        const pick = (k) => opts[k] ?? D[k];
        this.o = {
            maxAccuracyM: pick("maxAccuracyM"),
            alignSamples: pick("alignSamples"),
            alignSpreadDeg: pick("alignSpreadDeg"),
            tapAfterMs: pick("tapAfterMs"),
            lostReplaceMs: pick("lostReplaceMs"),
            keepBeyondM: pick("keepBeyondM"),
            storage: opts.storage,
            storageKey: opts.storageKey ?? `ori-figure-anchor:${tour.id}`,
            device: opts.device ?? "phone",
        };
        const specs = tour.stops.map(stopFigureSpec).filter((s) => s != null);
        // a stage needs a figure to select; a tour with none never activates one
        this.stage = new FigureStage(tracker, specs.length ? specs : [{ id: "none", name: "figure", heightM: 1, footprintM: 0.5, yawDeg: 0 }], {
            device: this.o.device,
        });
    }
    /** The learned turn from tracking space to the map, or null while the compass pairs disagree or are too few. */
    northYaw() {
        if (this.pairs.length < Math.min(this.o.alignSamples, 8))
            return null;
        let sx = 0;
        let sy = 0;
        for (const a of this.pairs) {
            sx += Math.cos(a);
            sy += Math.sin(a);
        }
        const mean = Math.atan2(sy, sx);
        const spread = Math.max(...this.pairs.map((a) => Math.abs(angleDiff(mean, a))));
        return spread <= toRad(this.o.alignSpreadDeg) ? mean : null;
    }
    /** Where a map point is in tracking space, on the ground. Null until north, a fix and the ground are known. */
    toTracking(target, viewerPos, fix) {
        const north = this.northYaw();
        if (north == null || this.groundY == null)
            return null;
        const d = distance(fix, target);
        const yaw = north - toRad(bearing(fix, target));
        return { x: viewerPos.x - Math.sin(yaw) * d, y: this.groundY, z: viewerPos.z - Math.cos(yaw) * d };
    }
    /** The visitor tapped: place the active stop's figure on the aimed ground. */
    async tap() {
        if (!this.active)
            return this.stage.place();
        this.stage.select(stopFigureId(this.active));
        const ok = await this.stage.place();
        if (ok)
            await this.persist();
        return ok;
    }
    update(input) {
        const f = input.frame;
        // learn north and the ground from every good frame
        if (f.quality === "normal" && f.viewer && input.heading != null && input.headingSteady) {
            this.pairs.push(yawOf(f.viewer.orientation) + toRad(input.heading));
            if (this.pairs.length > this.o.alignSamples)
                this.pairs.shift();
        }
        if (f.aim)
            this.groundY = f.aim.position.y;
        this.follow(input);
        const stage = this.stage.frame(f);
        const stop = this.active;
        if (!stop)
            return { stage, mode: "none", stopId: null, prompt: null, waitingFor: null, northYaw: this.northYaw() };
        const id = stopFigureId(stop);
        const fig = stage.figures.find((x) => x.id === id);
        const spec = stopFigureSpec(stop);
        // an anchor the platform has lost: drop it and put the figure back from the stop's position
        if (fig && fig.unlocatedMs > this.o.lostReplaceMs) {
            this.forget(stop);
            this.stage.remove(id);
        }
        if (fig && fig.hold === "anchored")
            void this.persist();
        let waitingFor = null;
        if (!fig && !this.placing) {
            waitingFor = this.autoBlocker(input, stop);
            if (waitingFor == null)
                this.autoPlace(input, stop);
        }
        const waitedLong = this.arrivedT != null && f.t - this.arrivedT > this.o.tapAfterMs;
        const tapMode = !fig && (stop.figure?.anchoring === "tap" || waitedLong);
        if (tapMode)
            this.stage.select(id);
        const mode = fig ? "standing" : tapMode ? "tap" : "waiting";
        let prompt;
        if (stage.phase === "lost")
            prompt = stage.prompt;
        else if (mode === "standing")
            prompt = fig?.hold === "anchoring" ? stage.prompt : null;
        else if (mode === "tap")
            prompt = stage.canPlace
                ? `Tap the ground to place the ${spec.name}.`
                : `${this.o.device === "glasses" ? "Look at" : "Point the phone at"} the ground to place the ${spec.name}.`;
        else
            prompt = `Look around slowly: the ${spec.name} is about to appear.`;
        return { stage, mode, stopId: stop.id, prompt, waitingFor, northYaw: this.northYaw() };
    }
    /** Track which stop's figure should be up: arrive to raise it, walk well away to take it down. */
    follow(input) {
        const at = input.atStop?.figure ? input.atStop : null;
        if (this.active && input.atStop && input.atStop.id !== this.active.id && !at) {
            // at another stop, one without a figure: this one's figure goes
            this.stage.remove(stopFigureId(this.active));
            this.active = null;
            this.arrivedT = null;
            return;
        }
        if (at && at.id !== this.active?.id) {
            if (this.active)
                this.stage.remove(stopFigureId(this.active));
            this.active = at;
            this.arrivedT = input.frame.t;
            this.restore(at);
            return;
        }
        if (this.active && !at && input.fix) {
            const away = distance(input.fix.pos, this.active.position);
            if (away > this.active.radius_m + this.o.keepBeyondM) {
                this.stage.remove(stopFigureId(this.active));
                this.active = null;
                this.arrivedT = null;
            }
        }
    }
    /** Why auto placement cannot happen yet, in words, or null when it can. */
    autoBlocker(input, stop) {
        if (stop.figure?.anchoring !== "auto")
            return "this figure is placed by a tap";
        if (input.frame.quality !== "normal" || !input.frame.viewer)
            return "tracking";
        if (!input.fix)
            return "GPS";
        if (input.fix.accuracy > this.o.maxAccuracyM)
            return `GPS (±${Math.round(input.fix.accuracy)} m)`;
        if (this.groundY == null)
            return "the ground";
        if (this.northYaw() == null)
            return "a steady compass";
        return null;
    }
    autoPlace(input, stop) {
        const viewer = input.frame.viewer;
        if (!viewer || !input.fix || !stop.figure)
            return;
        const target = this.toTracking(figurePosition(stop, stop.figure), viewer.position, input.fix.pos);
        if (!target)
            return;
        this.placing = true;
        void this.stage.placeAt(stopFigureId(stop), target).finally(() => (this.placing = false));
    }
    // ---- persistence (only where the platform has persistent anchors) ----
    key(stop) {
        return `${this.o.storageKey}:${stop.id}`;
    }
    restore(stop) {
        const handle = this.o.storage?.get(this.key(stop));
        if (!handle || !this.tracker.restoreAnchor)
            return;
        this.placing = true;
        void this.tracker
            .restoreAnchor(handle)
            .then((anchorId) => {
            if (anchorId != null && this.active?.id === stop.id) {
                this.stage.adopt(stopFigureId(stop), anchorId);
                this.persisted.add(stop.id);
            }
            else if (anchorId == null)
                this.forget(stop);
        })
            .finally(() => (this.placing = false));
    }
    async persist() {
        const stop = this.active;
        if (!stop || this.persisted.has(stop.id) || !this.tracker.persistAnchor || !this.o.storage)
            return;
        const fig = this.stage.standing(stopFigureId(stop));
        if (fig?.hold !== "anchored" || fig.anchorId == null)
            return;
        this.persisted.add(stop.id);
        const handle = await this.tracker.persistAnchor(fig.anchorId);
        if (handle)
            this.o.storage.set(this.key(stop), handle);
        else
            this.persisted.delete(stop.id);
    }
    forget(stop) {
        const handle = this.o.storage?.get(this.key(stop));
        if (handle) {
            this.tracker.forgetAnchor?.(handle);
            this.o.storage?.remove(this.key(stop));
        }
        this.persisted.delete(stop.id);
    }
}
