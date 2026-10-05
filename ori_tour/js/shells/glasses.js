// Glasses shell: a 600x600 additive display (Meta Ray-Ban Display). Black is
// see-through, so there is no backdrop, no map and no chrome: only the scene,
// one line of guidance, and captions. Controls on glasses come from the
// device (a tap or the wristband), so the only control here is a tap anywhere
// for the staff override.

import { renderScene } from "../ui/scene.js";
import { guidance } from "./runtime.js";

const $ = (id) => document.getElementById(id);

export function mountGlasses(rt) {
  document.body.classList.add("glasses");
  const st = rt.st;

  function render() {
    const lens = $("lens"), guide = $("guide");
    if (st.showing) {
      if (lens.dataset.stop !== st.showing.id) {
        renderScene(lens, st.showing);
        lens.dataset.stop = st.showing.id;
      }
      lens.hidden = false;
      guide.hidden = true;
    } else {
      lens.hidden = true;
      lens.dataset.stop = "";
      guide.hidden = false;
      const g = guidance(rt, { hasMap: false });
      guide.innerHTML = `${g.arrow == null ? "" : `<div class="arrow" style="transform:rotate(${g.arrow}deg)">↑</div>`}
        <div class="big">${g.big}</div><div class="small">${g.small}</div>`;
    }
  }

  rt.on((e) => {
    if (e.type === "render" || e.type === "stop-done") render();
    if (e.type === "caption") {
      $("caption").textContent = e.text;
      $("caption").hidden = !e.text;
    }
  });

  // tap: show the scene here (staff override when GPS or the compass is bad)
  $("view").addEventListener("click", () => { if (!st.showing) rt.force(); });

  return { render, afterStart() {} };
}
