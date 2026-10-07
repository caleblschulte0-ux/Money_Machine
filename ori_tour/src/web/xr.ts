// WorldTracker for browsers with WebXR augmented reality: Chrome on Android
// phones with Google Play Services for AR (ARCore). Tracking, ground hits and
// anchors all come from ARCore through the WebXR Device API:
//   immersive-ar session, "hit-test" (required), "anchors" and "dom-overlay" (optional).
// Safari on iPhone does not offer WebXR AR; see quicklook.ts for the iPhone route.
//
// Persistent anchors (surviving a reload or a screen lock) use the WebXR
// anchors module's persistence calls where the browser has them (Meta Quest
// Browser: requestPersistentHandle / restorePersistentAnchor). Chrome on
// Android phones does not (2026): there, persistAnchor resolves null and the
// tour re-places a figure from its stop's position instead.

import type * as THREE from "three";

import type { TrackedFrame, TrackingQuality, WorldTracker } from "../core/ports.ts";
import type { Pose } from "../core/space.ts";

const toPose = (t: XRRigidTransform): Pose => ({
  position: { x: t.position.x, y: t.position.y, z: t.position.z },
  orientation: { x: t.orientation.x, y: t.orientation.y, z: t.orientation.z, w: t.orientation.w },
});

/** True when this browser can start a world-tracking AR session. */
export async function webxrArAvailable(): Promise<boolean> {
  try {
    return (await navigator.xr?.isSessionSupported("immersive-ar")) ?? false;
  } catch {
    return false;
  }
}

export class WebXRTracker implements WorldTracker {
  private session: XRSession | null = null;
  private ref: XRReferenceSpace | null = null;
  private hitSource: XRHitTestSource | null = null;
  private readonly anchors = new Map<string, XRAnchor>();
  private pending: { pose: Pose; resolve: (id: string | null) => void }[] = [];
  private next = 1;
  private onFrame: ((f: TrackedFrame) => void) | null = null;
  /** Called when the session ends (the visitor pressed Exit, or the system closed it). */
  onEnd: (() => void) | null = null;
  /** Whether this session can anchor (set once started). */
  canAnchor = false;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly overlay: HTMLElement;
  private readonly draw: () => void;

  /** draw: renders the scene; called once per XR frame, after the frame callback. */
  constructor(renderer: THREE.WebGLRenderer, overlay: HTMLElement, draw: () => void) {
    this.renderer = renderer;
    this.overlay = overlay;
    this.draw = draw;
  }

  async start(onFrame: (f: TrackedFrame) => void): Promise<string | null> {
    if (!navigator.xr) return "This browser has no WebXR. Use Chrome on an Android phone.";
    let session: XRSession;
    try {
      session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["anchors", "dom-overlay"],
        domOverlay: { root: this.overlay },
      });
    } catch (e) {
      return `AR could not start (${e instanceof Error ? e.message : String(e)}). This phone may need Google Play Services for AR.`;
    }
    this.session = session;
    this.onFrame = onFrame;
    this.renderer.xr.setReferenceSpaceType("local");
    await this.renderer.xr.setSession(session);
    this.ref = this.renderer.xr.getReferenceSpace();
    const viewer = await session.requestReferenceSpace("viewer");
    this.hitSource = (await session.requestHitTestSource?.({ space: viewer })) ?? null;
    const enabled = (session as XRSession & { enabledFeatures?: readonly string[] }).enabledFeatures;
    this.canAnchor = enabled ? enabled.includes("anchors") : "createAnchor" in XRFrame.prototype;
    session.addEventListener("end", () => {
      this.renderer.setAnimationLoop(null);
      this.session = null;
      this.hitSource = null;
      this.anchors.clear();
      for (const p of this.pending.splice(0)) p.resolve(null);
      this.onEnd?.();
    });
    this.renderer.setAnimationLoop((_t, frame) => {
      if (frame) this.tick(frame);
    });
    return null;
  }

  stop(): void {
    void this.session?.end();
  }

  /** The session, for listening to taps ("select"). */
  get xrSession(): XRSession | null {
    return this.session;
  }

  createAnchor(pose: Pose): Promise<string | null> {
    if (!this.session || !this.canAnchor) return Promise.resolve(null);
    // anchors can only be made inside a frame callback
    return new Promise((resolve) => this.pending.push({ pose, resolve }));
  }

  deleteAnchor(id: string): void {
    this.anchors.get(id)?.delete();
    this.anchors.delete(id);
  }

  async persistAnchor(id: string): Promise<string | null> {
    const a = this.anchors.get(id);
    if (!a?.requestPersistentHandle) return null;
    try {
      return await a.requestPersistentHandle();
    } catch {
      return null;
    }
  }

  async restoreAnchor(handle: string): Promise<string | null> {
    const s = this.session;
    if (!s?.restorePersistentAnchor) return null;
    try {
      const anchor = await s.restorePersistentAnchor(handle);
      const id = `xr${this.next++}`;
      this.anchors.set(id, anchor);
      return id;
    } catch {
      return null;
    }
  }

  forgetAnchor(handle: string): void {
    void this.session?.deletePersistentAnchor?.(handle).catch(() => undefined);
  }

  /** Whether this browser can keep anchors across sessions. */
  get canPersist(): boolean {
    return typeof this.session?.restorePersistentAnchor === "function";
  }

  private tick(frame: XRFrame): void {
    const ref = this.ref!;
    for (const req of this.pending.splice(0)) {
      const { position: p, orientation: q } = req.pose;
      const made = frame.createAnchor?.(new XRRigidTransform({ x: p.x, y: p.y, z: p.z }, q), ref);
      if (!made) {
        req.resolve(null);
        continue;
      }
      made.then(
        (anchor) => {
          const id = `xr${this.next++}`;
          this.anchors.set(id, anchor);
          req.resolve(id);
        },
        () => req.resolve(null),
      );
    }

    const vp = frame.getViewerPose(ref);
    const quality: TrackingQuality = !vp ? "lost" : vp.emulatedPosition ? "limited" : "normal";
    let aim: Pose | null = null;
    if (this.hitSource && vp) {
      const hit = frame.getHitTestResults(this.hitSource)[0];
      const hp = hit?.getPose(ref);
      if (hp) aim = toPose(hp.transform);
    }
    const anchors = new Map<string, Pose | null>();
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
