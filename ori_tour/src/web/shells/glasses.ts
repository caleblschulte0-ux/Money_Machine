// Glasses shell: a Display for a 600x600 additive screen (Meta Ray-Ban
// Display). Black is see-through, so there is no backdrop, no map and no
// chrome: only the scene, one guidance line and captions. Input on glasses
// comes from the device (a tap, the wristband); here a tap anywhere is the
// staff override.

import type { Display } from "../../core/ports.ts";
import type { TourSession } from "../../core/session.ts";
import type { ViewModel } from "../../core/view.ts";
import { renderScene, setParallax } from "../scene.ts";

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el;
};

export class GlassesDisplay implements Display {
  /** The sensor readout lives on the phone; the glasses keep to scene, guide and caption. */
  hud = false;

  constructor() {
    document.body.classList.add("glasses");
  }

  bind(session: TourSession): void {
    $("view").addEventListener("click", () => {
      if (!session.engine.state.showing) session.force();
    });
  }

  render(v: ViewModel): void {
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
    } else {
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
  }

  // Transient messages are not drawn: on an additive display they are clutter.
  notify(): void {}
}
