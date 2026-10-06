// WorldTracker for browsers with WebXR augmented reality: Chrome on Android
// phones with Google Play Services for AR (ARCore). Tracking, ground hits and
// anchors all come from ARCore through the WebXR Device API:
//   immersive-ar session, "hit-test" (required), "anchors" and "dom-overlay" (optional).
// Safari on iPhone does not offer WebXR AR; see quicklook.ts for the iPhone route.
const toPose = (t) => ({
    position: { x: t.position.x, y: t.position.y, z: t.position.z },
    orientation: { x: t.orientation.x, y: t.orientation.y, z: t.orientation.z, w: t.orientation.w },
});
/** True when this browser can start a world-tracking AR session. */
export async function webxrArAvailable() {
    try {
        return (await navigator.xr?.isSessionSupported("immersive-ar")) ?? false;
    }
    catch {
        return false;
    }
}
export class WebXRTracker {
    session = null;
    ref = null;
    hitSource = null;
    anchors = new Map();
    pending = [];
    next = 1;
    onFrame = null;
    /** Called when the session ends (the visitor pressed Exit, or the system closed it). */
    onEnd = null;
    /** Whether this session can anchor (set once started). */
    canAnchor = false;
    renderer;
    overlay;
    draw;
    /** draw: renders the scene; called once per XR frame, after the frame callback. */
    constructor(renderer, overlay, draw) {
        this.renderer = renderer;
        this.overlay = overlay;
        this.draw = draw;
    }
    async start(onFrame) {
        if (!navigator.xr)
            return "This browser has no WebXR. Use Chrome on an Android phone.";
        let session;
        try {
            session = await navigator.xr.requestSession("immersive-ar", {
                requiredFeatures: ["hit-test"],
                optionalFeatures: ["anchors", "dom-overlay"],
                domOverlay: { root: this.overlay },
            });
        }
        catch (e) {
            return `AR could not start (${e instanceof Error ? e.message : String(e)}). This phone may need Google Play Services for AR.`;
        }
        this.session = session;
        this.onFrame = onFrame;
        this.renderer.xr.setReferenceSpaceType("local");
        await this.renderer.xr.setSession(session);
        this.ref = this.renderer.xr.getReferenceSpace();
        const viewer = await session.requestReferenceSpace("viewer");
        this.hitSource = (await session.requestHitTestSource?.({ space: viewer })) ?? null;
        const enabled = session.enabledFeatures;
        this.canAnchor = enabled ? enabled.includes("anchors") : "createAnchor" in XRFrame.prototype;
        session.addEventListener("end", () => {
            this.renderer.setAnimationLoop(null);
            this.session = null;
            this.hitSource = null;
            this.anchors.clear();
            for (const p of this.pending.splice(0))
                p.resolve(null);
            this.onEnd?.();
        });
        this.renderer.setAnimationLoop((_t, frame) => {
            if (frame)
                this.tick(frame);
        });
        return null;
    }
    stop() {
        void this.session?.end();
    }
    /** The session, for listening to taps ("select"). */
    get xrSession() {
        return this.session;
    }
    createAnchor(pose) {
        if (!this.session || !this.canAnchor)
            return Promise.resolve(null);
        // anchors can only be made inside a frame callback
        return new Promise((resolve) => this.pending.push({ pose, resolve }));
    }
    deleteAnchor(id) {
        this.anchors.get(id)?.delete();
        this.anchors.delete(id);
    }
    tick(frame) {
        const ref = this.ref;
        for (const req of this.pending.splice(0)) {
            const { position: p, orientation: q } = req.pose;
            const made = frame.createAnchor?.(new XRRigidTransform({ x: p.x, y: p.y, z: p.z }, q), ref);
            if (!made) {
                req.resolve(null);
                continue;
            }
            made.then((anchor) => {
                const id = `xr${this.next++}`;
                this.anchors.set(id, anchor);
                req.resolve(id);
            }, () => req.resolve(null));
        }
        const vp = frame.getViewerPose(ref);
        const quality = !vp ? "lost" : vp.emulatedPosition ? "limited" : "normal";
        let aim = null;
        if (this.hitSource && vp) {
            const hit = frame.getHitTestResults(this.hitSource)[0];
            const hp = hit?.getPose(ref);
            if (hp)
                aim = toPose(hp.transform);
        }
        const anchors = new Map();
        for (const [id, a] of this.anchors) {
            const tracked = frame.trackedAnchors ? frame.trackedAnchors.has(a) : true;
            const ap = tracked ? frame.getPose(a.anchorSpace, ref) : undefined;
            anchors.set(id, ap ? toPose(ap.transform) : null);
        }
        this.onFrame?.({
            t: performance.now(),
            viewer: vp ? toPose(vp.transform) : null,
            quality,
            aim,
            anchors,
        });
        this.draw();
    }
}
