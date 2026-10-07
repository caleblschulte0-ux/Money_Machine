// World-locked figures: put a figure (a mammoth, a settler) on the ground and
// keep it in that one spot while the visitor walks around it, walks away and
// comes back.
//
// The device's WorldTracker (ports.ts) does the hard part, tracking its own
// pose and keeping anchors fixed to the real world. This module decides
// everything else, the same way on every device: where a tap actually puts
// the figure (never on top of the visitor), which way it faces, where it is
// this frame (anchor pose, corrected as the platform's map improves), whether
// to draw it, and what to tell the visitor. A display only draws StageView.
import { IDENTITY, angleDiff, compose, dist, groundDist, invert, scale, sub, add, toDeg, toRad, yawOf, yawQuat, yawToward, } from "./space.js";
/** Counting "walked around" stops beyond this distance, where a few steps sideways sweep large angles from GPS-free noise. */
const AROUND_MAX_M = 30;
export class FigureStage {
    specs;
    placed = new Map();
    selectedId;
    last = null;
    gen = 0;
    clearance;
    maxPlace;
    aimWords;
    tracker;
    constructor(tracker, specs, options = {}) {
        this.tracker = tracker;
        if (specs.length === 0)
            throw new Error("FigureStage needs at least one figure");
        this.specs = new Map(specs.map((s) => [s.id, s]));
        this.selectedId = specs[0].id;
        this.clearance = options.clearanceM ?? 1.5;
        this.maxPlace = options.maxPlaceM ?? 25;
        this.aimWords = options.device === "glasses" ? "Look at" : "Point the phone at";
    }
    get selected() {
        return this.specs.get(this.selectedId);
    }
    select(id) {
        if (!this.specs.has(id))
            throw new Error(`unknown figure ${id}`);
        this.selectedId = id;
    }
    /**
     * Where a placement at `aim` really goes: on the aimed ground, pushed back so
     * the visitor stands clear of the footprint, pulled in past maxPlaceM, and
     * turned to face the visitor (plus the figure's own yaw).
     */
    placement(spec, aim, viewer) {
        const flat = { x: aim.position.x - viewer.position.x, y: 0, z: aim.position.z - viewer.position.z };
        const d = Math.hypot(flat.x, flat.z);
        const minD = spec.footprintM + this.clearance;
        let position = aim.position;
        if (d < minD || d > this.maxPlace) {
            // aimed at our own feet: push straight ahead along the view
            const yaw = yawOf(viewer.orientation);
            const dir = d > 1e-3 ? scale(flat, 1 / d) : { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
            const want = Math.min(Math.max(d, minD), this.maxPlace);
            position = add({ x: viewer.position.x, y: aim.position.y, z: viewer.position.z }, scale(dir, want));
        }
        const face = yawToward(position, viewer.position) + toRad(spec.yawDeg);
        return { position, orientation: yawQuat(face) };
    }
    /** Add a figure the stage did not start with (a tour adds each stop's figure). */
    addSpec(spec) {
        this.specs.set(spec.id, spec);
    }
    /** A standing figure's anchor and hold, or null if it is not standing. */
    standing(id) {
        const p = this.placed.get(id);
        return p ? { anchorId: p.anchorId, hold: p.hold } : null;
    }
    /** Ids of the figures standing now. */
    get placedIds() {
        return [...this.placed.keys()];
    }
    /** Put the selected figure where the visitor is aiming. False if there is no ground to put it on yet. */
    async place() {
        const f = this.last;
        if (!f?.aim || !f.viewer || f.quality === "lost")
            return false;
        const spec = this.selected;
        return this.pin(spec, this.placement(spec, f.aim, f.viewer));
    }
    /**
     * Put a figure at a point worked out some other way (a tour stop's position
     * through the compass and GPS), on the ground, with the same clearance and
     * facing rules as a tap. False while the device does not know where it is.
     */
    async placeAt(id, target) {
        const f = this.last;
        const spec = this.specs.get(id);
        if (!spec)
            throw new Error(`unknown figure ${id}`);
        if (!f?.viewer || f.quality === "lost")
            return false;
        return this.pin(spec, this.placement(spec, { position: target, orientation: IDENTITY }, f.viewer));
    }
    /**
     * Stand a figure on an anchor the platform restored from an earlier session
     * (persistent anchors). The anchor was made at the figure's own pose.
     */
    adopt(id, anchorId) {
        const spec = this.specs.get(id);
        if (!spec)
            throw new Error(`unknown figure ${id}`);
        this.remove(id);
        const pose = { position: { x: 0, y: 0, z: 0 }, orientation: IDENTITY };
        this.placed.set(id, {
            ...this.fresh(spec, pose),
            anchorId,
            // the anchor IS the figure's pose: no offset to learn
            offset: { position: { x: 0, y: 0, z: 0 }, orientation: IDENTITY },
        });
    }
    fresh(spec, pose) {
        return {
            spec,
            placed: pose,
            gen: ++this.gen,
            anchorId: null,
            hold: "anchoring",
            offset: null,
            pose,
            correctionM: 0,
            around: 0,
            lastAngle: null,
            seenT: this.last?.t ?? null,
        };
    }
    async pin(spec, pose) {
        this.remove(spec.id);
        const p = this.fresh(spec, pose);
        const gen = p.gen;
        this.placed.set(spec.id, p);
        const id = await this.tracker.createAnchor(pose);
        const current = this.placed.get(spec.id);
        if (current?.gen !== gen) {
            // placed again (or removed) while this anchor was being made
            if (id != null)
                this.tracker.deleteAnchor(id);
            return true;
        }
        if (id == null)
            current.hold = "tracking-only";
        else
            current.anchorId = id;
        return true;
    }
    remove(id) {
        const p = this.placed.get(id);
        if (!p)
            return;
        if (p.anchorId != null)
            this.tracker.deleteAnchor(p.anchorId);
        this.placed.delete(id);
    }
    clear() {
        for (const id of [...this.placed.keys()])
            this.remove(id);
    }
    /** Answer one tracking frame. Call once per rendered frame, then draw the result. */
    frame(f) {
        this.last = f;
        const viewer = f.quality === "lost" ? null : f.viewer;
        const figures = [];
        for (const p of this.placed.values()) {
            let located = true;
            if (p.anchorId != null) {
                const a = f.anchors.get(p.anchorId);
                if (a) {
                    p.seenT = f.t;
                    if (p.offset == null) {
                        // first sighting fixes the figure's place in the anchor's frame, so
                        // a platform that turns or snaps its anchors cannot turn the figure
                        p.offset = compose(invert(a), p.placed);
                    }
                    else if (p.hold === "anchoring") {
                        // adopted from an earlier session: it stands where the anchor came back
                        p.placed = compose(a, p.offset);
                    }
                    p.pose = compose(a, p.offset);
                    p.hold = "anchored";
                    p.correctionM = dist(p.pose.position, p.placed.position);
                }
                else {
                    located = false;
                }
            }
            let distanceM = null;
            let turnDeg = null;
            if (viewer) {
                distanceM = groundDist(viewer.position, p.pose.position);
                turnDeg = -toDeg(angleDiff(yawOf(viewer.orientation), yawToward(viewer.position, p.pose.position)));
                if (f.quality === "normal" && distanceM <= AROUND_MAX_M && distanceM > 0.3) {
                    const rel = sub(viewer.position, p.pose.position);
                    const angle = Math.atan2(rel.x, rel.z);
                    if (p.lastAngle != null)
                        p.around += angleDiff(p.lastAngle, angle);
                    p.lastAngle = angle;
                }
                else {
                    p.lastAngle = null;
                }
            }
            const unlocatedMs = p.anchorId != null && !located && f.quality === "normal" && p.seenT != null ? f.t - p.seenT : 0;
            figures.push({
                id: p.spec.id,
                name: p.spec.name,
                model: p.spec.model ?? p.spec.id,
                scale: p.spec.scale ?? 1,
                anchorId: p.anchorId,
                unlocatedMs,
                pose: p.pose,
                // an anchor not located this frame keeps its last pose while tracking holds
                visible: viewer != null && (located || p.offset != null || p.anchorId == null),
                hold: p.hold,
                distanceM,
                turnDeg,
                aroundDeg: Math.abs(toDeg(p.around)),
                correctionM: p.correctionM,
            });
        }
        const reticle = viewer && f.aim ? this.placement(this.selected, f.aim, viewer) : null;
        const phase = f.viewer == null && this.placed.size === 0 && f.quality !== "lost"
            ? "starting"
            : f.quality === "lost"
                ? "lost"
                : this.placed.size > 0
                    ? "placed"
                    : reticle
                        ? "ready"
                        : "scanning";
        return {
            phase,
            quality: f.quality,
            prompt: this.prompt(phase, reticle != null, figures),
            reticle,
            canPlace: reticle != null,
            selected: this.selectedId,
            figures,
        };
    }
    prompt(phase, canPlace, figures) {
        const name = this.selected.name;
        switch (phase) {
            case "starting":
                return "Starting the camera.";
            case "lost": {
                const placed = figures[0];
                return placed
                    ? `Lost track. ${this.aimWords} the ground and move slowly. The ${placed.name} comes back where you left it.`
                    : `Lost track. ${this.aimWords} the ground and move slowly.`;
            }
            case "scanning":
                return `${this.aimWords} the ground a few steps ahead and move slowly side to side.`;
            case "ready":
                return `Tap to place the ${name} there.`;
            case "placed": {
                const f = figures.find((x) => x.id === this.selectedId) ?? figures[0];
                if (f.hold === "anchoring")
                    return `Pinning the ${f.name} to the ground.`;
                if (f.distanceM != null && f.turnDeg != null && Math.abs(f.turnDeg) > 40) {
                    const side = Math.abs(f.turnDeg) > 135 ? "behind you" : f.turnDeg > 0 ? "to your right" : "to your left";
                    return `The ${f.name} is ${side}, ${Math.round(f.distanceM)} m away.`;
                }
                if (f.aroundDeg >= 350)
                    return `You've walked all the way around the ${f.name}. Walk away and come back.`;
                if (f.aroundDeg >= 30)
                    return `${Math.round(f.aroundDeg)}° around the ${f.name}. Keep going.`;
                return canPlace
                    ? `Walk around the ${f.name}. Tap again to move it.`
                    : `Walk around the ${f.name}. It stays where you put it.`;
            }
        }
    }
}
