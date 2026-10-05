// Sensor readout: the numbers a tester needs to tell "GPS is bad" from "the
// stop is 40 m away" from "you're facing the wrong way". Shown in
// test-anywhere mode and with ?hud=1.

import { compassWord } from "../core/geo.ts";
import type { ViewModel } from "../core/view.ts";

const fmt = (n: number | null | undefined, digits = 0, unit = ""): string =>
  n == null || Number.isNaN(n) ? "–" : `${n.toFixed(digits)}${unit}`;

export function renderHud(el: HTMLElement, v: ViewModel): void {
  const s = v.sensors;
  const next = s.next;
  const inside = next && next.distanceM != null && next.distanceM <= next.radiusM;
  const rows: [string, string, string?][] = [
    [
      "GPS",
      s.accuracyM == null ? "no fix" : `±${fmt(s.accuracyM)} m`,
      s.accuracyM != null && s.accuracyM <= 10 ? "ok" : "warn",
    ],
    [
      "Heading",
      s.headingDeg == null
        ? "no compass"
        : `${fmt(s.headingDeg)}° ${compassWord(s.headingDeg)}${s.headingSteady ? "" : " (unsteady)"}`,
      s.headingDeg == null ? "warn" : s.headingSteady ? "ok" : "warn",
    ],
    [
      "Moving",
      `${s.moving ? "walking" : s.still ? "still" : "stopping"} · ${fmt(s.speedMps, 1)} m/s · by ${s.stillSource === "motion" ? "footsteps" : "GPS"}`,
      s.still ? "ok" : undefined,
    ],
    [
      next ? `Stop ${next.order}` : "Next",
      next
        ? `${fmt(next.distanceM)} m ${next.bearingDeg == null ? "" : compassWord(next.bearingDeg)} · ${inside ? "INSIDE" : `circle ${next.radiusM} m`}`
        : "tour complete",
      inside ? "ok" : undefined,
    ],
    [
      "Facing",
      s.offTargetDeg == null ? "–" : `${s.facing ? "yes" : "no"} · off by ${fmt(Math.abs(s.offTargetDeg))}°`,
      s.facing ? "ok" : undefined,
    ],
    ["Scene", v.mode === "scene" ? `showing ${v.scene?.name ?? ""}` : "waiting", v.mode === "scene" ? "ok" : undefined],
  ];
  el.innerHTML = rows
    .map(([k, val, lvl]) => `<div class="hud-row ${lvl ?? ""}"><span>${k}</span><b>${val}</b></div>`)
    .join("");
}
