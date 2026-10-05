// Builds the framed scene for a stop. The window is square on purpose: Meta
// Ray-Ban Display is 600 x 600, and the phone shows the same square so what a
// partner sees on the phone is what the glasses get.
//
// 2.5D: a scene with `layers` stacks images by depth; the shell shifts them
// by how far the visitor's heading is off the landmark (setParallax), so the
// picture moves a little as they look around it.

import type { Scene, Stop } from "../core/types.ts";

const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

function body(scene: Scene): string {
  if (scene.layers?.length) {
    const layers = [...scene.layers]
      .sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0))
      .map(
        (l) =>
          `<img class="layer motion-${esc(l.motion ?? "none")}" src="${esc(l.src)}" alt="${esc(l.alt ?? "")}" style="--depth:${Number(l.depth ?? 0)}">`,
      )
      .join("");
    return `<div class="layers">${layers}</div>`;
  }
  if (scene.image) return `<img class="scene-img" src="${esc(scene.image)}" alt="">`;
  if (scene.kind === "timeline") {
    const items = (scene.timeline ?? [])
      .map((t) => `<li><span class="yr">${esc(t.year)}</span><span class="tx">${esc(t.text)}</span></li>`)
      .join("");
    return `<ol class="timeline">${items}</ol>`;
  }
  if (scene.kind === "quote") {
    return `<blockquote>${(scene.lines ?? []).map(esc).join("<br>")}</blockquote>
      <p class="attr">${esc(scene.attribution ?? "")}</p>`;
  }
  // "falls", "list" and anything else: a short labelled list
  return `<ul class="names">${(scene.lines ?? []).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

export function renderScene(el: HTMLElement, stop: Stop): void {
  const s = stop.scene;
  el.innerHTML = `
    <div class="scene-kicker">${esc(s.kicker ?? "")}</div>
    <h2 class="scene-title">${esc(s.title)}</h2>
    <div class="scene-body scene-${esc(s.kind)}">${body(s)}</div>
    ${s.placeholder && !s.image && !s.layers?.length ? `<div class="scene-todo">${esc(s.placeholder)}</div>` : ""}
    <div class="scene-flag">Prototype · content not yet reviewed</div>`;
}

/** Shift 2.5D layers by the heading error, degrees (+ = landmark is to the right). */
export function setParallax(el: HTMLElement, offTargetDeg: number | null): void {
  el.style.setProperty("--parallax", String(Math.max(-30, Math.min(30, -(offTargetDeg ?? 0)))));
}
