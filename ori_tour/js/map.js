// North-up route map drawn from real OpenStreetMap geometry (content/<tour>/map.json).

const C = {
  ground: "#16181c",
  park: "#1f2b24",
  water: "#1e5676",
  waterEdge: "#4e96ba",
  rock: "#5c4244",
  road: "#3a3e44",
  path: "#9d958a",
  steps: "#7d766d",
  building: "#55524c",
  historic: "#b89a6a",
  route: "#f5f3ee",
  next: "#ffbe5a",
  done: "#6f8f7c",
  you: "#60b0ff",
  ink: "#f5f3ee",
  subtle: "#a09e98",
};

export class RouteMap {
  constructor(canvas, map, tour) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.map = map;
    this.tour = tour;
    this.view = null;
    this.onTap = null;
    canvas.addEventListener("click", (e) => {
      if (!this.onTap || !this.view) return;
      const r = canvas.getBoundingClientRect();
      this.onTap(this.unproject(e.clientX - r.left, e.clientY - r.top));
    });
  }

  fit() {
    const pts = this.map.legs.flatMap((l) => l.line);
    let lat0 = Infinity, lat1 = -Infinity, lon0 = Infinity, lon1 = -Infinity;
    for (const [la, lo] of pts) {
      lat0 = Math.min(lat0, la); lat1 = Math.max(lat1, la);
      lon0 = Math.min(lon0, lo); lon1 = Math.max(lon1, lo);
    }
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = Math.cos(((lat0 + lat1) / 2) * (Math.PI / 180));
    const spanX = (lon1 - lon0) * k, spanY = lat1 - lat0;
    const pad = 26;
    const s = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
    this.view = { k, s, w, h, cLat: (lat0 + lat1) / 2, cLon: (lon0 + lon1) / 2 };
  }

  project(lat, lon) {
    const v = this.view;
    return [v.w / 2 + (lon - v.cLon) * v.k * v.s, v.h / 2 - (lat - v.cLat) * v.s];
  }

  unproject(x, y) {
    const v = this.view;
    return { lat: v.cLat - (y - v.h / 2) / v.s, lon: v.cLon + (x - v.w / 2) / (v.k * v.s) };
  }

  metres(m) {
    return (m / 110574) * this.view.s;
  }

  poly(rings, fill, stroke, width = 1, close = true) {
    const g = this.ctx;
    for (const ring of rings) {
      g.beginPath();
      ring.forEach(([la, lo], i) => {
        const [x, y] = this.project(la, lo);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      if (close) g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = width; g.stroke(); }
    }
  }

  draw(st) {
    if (!this.view) this.fit();
    const g = this.ctx, L = this.map.layers, v = this.view;
    g.fillStyle = C.ground;
    g.fillRect(0, 0, v.w, v.h);
    this.poly(L.park, C.park);
    this.poly(L.roads, null, C.road, 3, false);
    this.poly(L.water, C.water, C.waterEdge, 1);
    this.poly(L.rock, C.rock);
    this.poly(L.buildings, C.building);
    this.poly(L.historic, C.historic);
    this.poly(L.paths, null, C.path, 1.2, false);
    this.poly(L.steps, null, C.steps, 1, false);

    // the walking route, leg by leg
    g.lineCap = g.lineJoin = "round";
    this.map.legs.forEach((leg, i) => {
      const isNext = i === st.legIndex;
      const done = i < st.legIndex;
      g.setLineDash(isNext ? [] : [5, 5]);
      this.poly([leg.line], null, done ? C.done : isNext ? C.next : C.route, isNext ? 3.5 : 2, false);
    });
    g.setLineDash([]);

    // stops: geofence, facing line, number
    for (const s of this.tour.stops) {
      const [x, y] = this.project(s.position.lat, s.position.lon);
      const [tx, ty] = this.project(s.facing.target.lat, s.facing.target.lon);
      const visited = st.visited.has(s.id);
      const col = visited ? C.done : s.id === st.nextId ? C.next : C.route;
      g.beginPath();
      g.arc(x, y, this.metres(s.radius_m), 0, Math.PI * 2);
      g.fillStyle = col + "22";
      g.fill();
      g.strokeStyle = col + "88";
      g.lineWidth = 1;
      g.stroke();
      g.setLineDash([2, 3]);
      g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke();
      g.setLineDash([]);
      g.beginPath(); g.arc(tx, ty, 3, 0, Math.PI * 2); g.fillStyle = col; g.fill();
      g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fillStyle = col; g.fill();
      g.fillStyle = C.ground;
      g.font = "700 11px Inter, system-ui, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(visited ? "✓" : String(s.order), x, y + 0.5);
    }
    const sp = this.tour.start.position;
    const [sx, sy] = this.project(sp.lat, sp.lon);
    g.fillStyle = C.subtle;
    g.font = "600 10px Inter, system-ui, sans-serif";
    g.textAlign = "left";
    g.fillText("START", sx + 8, sy);

    // you
    if (st.pos) {
      const [x, y] = this.project(st.pos.lat, st.pos.lon);
      if (st.accuracy) {
        g.beginPath(); g.arc(x, y, Math.max(6, this.metres(st.accuracy)), 0, Math.PI * 2);
        g.fillStyle = C.you + "22"; g.fill();
      }
      if (st.heading != null) {
        const a = ((st.heading - 90) * Math.PI) / 180, w = (28 * Math.PI) / 180;
        g.beginPath(); g.moveTo(x, y);
        g.arc(x, y, 30, a - w, a + w); g.closePath();
        g.fillStyle = C.you + "66"; g.fill();
      }
      g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2);
      g.fillStyle = C.you; g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
    }

    // north arrow + attribution
    g.fillStyle = C.subtle;
    g.font = "600 10px Inter, system-ui, sans-serif";
    g.textAlign = "right";
    g.fillText("N ↑", v.w - 8, 14);
    g.font = "9px Inter, system-ui, sans-serif";
    g.fillText("© OpenStreetMap contributors", v.w - 6, v.h - 6);
  }
}
