// The iPhone route to the full test mode: Variant Launch
// (https://launch.variant3d.com). Safari on iPhone has no WebXR AR; Launch's
// App Clip opens this same page in its own viewer, which provides WebXR
// ("immersive-ar", "local" space, hit-test, anchors, dom-overlay) on ARKit. Our
// WebXR code then runs unchanged: Spawn here, test points, the readout. Not
// available on this route: light estimation and depth (no sun-matched light,
// no occlusion); the readout says so.
//
// The SDK key is publishable (it sits in a public script tag, bound to the
// hosting domain in Launch's dashboard), so it lives here. Empty means the
// route is off and an iPhone gets AR Quick Look only. `?vlkey=` overrides it
// for trying a key without a commit.

/** ORI's Variant Launch SDK key (free Developer tier). Empty until the account exists. */
export const LAUNCH_KEY = "";

export interface LaunchState {
  /** True on an iPhone in Safari where opening launchUrl gives this page WebXR. */
  launchRequired: boolean;
  launchUrl: string;
}

interface InitDetail {
  launchRequired: boolean;
  webXRStatus: "unsupported" | "launch-required" | "supported";
  launchUrl: string;
}

/**
 * Load the Launch SDK if a key is set. Resolves when it has initialised (inside
 * the Launch viewer that is when WebXR becomes available), or null if there is
 * no key, it cannot load, or it does not answer within `timeoutMs`.
 */
export function initLaunch(params: URLSearchParams, timeoutMs = 8000): Promise<LaunchState | null> {
  const key = params.get("vlkey") ?? LAUNCH_KEY;
  if (!key) return Promise.resolve(null);
  return new Promise((resolve) => {
    const done = (v: LaunchState | null): void => {
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    window.addEventListener(
      "vlaunch-initialized",
      (e) => {
        const d = (e as CustomEvent<InitDetail>).detail;
        done({ launchRequired: d.launchRequired, launchUrl: d.launchUrl });
      },
      { once: true },
    );
    const s = document.createElement("script");
    s.src = `https://launchar.app/sdk/v1?key=${encodeURIComponent(key)}`;
    s.onerror = () => done(null);
    document.head.appendChild(s);
  });
}
