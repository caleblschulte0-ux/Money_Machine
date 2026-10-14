// Group audio: each tour group hears only its own story, even when groups
// pass each other or share a stop. Caleb's idea (patent workshop, 2026-10-09;
// ori/entity/patent/group-audio-specification.md, Part A).
//
// Glasses play narration through open-ear speakers, so a group's narration
// leaks to anyone within a few metres. Two groups playing DIFFERENT narration
// cannot be fixed by clock sync; they must not speak at the same time while
// they are close. The system knows every group's route, walking speed and
// script ahead of time, so it can:
//
//   1. predict ENCOUNTERS: intervals where two groups will be within the
//      interference distance (an overtake, a head-on pass, a shared stop);
//   2. find CONFLICTS: encounter time in which both groups would be speaking;
//   3. PLAN the cheapest set of adjustments at the scripts' FLEX POINTS
//      (hold a pause with a silent "look at this" prompt, or skip a sentence
//      marked optional) so that no conflict remains. What no plan can clear
//      is handed to the devices as a DUCK interval (lower output, captions).
//
// Inside one group, every device plays the same timeline from a shared clock
// (estimateOffset, playheadAt, catchUp), so the plan applies to the whole
// group at once and members hear one voice.
//
// Pure and platform-free: positions are metres on a local flat plane, times
// are seconds on the shared tour clock. The web port only draws it.
const FLEX_DEFAULTS = { holdBeforeS: 45, holdBetweenS: 10, prompt: "Take a look around" };
/**
 * A segment from a narration's caption cues: one span per sentence, the first
 * sentence key, nothing optional (only an author may mark a sentence
 * optional), and a flex point before the first sentence and between each.
 */
export function segmentFromCues(id, cues, o = {}) {
    const d = { ...FLEX_DEFAULTS, ...o };
    const speech = cues.map((c, i) => ({ start: c.start, end: c.end, key: i === 0, optional: false }));
    const flex = cues.map((c, i) => ({
        at: c.start,
        maxHoldS: i === 0 ? d.holdBeforeS : d.holdBetweenS,
        prompt: d.prompt,
    }));
    return { id, durationS: cues.length ? cues[cues.length - 1].end : 0, speech, flex };
}
// ---------------------------------------------------------------- route and groups
/** A walking route: a polyline in metres. */
export class Route {
    points;
    cum;
    constructor(points) {
        if (points.length < 2)
            throw new Error("a route needs two points");
        this.points = points;
        this.cum = [0];
        for (let i = 1; i < points.length; i++)
            this.cum.push(this.cum[i - 1] + dist(points[i - 1], points[i]));
    }
    get length() {
        return this.cum[this.cum.length - 1];
    }
    /** The point `s` metres along the route (clamped to its ends). */
    at(s) {
        const L = this.length;
        const t = Math.min(Math.max(s, 0), L);
        let i = 1;
        while (i < this.cum.length - 1 && this.cum[i] < t)
            i++;
        const a = this.points[i - 1];
        const b = this.points[i];
        const seg = this.cum[i] - this.cum[i - 1];
        const k = seg > 0 ? (t - this.cum[i - 1]) / seg : 0;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    /** How far along the route the point nearest to `p` is. */
    project(p) {
        let best = Infinity;
        let bestS = 0;
        for (let i = 1; i < this.points.length; i++) {
            const a = this.points[i - 1];
            const b = this.points[i];
            const abx = b.x - a.x;
            const aby = b.y - a.y;
            const len2 = abx * abx + aby * aby;
            const k = len2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2)) : 0;
            const q = { x: a.x + abx * k, y: a.y + aby * k };
            const d = dist(p, q);
            if (d < best) {
                best = d;
                bestS = this.cum[i - 1] + Math.sqrt(len2) * k;
            }
        }
        return bestS;
    }
}
const adjKey = (group, segment, at) => `${group}|${segment}|${at.toFixed(3)}`;
/** The schedule of `g` with `adj` applied. */
export function schedule(g, adj = []) {
    const holds = new Map();
    const skips = new Set();
    for (const a of adj) {
        if (a.group !== g.id)
            continue;
        const k = adjKey(a.group, a.segment, a.at);
        if (a.action === "hold")
            holds.set(k, (holds.get(k) ?? 0) + a.seconds);
        else
            skips.add(`${a.segment}|${a.prompt}`);
    }
    const pieces = [];
    const speech = [];
    const narrations = [];
    let t = g.startAt;
    let s = g.startS;
    for (const stop of g.stops) {
        if (stop.routeS < s - 1e-6)
            continue; // already past it
        const walk = (stop.routeS - s) / g.speedMps;
        if (walk > 0)
            pieces.push({ t0: t, t1: t + walk, s0: s, s1: stop.routeS });
        t += walk;
        s = stop.routeS;
        const arrive = t;
        t += stop.settleS;
        // play the segment: content time c runs at 1x, holds insert time, skips remove it
        const seg = stop.segment;
        const start = t;
        const flexAt = [];
        let c = 0;
        const flexes = [...seg.flex].sort((a, b) => a.at - b.at);
        let fi = 0;
        for (let si = 0; si < seg.speech.length; si++) {
            const sp = seg.speech[si];
            // flex points up to this sentence's start
            while (fi < flexes.length && flexes[fi].at <= sp.start + 1e-9) {
                const f = flexes[fi];
                t += Math.max(0, f.at - c);
                c = Math.max(c, f.at);
                const held = holds.get(adjKey(g.id, seg.id, f.at)) ?? 0;
                flexAt.push({ flex: f, t, held });
                t += held;
                fi++;
            }
            t += Math.max(0, sp.start - c);
            c = Math.max(c, sp.start);
            if (skips.has(`${seg.id}|${si}`) && sp.optional && !sp.key) {
                c = sp.end;
                continue;
            }
            speech.push({ start: t, end: t + (sp.end - sp.start), segment: seg.id, span: si });
            t += sp.end - sp.start;
            c = sp.end;
        }
        t += Math.max(0, seg.durationS - c);
        narrations.push({ stopId: stop.stopId, segment: seg, start, end: t, flexAt });
        t += stop.lingerS;
        pieces.push({ t0: arrive, t1: t, s0: s, s1: s });
    }
    // then walks on to the route's end, and waits there
    const rest = (g.route.length - s) / g.speedMps;
    if (rest > 0)
        pieces.push({ t0: t, t1: t + rest, s0: s, s1: g.route.length });
    t += Math.max(0, rest);
    s = Math.max(s, g.route.length);
    pieces.push({ t0: t, t1: Infinity, s0: s, s1: s });
    return { group: g, pieces, speech, narrations, endAt: t };
}
/** Where the group's centre is at time `t`. Before it sets off it is at its start. */
export function positionAt(sc, t) {
    const g = sc.group;
    if (t <= (sc.pieces[0]?.t0 ?? g.startAt))
        return g.route.at(g.startS);
    for (const p of sc.pieces) {
        if (t <= p.t1) {
            const k = p.t1 > p.t0 && Number.isFinite(p.t1) ? (t - p.t0) / (p.t1 - p.t0) : 1;
            return g.route.at(p.s0 + (p.s1 - p.s0) * Math.min(1, Math.max(0, k)));
        }
    }
    return g.route.at(sc.pieces[sc.pieces.length - 1].s1);
}
/** Whether the group is moving at `t`. */
export function walkingAt(sc, t) {
    return sc.pieces.some((p) => p.s1 !== p.s0 && t >= p.t0 && t < p.t1);
}
export const speakingAt = (sc, t) => sc.speech.some((i) => t >= i.start && t < i.end);
export const COORDINATION_DEFAULTS = {
    now: 0,
    horizonS: 300,
    interferenceM: 8,
    stepS: 0.25,
    maxAdjustments: 12,
};
function intervals(from, to, step, test) {
    const out = [];
    let open = null;
    for (let t = from; t <= to + 1e-9; t += step) {
        const on = test(t);
        if (on && open === null)
            open = t;
        if (!on && open !== null) {
            out.push({ start: open, end: t });
            open = null;
        }
    }
    if (open !== null)
        out.push({ start: open, end: to });
    return out;
}
/** On the tour: set off and not yet finished (a group waiting to start, or done, is not there). */
export const onTourAt = (sc, t) => t >= sc.group.startAt && t <= sc.endAt;
const near = (a, b, t, m) => onTourAt(a, t) && onTourAt(b, t) && dist(positionAt(a, t), positionAt(b, t)) <= m + a.group.spreadM + b.group.spreadM;
/** Every interval in the horizon in which two groups will be close enough to hear each other. */
export function encounters(scheds, o = {}) {
    const c = { ...COORDINATION_DEFAULTS, ...o };
    const out = [];
    for (let i = 0; i < scheds.length; i++)
        for (let j = i + 1; j < scheds.length; j++) {
            const A = scheds[i];
            const B = scheds[j];
            for (const iv of intervals(c.now, c.now + c.horizonS, c.stepS, (t) => near(A, B, t, c.interferenceM))) {
                let closest = Infinity;
                for (let t = iv.start; t <= iv.end; t += c.stepS)
                    closest = Math.min(closest, dist(positionAt(A, t), positionAt(B, t)));
                out.push({ ...iv, a: A.group.id, b: B.group.id, kind: kindOf(A, B, iv), closestM: closest });
            }
        }
    return out.sort((x, y) => x.start - y.start);
}
function kindOf(A, B, iv) {
    const mid = (iv.start + iv.end) / 2;
    const wa = walkingAt(A, mid);
    const wb = walkingAt(B, mid);
    if (!wa && !wb)
        return "shared-stop";
    if (wa && wb) {
        const da = sub(positionAt(A, mid + 1), positionAt(A, mid));
        const db = sub(positionAt(B, mid + 1), positionAt(B, mid));
        const dot = da.x * db.x + da.y * db.y;
        return dot > 0 ? "overtake" : "head-on";
    }
    return "crossing";
}
/** Encounter time in which both groups would be speaking: what the plan must clear. */
export function conflicts(scheds, o = {}) {
    const c = { ...COORDINATION_DEFAULTS, ...o };
    const out = [];
    for (let i = 0; i < scheds.length; i++)
        for (let j = i + 1; j < scheds.length; j++) {
            const A = scheds[i];
            const B = scheds[j];
            for (const iv of intervals(c.now, c.now + c.horizonS, c.stepS, (t) => speakingAt(A, t) && speakingAt(B, t) && near(A, B, t, c.interferenceM)))
                out.push({ ...iv, a: A.group.id, b: B.group.id });
        }
    return out.sort((x, y) => x.start - y.start || x.a.localeCompare(y.a));
}
const costOf = (a) => (a.action === "hold" ? a.seconds : a.seconds * 2);
/**
 * The cheapest adjustments (greedy, earliest conflict first) that clear the
 * groups' speech overlap while close. Each step tries every flex point at or
 * after `now` and before the conflict, in either group, and the smallest hold
 * there (or an optional sentence to skip) that clears that conflict without
 * creating an earlier one; the lowest cost wins (ties: the later-starting
 * group, then the id). Holds also delay a group's walking on, so every step
 * re-predicts from scratch.
 */
export function plan(groups, o = {}) {
    const c = { ...COORDINATION_DEFAULTS, ...o };
    const adj = [];
    const run = (extra) => conflicts(groups.map((g) => schedule(g, extra)), c);
    const before = run([]);
    let current = before;
    const ducks = [];
    while (current.length && adj.length < c.maxAdjustments) {
        const target = current[0];
        let best = null;
        for (const gid of [target.a, target.b]) {
            const g = groups.find((x) => x.id === gid);
            const sc = schedule(g, adj);
            const order = sc.narrations.find((n) => n.end > target.start)?.start ?? 0;
            for (const n of sc.narrations)
                for (const f of n.flexAt) {
                    if (f.t < c.now - 1e-9 || f.t > target.start + 1e-9)
                        continue;
                    const room = f.flex.maxHoldS - f.held;
                    for (let d = c.stepS * 2; d <= room + 1e-9; d += c.stepS * 2) {
                        if (best && d >= best.cost)
                            break;
                        const a = {
                            group: gid,
                            segment: n.segment.id,
                            at: f.flex.at,
                            action: "hold",
                            seconds: d,
                            prompt: f.flex.prompt,
                        };
                        if (clears(run([...adj, a]), target)) {
                            const cost = costOf(a);
                            if (!best || cost < best.cost || (cost === best.cost && order > best.order))
                                best = { a, cost, order };
                            break;
                        }
                    }
                }
            // an optional sentence still ahead that overlaps the conflict
            for (const sp of sc.speech) {
                if (sp.start < c.now || sp.start > target.end)
                    continue;
                const seg = sc.narrations.find((n) => n.segment.id === sp.segment).segment;
                const span = seg.speech[sp.span];
                if (!span.optional || span.key)
                    continue;
                const a = {
                    group: gid,
                    segment: seg.id,
                    at: span.start,
                    action: "skip",
                    seconds: span.end - span.start,
                    prompt: String(sp.span),
                };
                const cost = costOf(a);
                if ((!best || cost < best.cost) && clears(run([...adj, a]), target))
                    best = { a, cost, order };
            }
        }
        if (!best) {
            ducks.push(target);
            // move on: plan around the next conflict that is not this one
            current = current.filter((x) => !(x.a === target.a && x.b === target.b && x.start === target.start));
            continue;
        }
        adj.push(best.a);
        current = run(adj).filter((x) => !ducks.some((d) => d.a === x.a && d.b === x.b && overlaps(d, x)));
    }
    ducks.push(...current);
    // greedy can over-hold: shorten (or drop) each hold while the result stays as clear
    const overlapS = (cs) => cs.reduce((t, x) => t + x.end - x.start, 0);
    const remaining = overlapS(run(adj));
    for (const a of adj) {
        if (a.action !== "hold")
            continue;
        while (a.seconds > 0) {
            const was = a.seconds;
            a.seconds = Math.max(0, +(a.seconds - c.stepS * 2).toFixed(6));
            if (overlapS(run(adj)) > remaining + 1e-9) {
                a.seconds = was;
                break;
            }
        }
    }
    for (let i = adj.length - 1; i >= 0; i--)
        if (adj[i].action === "hold" && adj[i].seconds === 0)
            adj.splice(i, 1);
    const addedS = adj.filter((a) => a.action === "hold").reduce((s, a) => s + a.seconds, 0);
    return { adjustments: merge(adj), ducks, before, addedS };
}
/** The conflict is gone, and nothing new starts before it did. */
function clears(after, target) {
    return !after.some((x) => (x.a === target.a && x.b === target.b && overlaps(x, target)) || x.start < target.start - 1e-9);
}
const overlaps = (x, y) => x.start < y.end && y.start < x.end;
/** Holds at the same flex point add up into one entry. */
function merge(adj) {
    const out = [];
    for (const a of adj) {
        const same = out.find((b) => b.action === "hold" && a.action === "hold" && b.group === a.group && b.segment === a.segment && b.at === a.at);
        if (same)
            same.seconds += a.seconds;
        else
            out.push({ ...a });
    }
    return out;
}
/** The narration position at shared-clock time `t`, or null when no narration is playing. */
export function playheadAt(sc, t) {
    const n = sc.narrations.find((x) => t >= x.start && t < x.end);
    if (!n)
        return null;
    // walk the content timeline with its holds
    let wall = n.start;
    let c = 0;
    for (const f of n.flexAt) {
        const reach = f.t; // wall time the flex point is reached
        if (t < reach)
            return { stopId: n.stopId, segment: n.segment.id, contentS: c + (t - wall), holding: null };
        c = f.flex.at;
        if (t < reach + f.held)
            return { stopId: n.stopId, segment: n.segment.id, contentS: c, holding: f.flex.prompt };
        wall = reach + f.held;
    }
    return {
        stopId: n.stopId,
        segment: n.segment.id,
        contentS: Math.min(n.segment.durationS, c + (t - wall)),
        holding: null,
    };
}
/**
 * The offset to add to this device's clock to get the group's reference
 * clock, from the exchange with the shortest round trip (the least delayed by
 * radio queues). Standard NTP-style estimate; known art, used, not claimed.
 */
export function estimateOffset(samples) {
    let best = null;
    for (const s of samples) {
        const rtt = s.receivedMs - s.sentMs;
        if (rtt < 0)
            continue;
        const offset = s.refMs - (s.sentMs + rtt / 2);
        if (!best || rtt < best.rttMs)
            best = { offsetMs: offset, rttMs: rtt };
    }
    return best;
}
/**
 * How a device closes the gap between where it is playing and where the
 * group is: a small rate change (inaudible, at most `maxRate` either way)
 * over `overS`, or a jump when it is too far out for that.
 */
export function catchUp(localS, groupS, o = {}) {
    const maxRate = o.maxRate ?? 0.03;
    const overS = o.overS ?? 2;
    const jump = o.jumpAboveS ?? 0.25;
    const gap = groupS - localS;
    if (Math.abs(gap) > jump)
        return { rate: 1, seekTo: groupS };
    const rate = 1 + Math.max(-maxRate, Math.min(maxRate, gap / overS));
    return { rate, seekTo: null };
}
// ---------------------------------------------------------------- from a tour package
/** Metres east (x) and north (y) of `origin`; flat-earth, fine across a park. */
export function toLocal(origin, p) {
    const R = 6371008.8;
    const rad = Math.PI / 180;
    return { x: (p.lon - origin.lon) * rad * R * Math.cos(origin.lat * rad), y: (p.lat - origin.lat) * rad * R };
}
/**
 * The tour's walking route (its map legs end to end, in local metres from the
 * first point) and where each stop lies along it.
 */
export function tourRoute(map, stops) {
    const line = map.legs.flatMap((l, i) => (i === 0 ? l.line : l.line.slice(1)));
    if (line.length < 2)
        throw new Error("the map has no legs to walk");
    const origin = { lat: line[0][0], lon: line[0][1] };
    const route = new Route(line.map(([lat, lon]) => toLocal(origin, { lat, lon })));
    const stopS = new Map();
    let from = 0;
    for (const s of [...stops].sort((a, b) => a.order - b.order)) {
        // the nearest point along the route at or after the previous stop
        const at = route.project(toLocal(origin, s.position));
        from = Math.max(from, at);
        stopS.set(s.id, from);
    }
    return { route, origin, stopS };
}
// ---------------------------------------------------------------- small vector helpers
function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
function sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}
