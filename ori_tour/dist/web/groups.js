// groups.html: two tour groups on the real Falls Park route, drawn from the
// portable core's group-audio planner (src/core/groupaudio.ts). Shows where
// they meet, when both would be talking while close (red), the holds the plan
// puts at the scripts' flex points instead, and plays it: "Listen as" a group
// hears its own narration, and the other group's leak by distance.
//
// The groups are simulated walkers on the real route with the real narration;
// on glasses the same plan runs from the devices' shared positions.
import { conflicts, encounters, plan, playheadAt, positionAt, schedule, segmentFromCues, speakingAt, tourRoute, } from "../core/groupaudio.js";
const BASE = "content/falls-park/";
const HORIZON = 1300;
const STEP = 0.5;
const COLOURS = ["#ffbe5a", "#6cc2c9"];
const $ = (id) => document.getElementById(id);
async function json(path) {
    const r = await fetch(path);
    if (!r.ok)
        throw new Error(`${path}: HTTP ${r.status}`);
    return (await r.json());
}
async function loadWorld() {
    const [tour, map] = await Promise.all([json(`${BASE}tour.json`), json(`${BASE}map.json`)]);
    const cues = new Map();
    for (const s of tour.stops)
        cues.set(s.id, await json(`${BASE}audio/${s.id}.cues.json`));
    return { tour, map, route: tourRoute(map, tour.stops), cues };
}
function groups(w, gapS, speedA, speedB) {
    const stops = [...w.tour.stops]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
        stopId: s.id,
        routeS: w.route.stopS.get(s.id),
        segment: segmentFromCues(s.id, w.cues.get(s.id), { prompt: `Look at ${s.facing.target_name}` }),
        settleS: 4,
        lingerS: 20,
    }));
    const g = (id, startAt, speed) => ({
        id,
        route: w.route.route,
        speedMps: speed,
        startAt,
        startS: 0,
        spreadM: 2,
        stops,
    });
    return [g("Group A", 0, speedA), g("Group B", gapS, speedB)];
}
// ---------------------------------------------------------------- state
let world;
let gs = [];
let thePlan;
let scheds = [];
let coordinated = true;
let t = 0;
let playing = false;
let rate = 8;
let listenAs = null;
function replan() {
    gs = groups(world, Number($("gap").value), Number($("speedA").value), Number($("speedB").value));
    $("gapOut").textContent = `${$("gap").value} s`;
    $("speedAOut").textContent = `${Number($("speedA").value).toFixed(1)} m/s`;
    $("speedBOut").textContent = `${Number($("speedB").value).toFixed(1)} m/s`;
    thePlan = plan(gs, { horizonS: HORIZON, stepS: STEP });
    scheds = gs.map((g) => schedule(g, coordinated ? thePlan.adjustments : []));
    overlaps = conflicts(scheds, { horizonS: HORIZON, stepS: STEP });
    report();
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function report() {
    const total = (cs) => cs.reduce((s, c) => s + c.end - c.start, 0);
    const now = conflicts(scheds, { horizonS: HORIZON, stepS: STEP });
    const meets = encounters(scheds, { horizonS: HORIZON, stepS: STEP });
    const lines = [];
    lines.push(`<b>${meets.length}</b> times the groups come within 8 m of each other (${[...new Set(meets.map((m) => m.kind.replace("-", " ")))].join(", ") || "none"}).`);
    lines.push(`Without coordination they would talk over each other <b>${thePlan.before.length}</b> times, <b>${total(thePlan.before).toFixed(0)} s</b> in all.`);
    if (coordinated) {
        lines.push(`With it: <b>${now.length}</b> overlaps. The plan adds <b>${thePlan.addedS.toFixed(0)} s</b> of pauses:`);
        const items = thePlan.adjustments.map((a) => {
            const stop = world.tour.stops.find((s) => s.id === a.segment);
            const where = a.at === 0 ? "before its narration" : "between sentences";
            return `<li>${a.group} waits ${a.seconds.toFixed(1)} s at ${stop.name}, ${where}, shown "${a.prompt}"</li>`;
        });
        if (thePlan.ducks.length)
            items.push(`<li>${thePlan.ducks.length} overlaps had no room: the glasses turn down and show captions there</li>`);
        lines.push(`<ul>${items.join("") || "<li>nothing to change</li>"}</ul>`);
    }
    else
        lines.push("Coordination is off: red marks where both groups talk while close.");
    $("report").innerHTML = lines.join(" ");
}
// ---------------------------------------------------------------- drawing
function mapCanvas() {
    const c = $("map");
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pts = world.route.route.points;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const pad = 26;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const k = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
    const ox = (w - (maxX - minX) * k) / 2;
    const oy = (h - (maxY - minY) * k) / 2;
    const P = (p) => [ox + (p.x - minX) * k, h - (oy + (p.y - minY) * k)];
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(...P(p)) : ctx.moveTo(...P(p))));
    ctx.stroke();
    ctx.font = "12px system-ui, sans-serif";
    for (const s of world.tour.stops) {
        const [x, y] = P(world.route.route.at(world.route.stopS.get(s.id)));
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(s.name, x + 8, y - 6);
    }
    scheds.forEach((sc, i) => {
        const [x, y] = P(positionAt(sc, t));
        const talking = speakingAt(sc, t);
        const ph = playheadAt(sc, t);
        // the 8 m around a talking group: where its sound reaches
        if (talking) {
            ctx.fillStyle = `${COLOURS[i]}33`;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(6, 8 * k), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = COLOURS[i];
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(`${sc.group.id}${talking ? " (talking)" : ph?.holding ? " (waiting)" : ""}`, x + 9, y + 16 + i * 14);
    });
}
/** The timeline shows three minutes around now, so a few seconds of overlap is visible. */
const WINDOW = 180;
let timelineEnd = 1;
let overlaps = [];
let win0 = 0;
function drawTimeline() {
    const c = $("timeline");
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    timelineEnd = Math.max(...scheds.map((s) => s.endAt));
    win0 = Math.max(0, Math.min(t - WINDOW / 3, timelineEnd - WINDOW));
    const X = (s) => 70 + ((s - win0) / WINDOW) * (w - 80);
    const rowH = 22;
    ctx.save();
    ctx.beginPath();
    ctx.rect(70, 0, w - 70, h);
    ctx.clip();
    scheds.forEach((sc, i) => {
        const y = 10 + i * (rowH + 12);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(70, y, w - 80, rowH);
        for (const n of sc.narrations)
            for (const f of n.flexAt)
                if (f.held > 0) {
                    ctx.fillStyle = "rgba(255,255,255,0.35)";
                    ctx.fillRect(X(f.t), y + rowH / 2 - 2, Math.max(2, X(f.t + f.held) - X(f.t)), 4);
                }
        ctx.fillStyle = COLOURS[i];
        for (const sp of sc.speech)
            ctx.fillRect(X(sp.start), y, Math.max(1, X(sp.end) - X(sp.start) - 1), rowH);
    });
    ctx.fillStyle = "rgba(255,90,90,0.85)";
    for (const o of overlaps)
        ctx.fillRect(X(o.start), 4, Math.max(2, X(o.end) - X(o.start)), 2 * rowH + 18);
    ctx.restore();
    ctx.font = "12px system-ui, sans-serif";
    scheds.forEach((sc, i) => {
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.fillText(sc.group.id, 0, 25 + i * (rowH + 12));
    });
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let m = Math.ceil(win0 / 30) * 30; m <= win0 + WINDOW; m += 30)
        ctx.fillText(fmt(m), X(m) - 10, h - 2);
    $("cursor").style.left = `${X(t)}px`;
    $("clock").textContent = fmt(t);
}
// ---------------------------------------------------------------- sound
let actx = null;
const buffers = new Map();
const voices = [null, null];
async function ensureAudio() {
    if (!actx)
        actx = new AudioContext();
    await actx.resume();
    for (const s of world.tour.stops) {
        if (buffers.has(s.id) || !s.narration.audio)
            continue;
        const r = await fetch(`${BASE}${s.narration.audio}`);
        buffers.set(s.id, await actx.decodeAudioData(await r.arrayBuffer()));
    }
    return actx;
}
/** The share of a group's narration that reaches a listener `d` metres away through open-ear speakers (a rough model: -6 dB per doubling past 1 m, from a quiet start). */
const leak = (d) => Math.min(0.35, 0.35 / Math.max(1, d));
function sound() {
    if (!actx || listenAs === null || !playing || rate !== 1) {
        voices.forEach((v, i) => stopVoice(i));
        return;
    }
    const me = positionAt(scheds[listenAs], t);
    scheds.forEach((sc, i) => {
        const ph = playheadAt(sc, t);
        const v = voices[i];
        const want = ph && !ph.holding ? ph : null;
        const expected = v ? v.offset + (actx.currentTime - v.started) : 0;
        if (!want || !v || v.segment !== want.segment || Math.abs(expected - want.contentS) > 0.3) {
            stopVoice(i);
            if (want) {
                const buf = buffers.get(want.segment);
                if (!buf)
                    return;
                const src = actx.createBufferSource();
                src.buffer = buf;
                const gain = actx.createGain();
                src.connect(gain).connect(actx.destination);
                src.start(0, want.contentS);
                voices[i] = { src, gain, segment: want.segment, started: actx.currentTime, offset: want.contentS };
            }
        }
        const cur = voices[i];
        if (cur) {
            const d = Math.hypot(positionAt(sc, t).x - me.x, positionAt(sc, t).y - me.y);
            cur.gain.gain.value = i === listenAs ? 1 : leak(d);
        }
    });
}
function stopVoice(i) {
    const v = voices[i];
    if (v) {
        try {
            v.src.stop();
        }
        catch {
            // already stopped
        }
        voices[i] = null;
    }
}
// ---------------------------------------------------------------- loop and controls
let last = performance.now();
function frame(now) {
    const dt = (now - last) / 1000;
    last = now;
    if (playing) {
        t += dt * rate;
        if (t > timelineEnd) {
            t = timelineEnd;
            playing = false;
            $("play").textContent = "Play";
        }
    }
    mapCanvas();
    drawTimeline();
    sound();
    requestAnimationFrame(frame);
}
function jumpToFirstMeeting() {
    const first = (coordinated ? thePlan.adjustments.length : thePlan.before.length) ? thePlan.before[0] : null;
    t = Math.max(0, (first?.start ?? 0) - 25);
}
async function main() {
    world = await loadWorld();
    for (const id of ["gap", "speedA", "speedB"])
        $(id).addEventListener("input", replan);
    $("coord").addEventListener("change", () => {
        coordinated = $("coord").checked;
        replan();
    });
    $("play").addEventListener("click", () => {
        playing = !playing;
        $("play").textContent = playing ? "Pause" : "Play";
    });
    $("jump").addEventListener("click", jumpToFirstMeeting);
    for (const b of document.querySelectorAll("[data-rate]"))
        b.addEventListener("click", () => {
            rate = Number(b.dataset.rate);
            for (const o of document.querySelectorAll("[data-rate]"))
                o.classList.toggle("on", o === b);
        });
    for (const b of document.querySelectorAll("[data-listen]"))
        b.addEventListener("click", () => {
            void ensureAudio().then(() => {
                const v = Number(b.dataset.listen);
                listenAs = listenAs === v ? null : v;
                for (const o of document.querySelectorAll("[data-listen]"))
                    o.classList.toggle("on", Number(o.dataset.listen) === listenAs);
                if (listenAs !== null) {
                    rate = 1;
                    for (const o of document.querySelectorAll("[data-rate]"))
                        o.classList.toggle("on", o.dataset.rate === "1");
                    if (!playing)
                        $("play").click();
                }
            });
        });
    $("timeline").addEventListener("click", (e) => {
        const c = $("timeline");
        const x = e.clientX - c.getBoundingClientRect().left;
        t = Math.max(0, win0 + ((x - 70) / (c.clientWidth - 80)) * WINDOW);
    });
    replan();
    jumpToFirstMeeting();
    requestAnimationFrame(frame);
}
main().catch((e) => {
    $("report").textContent = `Could not load the tour: ${String(e)}`;
});
