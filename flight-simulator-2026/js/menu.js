/* ============================================================
 * Menu — airline / aircraft selection + interactive world-map route picker.
 * ============================================================ */

/* Simplified continent outlines as [lon, lat] rings (equirectangular). */
const CONTINENTS = [
  // North America
  [[-168,66],[-160,71],[-140,70],[-120,72],[-95,73],[-82,73],[-64,60],[-56,52],[-66,49],[-64,45],[-65,41.2],[-70,38],[-75,36],[-80.4,32],[-81.3,30.4],[-80.1,25.1],[-81.8,24.5],[-82.8,27.6],[-84.2,30],[-90,29],[-97,26],[-107,24],[-117,32],[-124,40],[-124,48],[-133,54],[-145,60],[-160,60],[-168,66]],
  // Central America
  [[-106,23],[-99.1,19.5],[-97,16],[-92,15],[-88,16],[-83,9],[-78,8],[-80,13],[-86,16],[-92,18],[-99,19],[-106,23]],
  // South America
  [[-78,8],[-72,11],[-62,10],[-50,0],[-44,-2],[-35,-6],[-38,-13],[-48,-25],[-58,-35],[-66,-45],[-70,-53],[-74,-50],[-72,-42],[-71,-30],[-74,-18],[-78,-10],[-81,-4],[-80,3],[-78,8]],
  // Europe
  [[-10,44],[-9,39],[-2,37],[3,43],[10,44],[14,40],[19,42],[25,41],[28,45],[30,50],[27,55],[24,58],[30,62],[28,66],[22,66],[15,62],[8,60],[6,58],[8,54],[3,52],[-0.4,51.5],[-3.4,51.7],[-4.8,53.3],[-2.2,54.1],[0.8,53.1],[-2,49],[-6,50],[-10,48],[-10,44]],
  // Africa
  [[-16,15],[-16,21],[-10,28],[-4,32],[2,35],[10,37],[20,33],[26,32],[32,31],[35,24],[38,15],[43,12],[51,12],[48,2],[42,-4],[40,-12],[35,-20],[26,-34],[19,-35],[14,-28],[12,-17],[13,-6],[9,2],[2,4],[-8,4],[-13,9],[-16,15]],
  // Asia
  [[28,50],[38,48],[48,52],[60,54],[72,55],[85,58],[100,60],[115,58],[130,54],[143,58],[160,66],[170,68],[166,60],[153,53],[144,46],[139,42],[131,40],[123,40],[121,33],[118,25],[110,20],[105,10],[100,6],[95,12],[98,18],[90,22],[84,18],[80,10],[76,8],[73,18],[68,24],[60,25],[54,26],[48,30],[44,37],[40,44],[28,50]],
  // Japan
  [[130,31],[133,34],[137,35],[141,40],[143,44],[141,42],[137,37],[133,33],[130,31]],
  // Australia
  [[113,-22],[114,-30],[118,-34],[125,-33],[132,-32],[138,-35],[145,-38],[150,-37],[153,-30],[148,-24],[145,-16],[138,-12],[132,-11],[126,-14],[120,-19],[113,-22]],
  // New Zealand (North + South)
  [[172.6,-34.4],[174.8,-35.3],[175.9,-37.0],[178.5,-37.6],[178.0,-40.6],[175.3,-41.6],[174.5,-39.9],[172.8,-39.1],[172.6,-34.4]],
  [[172.6,-40.6],[174.3,-41.3],[173.2,-43.9],[170.4,-46.6],[166.5,-46.3],[166.5,-45.0],[169.3,-43.6],[172.5,-41.2],[172.6,-40.6]],
  // British Isles (keeps LHR / MAN on land)
  [[-5.7,50.0],[-5.0,51.7],[-4.8,53.4],[-3.4,54.6],[-1.8,55.8],[0.2,53.6],[1.8,52.8],[1.4,51.1],[-0.2,50.6],[-5.7,50.0]],
  [[-10.4,51.4],[-9.8,53.4],[-6.2,55.3],[-5.4,53.3],[-6.1,52.0],[-8.6,51.4],[-10.4,51.4]],
  // Italy (keeps FCO on the boot)
  [[8.4,44.1],[12.4,45.5],[13.7,45.6],[12.5,43.6],[15.6,38.2],[18.4,40.2],[16.6,38.8],[15.3,37.9],[12.5,37.5],[12.4,41.8],[10.2,42.8],[8.4,44.1]],
  // Korea (keeps ICN on the peninsula)
  [[124.4,38.2],[127.0,37.8],[129.5,37.6],[129.4,35.5],[128.9,34.7],[126.4,34.3],[125.0,36.6],[124.4,38.2]],
  // Denmark / Zealand (keeps CPH on land)
  [[8.1,54.9],[8.7,57.1],[10.6,57.7],[10.9,56.4],[9.5,55.4],[8.1,54.9]],
  [[11.0,54.8],[12.7,56.2],[12.8,55.5],[12.5,54.7],[11.0,54.8]],
  // Thailand (keeps BKK on land)
  [[98.0,15.8],[101.2,13.7],[101.0,12.5],[99.1,9.2],[98.2,12.0],[98.0,15.8]],
  // India (keeps DEL on the subcontinent)
  [[68.2,23.6],[72.8,21.0],[72.5,19.1],[72.9,16.0],[77.5,8.1],[80.3,10.2],[85.0,20.2],[88.1,22.0],[80.4,22.2],[77.4,28.9],[77.1,30.5],[74.6,27.2],[70.0,23.2],[68.2,23.6]],
  // Shanghai coast (keeps PVG on land)
  [[120.6,32.2],[122.3,31.5],[122.1,30.7],[120.8,31.0],[120.6,32.2]],
];

const SVG_NS = "http://www.w3.org/2000/svg";

class Menu {
  constructor(onStart) {
    this.onStart = onStart;
    this.selectedAircraft = AIRCRAFT_TYPES[2]; // A320 default
    this.selectedAirline = liveriesForAircraft(this.selectedAircraft)[0] || AIRLINES[0];

    this.from = AIRPORTS.find((a) => a.iata === "JFK") || AIRPORTS[0];
    this.to = AIRPORTS.find((a) => a.iata === "LHR") || AIRPORTS[1];
    this.dotEls = {};

    this.trainMode = "takeoff";
    this.zoom = null;

    this._buildAircraft();
    this._buildAirlines();
    this._buildMap();
    this._buildTraining();

    document.getElementById("start-btn").addEventListener("click", () => this._start());
    this._refreshMap();
  }

  /* ---- Training mode ---- */
  _buildTraining() {
    const select = document.getElementById("train-aircraft");
    select.innerHTML = "";
    AIRCRAFT_TYPES.forEach((t, i) => {
      select.appendChild(new Option(`${t.name} — ${t.class}`, i));
    });
    select.value = 2; // A320

    document.getElementById("training-btn").addEventListener("click", () => this._openTraining());
    document.getElementById("train-cancel").addEventListener("click", () => this._closeTraining());
    document.getElementById("train-start").addEventListener("click", () => this._startTraining());

    document.querySelectorAll("#train-mode .seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.trainMode = btn.dataset.mode;
        document.querySelectorAll("#train-mode .seg-btn").forEach((b) =>
          b.classList.toggle("active", b === btn));
      });
    });
  }

  _openTraining() { document.getElementById("training-modal").classList.remove("hidden"); }
  _closeTraining() { document.getElementById("training-modal").classList.add("hidden"); }

  _startTraining() {
    const idx = +document.getElementById("train-aircraft").value;
    this._closeTraining();
    this.onStart({
      airline: TRAINING_AIRLINE,
      aircraft: AIRCRAFT_TYPES[idx],
      from: TRAINING_AIRPORT,
      to: TRAINING_AIRPORT,
      training: true,
      trainingMode: this.trainMode,
    });
  }

  _buildAirlines() {
    const box = document.getElementById("airline-list");
    box.innerHTML = "";
    const liveries = liveriesForAircraft(this.selectedAircraft);
    if (!liveries.includes(this.selectedAirline)) {
      this.selectedAirline = liveries[0] || null;
    }
    if (!liveries.length) {
      box.innerHTML = `<div class="card"><span class="card-main"><span class="card-sub">No liveries for this type.</span></span></div>`;
      return;
    }
    liveries.forEach((a) => {
      const el = document.createElement("div");
      el.className = "card" + (a === this.selectedAirline ? " selected" : "");
      el.innerHTML = `
        <span class="swatch" style="background: linear-gradient(180deg, ${a.fuselage} 58%, ${a.tail} 58%); box-shadow: inset 0 0 0 2px ${a.accent}"></span>
        <span class="card-main">
          <span class="card-title">${a.name}</span>
          <span class="card-sub">${a.code} · ${this.selectedAircraft.name}</span>
        </span>`;
      el.addEventListener("click", () => {
        this.selectedAirline = a;
        this._buildAirlines();
      });
      box.appendChild(el);
    });
  }

  _buildAircraft() {
    const box = document.getElementById("aircraft-list");
    box.innerHTML = "";
    AIRCRAFT_TYPES.forEach((t) => {
      const n = liveriesForAircraft(t).length;
      const el = document.createElement("div");
      el.className = "card" + (t === this.selectedAircraft ? " selected" : "");
      el.innerHTML = `
        <span class="card-main">
          <span class="card-title">${t.name}</span>
          <span class="card-sub">${t.class} · V<sub>R</sub> ${t.vRotate} kt · ${n} ${n === 1 ? "livery" : "liveries"}</span>
        </span>`;
      el.addEventListener("click", () => {
        this.selectedAircraft = t;
        this._buildAircraft();
        this._buildAirlines();
      });
      box.appendChild(el);
    });
  }

  /* ---- World map ---- */
  _project(ap) { return { x: ap.lon + 180, y: 90 - ap.lat }; }      // to viewBox units
  _view() {
    return this.zoom || { lon0: -180, lon1: 180, lat0: -90, lat1: 90 };
  }
  _pct(ap) {
    const z = this._view();
    return {
      left: ((ap.lon - z.lon0) / (z.lon1 - z.lon0)) * 100,
      top: ((z.lat1 - ap.lat) / (z.lat1 - z.lat0)) * 100,
    };
  }
  _inView(ap) {
    const z = this._view();
    const padLon = (z.lon1 - z.lon0) * 0.02;
    const padLat = (z.lat1 - z.lat0) * 0.02;
    return ap.lon >= z.lon0 - padLon && ap.lon <= z.lon1 + padLon &&
           ap.lat >= z.lat0 - padLat && ap.lat <= z.lat1 + padLat;
  }

  _buildMap() {
    const svg = document.getElementById("world-map");
    svg.innerHTML = "";

    // Paint lives on the elements themselves — stylesheet `fill` does not
    // reach SVG geometry in every browser, and <polygon> can fail to render.
    const css = this._svgEl("style");
    css.textContent = [
      ".map-continent { fill: #3c8f5c; stroke: #6ec48a; stroke-width: 0.5; }",
      ".map-grid { stroke: rgba(255,255,255,0.16); stroke-width: 0.35; }",
      ".route-line { stroke: #38bdf8; stroke-width: 1.6; stroke-dasharray: 4 3; fill: none; }",
      ".ap-mark .ap-core { stroke: #0a1728; }",
      ".ap-mark.from .ap-core { fill: #22c55e; }",
      ".ap-mark.to .ap-core { fill: #ef4444; }",
      ".ap-mark:hover .ap-core { fill: #ffffff; }",
      ".ap-label { pointer-events: none; }",
    ].join(" ");
    svg.appendChild(css);

    // Graticule.
    for (let lon = -150; lon <= 150; lon += 30) {
      const x = lon + 180;
      svg.appendChild(this._svgEl("line", {
        x1: x, y1: 0, x2: x, y2: 180, class: "map-grid",
        stroke: "rgba(255,255,255,0.16)", "stroke-width": "0.35",
      }));
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = 90 - lat;
      svg.appendChild(this._svgEl("line", {
        x1: 0, y1: y, x2: 360, y2: y, class: "map-grid",
        stroke: "rgba(255,255,255,0.16)", "stroke-width": "0.35",
      }));
    }

    CONTINENTS.forEach((poly) => svg.appendChild(this._landPath(poly, (lon, lat) => ({
      x: lon + 180,
      y: 90 - lat,
    }))));

    // Route line (updated on selection).
    this.routeLine = this._svgEl("line", {
      class: "route-line hidden",
      stroke: "#38bdf8", "stroke-width": "1.6", "stroke-dasharray": "4 3", fill: "none",
    });
    svg.appendChild(this.routeLine);

    this._drawAirports();
    this._buildZoomBar();

    const wrap = document.getElementById("map-wrap");
    wrap.addEventListener("click", () => this._closePopup());
    const popup = document.getElementById("map-popup");
    popup.addEventListener("click", (e) => e.stopPropagation());
  }

  _drawAirports() {
    const svg = document.getElementById("world-map");
    svg.querySelectorAll(".ap-mark").forEach((n) => n.remove());
    this.dotEls = {};
    const z = this._view();
    const span = z.lon1 - z.lon0;
    const world = !this.zoom;
    const r = world ? 2.15 : Math.max(1.05, span * 0.011);
    const fs = Math.max(2.2, span * 0.01);
    const pts = AIRPORTS.filter((ap) => this._inView(ap)).map((ap) => ({
      ap, x: ap.lon + 180, y: 90 - ap.lat,
    }));
    // Only split pins whose dots actually cover each other (JFK/LGA).
    const minD = r * 2.15;
    for (let i = 0; i < pts.length; i++) {
      for (let j = 0; j < i; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < minD) {
          const push = (minD - d) * 0.5;
          pts[i].x += (dx / d) * push;
          pts[i].y += (dy / d) * push;
          pts[j].x -= (dx / d) * push;
          pts[j].y -= (dy / d) * push;
        }
      }
    }
    pts.forEach(({ ap, x, y }) => {
      const g = this._svgEl("g", { class: "ap-mark" });
      const hit = this._svgEl("circle", { cx: x, cy: y, r: r * 2.6, fill: "transparent" });
      const core = this._svgEl("circle", {
        cx: x, cy: y, r, class: "ap-core",
        fill: "#d7e6f5", stroke: "#0a1728", "stroke-width": String(r * 0.28),
      });
      g.appendChild(hit);
      g.appendChild(core);
      if (!world) {
        const label = this._svgEl("text", {
          x, y: y + r * 2.5, class: "ap-label",
          fill: "#eaf2ff", stroke: "#0b1220", "stroke-width": String(fs * 0.08),
          "text-anchor": "middle", "font-size": String(fs), "font-weight": "800",
          "paint-order": "stroke",
        });
        label.textContent = ap.iata;
        g.appendChild(label);
      }
      g.style.cursor = "pointer";
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        this._openPopup(ap, core);
      });
      svg.appendChild(g);
      this.dotEls[ap.iata] = { g, core };
    });
  }

  _buildZoomBar() {
    const bar = document.getElementById("map-zooms");
    if (!bar) return;
    bar.innerHTML = "";
    const add = (id, label, zoom) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zoom-btn" + ((zoom ? this.zoom && this.zoom.id === id : !this.zoom) ? " active" : "");
      btn.innerHTML = zoom ? `<span class="zoom-mag" aria-hidden="true"></span>${label}` : label;
      btn.addEventListener("click", () => {
        const same = zoom && this.zoom && this.zoom.id === zoom.id;
        this._setZoom(same ? null : zoom);
      });
      bar.appendChild(btn);
    };
    add("world", "World", null);
    MAP_ZOOMS.forEach((z) => add(z.id, z.short, z));
  }

  _setZoom(zoom) {
    this.zoom = zoom;
    this._closePopup();
    const svg = document.getElementById("world-map");
    if (!zoom) {
      svg.setAttribute("viewBox", "0 0 360 180");
    } else {
      svg.setAttribute("viewBox",
        `${zoom.lon0 + 180} ${90 - zoom.lat1} ${zoom.lon1 - zoom.lon0} ${zoom.lat1 - zoom.lat0}`);
    }
    this._drawAirports();
    this._buildZoomBar();
    this._refreshMap();
  }

  _svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) {
      if (k === "class") el.setAttribute("class", attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    return el;
  }

  _landPath(ring, project) {
    const d = ring.map(([lon, lat], i) => {
      const { x, y } = project(lon, lat);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ") + " Z";
    return this._svgEl("path", {
      d,
      class: "map-continent",
      fill: "#3c8f5c",
      stroke: "#6ec48a",
      "stroke-width": "0.5",
    });
  }

  _openPopup(ap, dot) {
    const popup = document.getElementById("map-popup");
    const isFrom = this.from === ap, isTo = this.to === ap;
    popup.innerHTML = `
      <div class="popup-title">${ap.iata} · ${ap.city}</div>
      <div class="popup-sub">${ap.name}${isFrom ? " · current takeoff" : isTo ? " · current landing" : ""}</div>
      <div class="popup-actions">
        <button class="pop-btn dep" data-act="dep">Set as Takeoff</button>
        <button class="pop-btn arr" data-act="arr">Set as Landing</button>
        <button class="pop-btn cam" data-act="freecam">Free Cam</button>
        <button class="pop-btn cancel" data-act="cancel">Cancel</button>
      </div>`;

    const wrap = document.getElementById("map-wrap");
    const wr = wrap.getBoundingClientRect();
    const dr = dot.getBoundingClientRect();
    const left = ((dr.left + dr.width / 2 - wr.left) / wr.width) * 100;
    const top = ((dr.top + dr.height / 2 - wr.top) / wr.height) * 100;
    popup.style.left = Math.min(86, Math.max(14, left)) + "%";
    popup.style.top = top + "%";
    popup.classList.toggle("below", top < 34);
    popup.classList.remove("hidden");

    popup.querySelectorAll(".pop-btn").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const act = b.dataset.act;
        if (act === "dep") this._setFrom(ap);
        else if (act === "arr") this._setTo(ap);
        else if (act === "freecam") this._startFreeCam(ap);
        this._closePopup();
      });
    });
  }

  _closePopup() { document.getElementById("map-popup").classList.add("hidden"); }

  _setFrom(ap) {
    if (this.to === ap) this.to = null; // can't depart and arrive at the same field
    this.from = ap;
    this._refreshMap();
  }

  _setTo(ap) {
    if (this.from === ap) this.from = null;
    this.to = ap;
    this._refreshMap();
  }

  _refreshMap() {
    for (const iata in this.dotEls) {
      const { g, core } = this.dotEls[iata];
      const isFrom = !!this.from && this.from.iata === iata;
      const isTo = !!this.to && this.to.iata === iata;
      g.classList.toggle("from", isFrom);
      g.classList.toggle("to", isTo);
      core.setAttribute("fill", isFrom ? "#22c55e" : isTo ? "#ef4444" : "#d7e6f5");
    }

    const line = this.routeLine;
    if (this.from && this.to) {
      const a = this._project(this.from), b = this._project(this.to);
      line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
      line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
      line.classList.remove("hidden");
    } else {
      line.classList.add("hidden");
    }

    this._updateRouteInfo();
  }

  _updateRouteInfo() {
    const info = document.getElementById("route-info");
    const btn = document.getElementById("start-btn");

    if (!this.from || !this.to) {
      const need = !this.from && !this.to ? "a takeoff and a landing airport"
        : !this.from ? "a takeoff airport" : "a landing airport";
      info.innerHTML = `<span style="color:#f59e0b">Click a dot to set ${need}.</span>`;
      btn.disabled = true;
      return;
    }

    btn.disabled = false;
    const km = Math.round(routeDistanceKm(this.from, this.to));
    info.innerHTML = `
      <b>${this.from.city}</b> (${this.from.iata}) → <b>${this.to.city}</b> (${this.to.iata})<br>
      Great-circle distance: <b>${km.toLocaleString()} km</b> ·
      Runways: ${this.from.runway} m / ${this.to.runway} m`;
  }

  _start() {
    if (!this.from || !this.to || this.from === this.to || !this.selectedAirline) return;
    this.onStart({
      airline: this.selectedAirline,
      aircraft: this.selectedAircraft,
      from: this.from,
      to: this.to,
    });
  }

  /* Spectator at a single field — no aircraft, pan the 2D camera, watch AI. */
  _startFreeCam(ap) {
    this.onStart({
      freeCam: true,
      from: ap,
      to: ap,
    });
  }
}
