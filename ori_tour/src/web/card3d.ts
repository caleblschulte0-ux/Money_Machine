// Draws a SceneCardView (src/core/scenecard.ts) into a three.js scene: the
// stop's scene as a panel standing in the world. The words and the pose come
// from the core; this file only paints them on a canvas, in the tour's look
// (css/tour.css), and puts the canvas on a plane.

import * as THREE from "three";

import type { SceneCard, SceneCardView } from "../core/scenecard.ts";

const W = 1024;
const PAD = 64;
const C = {
  panel: "rgba(20, 22, 26, 0.86)",
  ink: "#f5f3ee",
  subtle: "#a09e98",
  accent: "#ffbe5a",
  line: "rgba(255,255,255,0.14)",
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

interface Op {
  font: string;
  color: string;
  x: number;
  lines: string[];
  lh: number;
  /** text drawn in the lead column of this row (a year) */
  lead?: string;
  rule?: boolean;
  bar?: boolean;
}

/** Lay the card out on a canvas; returns the canvas, sized to its content. */
export function paintCard(card: SceneCard): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const inner = W - 2 * PAD;
  const ops: Op[] = [];
  const measure = (font: string, text: string, width: number): string[] => {
    ctx.font = font;
    return wrap(ctx, text, width);
  };
  const kicker = `700 30px ${FONT}`;
  const title = `800 68px ${FONT}`;
  const body = `500 44px ${FONT}`;
  const quote = `500 50px ${FONT}`;
  const small = `500 28px ${FONT}`;
  if (card.kicker) ops.push({ font: kicker, color: C.accent, x: PAD, lines: [card.kicker.toUpperCase()], lh: 44 });
  ops.push({ font: title, color: C.ink, x: PAD, lines: measure(title, card.title, inner), lh: 78 });
  const leadW = card.rows.some((r) => r.lead) ? 150 : 0;
  card.rows.forEach((r, n) => {
    if (card.style === "quote")
      ops.push({
        font: quote,
        color: C.ink,
        x: PAD + 34,
        lines: measure(quote, r.text, inner - 34),
        lh: 64,
        bar: true,
      });
    else
      ops.push({
        font: body,
        color: C.ink,
        x: PAD + leadW,
        lines: measure(body, r.text, inner - leadW),
        lh: 58,
        lead: r.lead ?? undefined,
        rule: n > 0 && !leadW,
      });
  });
  if (card.credit)
    ops.push({ font: small, color: C.subtle, x: PAD, lines: measure(small, card.credit, inner), lh: 38 });
  ops.push({ font: small, color: C.subtle, x: PAD, lines: [card.flag], lh: 38 });

  const GAP = 22;
  const height = PAD * 2 + ops.reduce((h, o) => h + o.lines.length * o.lh + GAP, -GAP);
  canvas.width = W;
  canvas.height = Math.ceil(height);
  ctx.fillStyle = C.panel;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, canvas.height, 40);
  ctx.fill();
  ctx.fillStyle = C.accent;
  ctx.fillRect(0, 36, 8, canvas.height - 72);
  ctx.textBaseline = "top";
  let y = PAD;
  for (const o of ops) {
    const h = o.lines.length * o.lh;
    if (o.rule) {
      ctx.fillStyle = C.line;
      ctx.fillRect(PAD, y - GAP / 2 - 1, inner, 2);
    }
    if (o.bar) {
      ctx.fillStyle = C.accent;
      ctx.fillRect(PAD, y + 6, 6, h - 12);
    }
    if (o.lead) {
      ctx.font = `800 44px ${FONT}`;
      ctx.fillStyle = C.accent;
      ctx.fillText(o.lead, PAD, y);
    }
    ctx.font = o.font;
    ctx.fillStyle = o.color;
    o.lines.forEach((l, k) => ctx.fillText(l, o.x, y + k * o.lh));
    y += h + GAP;
  }
  return canvas;
}

/** The scene card of the current stop in a three.js scene: made when it first appears, moved every frame. */
export class CardLayer {
  private readonly scene: THREE.Scene;
  private node: { stopId: string; mesh: THREE.Mesh } | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  draw(v: SceneCardView | null): void {
    if (this.node && this.node.stopId !== v?.card.stopId) this.clear();
    if (!v) return;
    if (!this.node) {
      const canvas = paintCard(v.card);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const h = (v.widthM * canvas.height) / canvas.width;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(v.widthM, h),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }),
      );
      mesh.name = "scene card";
      mesh.renderOrder = 10;
      this.scene.add(mesh);
      this.node = { stopId: v.card.stopId, mesh };
    }
    const { position: p, orientation: q } = v.pose;
    this.node.mesh.visible = v.visible;
    this.node.mesh.position.set(p.x, p.y, p.z);
    this.node.mesh.quaternion.set(q.x, q.y, q.z, q.w);
  }

  clear(): void {
    if (!this.node) return;
    const m = this.node.mesh;
    this.scene.remove(m);
    m.geometry.dispose();
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.dispose();
    this.node = null;
  }
}
