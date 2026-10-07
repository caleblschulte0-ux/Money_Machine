// The iPhone route to the full test mode: Variant Launch
// (https://launch.variant3d.com). Safari on iPhone has no WebXR AR; Launch's
// App Clip opens this same page in its own viewer, which provides WebXR
// ("immersive-ar", "local" space, hit-test, anchors, dom-overlay) on ARKit. Our
// WebXR code then runs unchanged: Spawn here, test points, the readout. Not
// available on this route: light estimation and depth (no sun-matched light,
// no occlusion); the readout says so.
//
// Nothing here is hard-coded: the SDK address and key are config
// (config/launch.json, read at run time), and `?vlkey=` overrides the key for
// trying one without a commit. An empty key means the route is off and an
// iPhone gets AR Quick Look only. Only this web port knows Launch exists; the
// core and the figure stage see a WebXR session like any other.
async function readConfig(path) {
    try {
        const r = await fetch(path, { cache: "no-cache" });
        if (!r.ok)
            return null;
        const c = (await r.json());
        return c.schema === "ori.launch/1" && typeof c.sdkUrl === "string" && typeof c.key === "string"
            ? c
            : null;
    }
    catch {
        return null;
    }
}
/**
 * Load the Launch SDK if a key is configured. Resolves when it has initialised (inside
 * the Launch viewer that is when WebXR becomes available), or null if there is
 * no key, it cannot load, or it does not answer within `timeoutMs`.
 */
export async function initLaunch(params, configPath = "config/launch.json", timeoutMs = 8000) {
    const config = await readConfig(configPath);
    const key = params.get("vlkey") ?? config?.key ?? "";
    if (!key || !config?.sdkUrl)
        return null;
    return new Promise((resolve) => {
        const done = (v) => {
            clearTimeout(timer);
            resolve(v);
        };
        const timer = setTimeout(() => done(null), timeoutMs);
        window.addEventListener("vlaunch-initialized", (e) => {
            const d = e.detail;
            done({ launchRequired: d.launchRequired, launchUrl: d.launchUrl });
        }, { once: true });
        const s = document.createElement("script");
        s.src = `${config.sdkUrl}?key=${encodeURIComponent(key)}`;
        s.onerror = () => done(null);
        document.head.appendChild(s);
    });
}
