// Phone shell: a Display for a phone held up like a viewfinder. The scene
// window over the camera (or a backdrop), guidance, captions, status chips,
// the sensor readout, the route map, and the staff controls.
import { renderHud } from "../hud.js";
import { RouteMap } from "../map.js";
import { renderScene, setParallax } from "../scene.js";
const $ = (id) => {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`#${id} missing from index.html`);
    return el;
};
export class PhoneDisplay {
    routeMap;
    session = null;
    toastTimer;
    hud = false;
    /** called after every render, for mode panels that show live values */
    afterRender = null;
    constructor(tour, map) {
        this.routeMap = new RouteMap($("map"), map, tour);
        addEventListener("resize", () => {
            this.routeMap.view = null;
            if (this.session)
                this.session.render();
        });
        $("btnCam").onclick = () => void this.toggleCamera();
        $("sourcesClose").onclick = () => ($("sources").hidden = true);
    }
    /** Connect the controls to a running session. */
    bind(session, map, audio) {
        this.session = session;
        this.routeMap.replace(map, session.tour);
        $("btnCalib").onclick = () => session.calibrate();
        $("btnForce").onclick = () => session.force();
        $("btnSkip").onclick = () => session.skip();
        $("btnMute").onclick = () => {
            audio.muted = !audio.muted;
            $("btnMute").textContent = audio.muted ? "Sound off" : "Sound on";
            if (audio.muted)
                audio.stop();
        };
        $("btnSources").onclick = () => this.showSources();
        $("tourTitle").textContent = `${session.tour.title} · ${session.tour.subtitle}`;
    }
    render(v) {
        const lens = $("lens");
        const guide = $("guide");
        if (v.mode === "scene" && v.scene) {
            if (lens.dataset.stop !== v.scene.id) {
                renderScene(lens, v.scene);
                lens.dataset.stop = v.scene.id;
            }
            setParallax(lens, v.sensors.offTargetDeg);
            lens.hidden = false;
            guide.hidden = true;
        }
        else {
            lens.hidden = true;
            lens.dataset.stop = "";
            guide.hidden = false;
            const g = v.guide;
            guide.innerHTML = `${g.arrow == null ? "" : `<div class="arrow" style="transform:rotate(${g.arrow}deg)">↑</div>`}
        <div class="big">${g.title}</div><div class="small">${g.detail}</div>`;
        }
        const cap = $("caption");
        cap.textContent = v.caption;
        cap.hidden = !v.caption;
        for (const [id, chip] of [
            ["chipGps", v.status.gps],
            ["chipHead", v.status.heading],
            ["chipMove", v.status.movement],
        ]) {
            const el = $(id);
            el.textContent = chip.text;
            el.className = `chip ${chip.level}`;
        }
        $("btnCalib").hidden = !v.controls.calibrate;
        $("btnForce").hidden = !v.controls.force;
        $("btnSkip").hidden = !v.controls.skip;
        const hud = $("hud");
        hud.hidden = !this.hud;
        document.body.classList.toggle("hud", this.hud);
        if (this.hud)
            renderHud(hud, v);
        const st = this.session?.engine.state;
        this.routeMap.draw({
            pos: st?.pos ?? null,
            accuracy: st?.accuracy ?? null,
            heading: st?.heading ?? null,
            progress: v.progress,
        });
        this.afterRender?.(v);
    }
    notify(text) {
        const t = $("toast");
        t.textContent = text;
        t.hidden = false;
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => (t.hidden = true), 4000);
    }
    showSources() {
        const session = this.session;
        if (!session)
            return;
        const st = session.engine.state;
        const s = st.showing ?? st.atStop ?? session.tour.stops.find((x) => x.id === st.nextId) ?? session.tour.stops[0];
        if (!s)
            return;
        const esc = (x) => x.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
        $("sourcesBody").innerHTML =
            `<h3>${esc(s.name)}</h3><p class="muted">${esc(s.narration.review)}</p><ul>` +
                s.sources
                    .map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a></li>`)
                    .join("") +
                `</ul><h4>Still to do</h4><ul>${s.todo.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` +
                `<p class="muted">Placement: ${esc(s.placement)}</p>` +
                (s.narration.voice ? `<p class="muted">Voice: ${esc(s.narration.voice)}</p>` : "");
        $("sources").hidden = false;
    }
    /** Camera passthrough behind the scene window: the phone version of "AR". */
    async toggleCamera(on) {
        const v = $("cam");
        const running = !!v.srcObject;
        if (on === undefined)
            on = !running;
        if (!on) {
            if (v.srcObject instanceof MediaStream)
                v.srcObject.getTracks().forEach((t) => t.stop());
            v.srcObject = null;
            document.body.classList.remove("camera");
            return false;
        }
        if (running)
            return true;
        try {
            v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
            document.body.classList.add("camera");
            return true;
        }
        catch {
            this.notify("Camera unavailable. The tour works without it.");
            return false;
        }
    }
}
