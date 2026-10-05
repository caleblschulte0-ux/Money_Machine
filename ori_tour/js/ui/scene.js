// Builds the framed scene for a stop from the content package. The window is
// square on purpose: Meta Ray-Ban Display is 600 x 600, and the phone shows
// the same square so what a partner sees on the phone is what the glasses get.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function body(scene) {
  if (scene.image) {
    return `<img class="scene-img" src="${esc(scene.image)}" alt="">`;
  }
  if (scene.kind === "timeline") {
    const items = scene.timeline
      .map((t) => `<li><span class="yr">${esc(t.year)}</span><span class="tx">${esc(t.text)}</span></li>`)
      .join("");
    return `<ol class="timeline">${items}</ol>`;
  }
  if (scene.kind === "quote") {
    return `<blockquote>${scene.lines.map(esc).join("<br>")}</blockquote>
      <p class="attr">${esc(scene.attribution || "")}</p>`;
  }
  // "falls" and anything else: a short labelled list
  return `<ul class="names">${scene.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

export function renderScene(el, stop) {
  const s = stop.scene;
  el.innerHTML = `
    <div class="scene-kicker">${esc(s.kicker || "")}</div>
    <h2 class="scene-title">${esc(s.title)}</h2>
    <div class="scene-body scene-${esc(s.kind)}">${body(s)}</div>
    ${s.placeholder && !s.image ? `<div class="scene-todo">${esc(s.placeholder)}</div>` : ""}
    <div class="scene-flag">Prototype · content not yet reviewed</div>`;
}
