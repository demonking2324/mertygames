/* ============================================================
 * Menu — airline / aircraft selection + interactive world-map route picker.
 * ============================================================ */

/* Simplified continent outlines as [lon, lat] rings (equirectangular). */
const CONTINENTS = [
  // North America
  [[-168,66],[-160,71],[-140,70],[-120,72],[-95,73],[-82,73],[-64,60],[-56,52],[-66,49],[-70,43],[-75,36],[-81,26],[-90,29],[-97,26],[-107,24],[-117,32],[-124,40],[-124,48],[-133,54],[-145,60],[-160,60],[-168,66]],
  // Central America
  [[-106,23],[-97,16],[-92,15],[-88,16],[-83,9],[-78,8],[-80,13],[-86,16],[-92,18],[-99,19],[-106,23]],
  // South America
  [[-78,8],[-72,11],[-62,10],[-50,0],[-44,-2],[-35,-6],[-38,-13],[-48,-25],[-58,-35],[-66,-45],[-70,-53],[-74,-50],[-72,-42],[-71,-30],[-74,-18],[-78,-10],[-81,-4],[-80,3],[-78,8]],
  // Europe
  [[-10,44],[-9,39],[-2,37],[3,43],[10,44],[14,40],[19,42],[25,41],[28,45],[30,50],[27,55],[24,58],[30,62],[28,66],[22,66],[15,62],[8,60],[6,58],[8,54],[3,52],[-2,49],[-6,50],[-10,48],[-10,44]],
  // Africa
  [[-16,15],[-16,21],[-10,28],[-4,32],[2,35],[10,37],[20,33],[26,32],[32,31],[35,24],[38,15],[43,12],[51,12],[48,2],[42,-4],[40,-12],[35,-20],[26,-34],[19,-35],[14,-28],[12,-17],[13,-6],[9,2],[2,4],[-8,4],[-13,9],[-16,15]],
  // Asia
  [[28,50],[38,48],[48,52],[60,54],[72,55],[85,58],[100,60],[115,58],[130,54],[143,58],[160,66],[170,68],[166,60],[153,53],[144,46],[139,42],[131,40],[123,40],[121,33],[118,25],[110,20],[105,10],[100,6],[95,12],[98,18],[90,22],[84,18],[80,10],[76,8],[73,18],[68,24],[60,25],[54,26],[48,30],[44,37],[40,44],[28,50]],
  // Japan
  [[130,31],[133,34],[137,35],[141,40],[143,44],[141,42],[137,37],[133,33],[130,31]],
  // Australia
  [[113,-22],[114,-30],[118,-34],[125,-33],[132,-32],[138,-35],[145,-38],[150,-37],[153,-30],[148,-24],[145,-16],[138,-12],[132,-11],[126,-14],[120,-19],[113,-22]],
];

/* Close-up coastline used inside the New York magnifying-glass loupe. */
const NYC_LAND = [
  [[-74.22,40.50],[-74.22,40.92],[-73.93,40.92],[-73.78,40.87],[-73.70,40.86],[-73.58,40.80],[-73.58,40.58],[-73.78,40.54],[-73.95,40.50],[-74.22,40.50]],
];

const SVG_NS = "http://www.w3.org/1998/svg";

class Menu {
  constructor(onStart) {
    this.onStart = onStart;
    this.selectedAirline = AIRLINES[0];
    this.selectedAircraft = AIRCRAFT_TYPES[2]; // A320 default

    this.from = AIRPORTS.find((a) => a.iata === "JFK") || AIRPORTS[0];
    this.to = AIRPORTS.find((a) => a.iata === "LHR") || AIRPORTS[1];
    this.dotEls = {};

    this.trainMode = "takeoff";
    this.openCluster = null;
    this.clusterEls = {};

    this._buildAirlines();
    this._buildAircraft();
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
    AIRLINES.forEach((a) => {
      const el = document.createElement("div");
      el.className = "card" + (a === this.selectedAirline ? " selected" : "");
      el.innerHTML = `
        <span class="swatch" style="background:${a.tail}; box-shadow: inset 0 0 0 3px ${a.accent}"></span>
        <span class="card-main">
          <span class="card-title">${a.name}</span>
          <span class="card-sub">${a.code}</span>
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
      const el = document.createElement("div");
      el.className = "card" + (t === this.selectedAircraft ? " selected" : "");
      el.innerHTML = `
        <span class="card-main">
          <span class="card-title">${t.name}</span>
          <span class="card-sub">${t.class} · V<sub>R</sub> ${t.vRotate} kt · ${(t.mass/1000).toFixed(1)} t</span>
        </span>`;
      el.addEventListener("click", () => {
        this.selectedAircraft = t;
        this._buildAircraft();
      });
      box.appendChild(el);
    });
  }

  /* ---- World map ---- */
  _project(ap) { return { x: ap.lon + 180, y: 90 - ap.lat }; }      // to viewBox units
  _pct(ap) {
    const p = this._project(ap);
    return { left: (p.x / 360) * 100, top: (p.y / 180) * 100 };
  }
  _clusterPct(ap, cluster) {
    return {
      left: ((ap.lon - cluster.lon0) / (cluster.lon1 - cluster.lon0)) * 100,
      top: ((cluster.lat1 - ap.lat) / (cluster.lat1 - cluster.lat0)) * 100,
    };
  }
  _clusteredIatas() {
    const set = new Set();
    MAP_CLUSTERS.forEach((c) => c.iatas.forEach((i) => set.add(i)));
    return set;
  }

  _buildMap() {
    const svg = document.getElementById("world-map");
    svg.innerHTML = "";

    // Graticule.
    for (let lon = -150; lon <= 150; lon += 30) {
      const x = lon + 180;
      svg.appendChild(this._svgEl("line", { x1: x, y1: 0, x2: x, y2: 180, class: "map-grid" }));
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = 90 - lat;
      svg.appendChild(this._svgEl("line", { x1: 0, y1: y, x2: 360, y2: y, class: "map-grid" }));
    }

    // Continents.
    CONTINENTS.forEach((poly) => {
      const pts = poly.map(([lon, lat]) => `${lon + 180},${90 - lat}`).join(" ");
      svg.appendChild(this._svgEl("polygon", { points: pts, class: "map-continent" }));
    });

    // Route line (updated on selection).
    this.routeLine = this._svgEl("line", { class: "route-line hidden" });
    svg.appendChild(this.routeLine);

    // Airport dots — clustered cities are hidden on the world map and
    // shown inside a magnifying-glass loupe instead.
    const dots = document.getElementById("map-dots");
    dots.innerHTML = "";
    this.dotEls = {};
    const clustered = this._clusteredIatas();
    AIRPORTS.forEach((ap) => {
      if (clustered.has(ap.iata)) return;
      const { left, top } = this._pct(ap);
      const dot = this._makeDot(ap, left, top);
      dots.appendChild(dot);
      this.dotEls[ap.iata] = dot;
    });

    this._buildClusters(dots);

    // Clicking empty map closes any open popup / loupe.
    const wrap = document.getElementById("map-wrap");
    wrap.addEventListener("click", () => {
      this._closePopup();
      this._closeCluster();
    });
    const popup = document.getElementById("map-popup");
    popup.addEventListener("click", (e) => e.stopPropagation());
  }

  _makeDot(ap, left, top) {
    const dot = document.createElement("button");
    dot.className = "dot";
    dot.style.left = left + "%";
    dot.style.top = top + "%";
    dot.title = `${ap.iata} — ${ap.name}`;
    dot.innerHTML = `<span class="dot-core"></span><span class="dot-label">${ap.iata}</span>`;
    dot.addEventListener("click", (e) => { e.stopPropagation(); this._openPopup(ap, dot); });
    return dot;
  }

  _buildClusters(host) {
    this.clusterEls = {};
    MAP_CLUSTERS.forEach((cluster) => {
      const { left, top } = this._pct(cluster);
      const btn = document.createElement("button");
      btn.className = "mag-btn";
      btn.style.left = left + "%";
      btn.style.top = top + "%";
      btn.title = `Zoom ${cluster.label}`;
      btn.innerHTML = `
        <span class="mag-lens"></span>
        <span class="mag-handle"></span>
        <span class="mag-label">${cluster.label === "New York" ? "NYC" : cluster.label}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggleCluster(cluster);
      });
      host.appendChild(btn);

      const loupe = document.createElement("div");
      loupe.className = "loupe hidden";
      loupe.style.left = left + "%";
      loupe.style.top = `calc(${top}% + 42px)`;
      loupe.innerHTML = `
        <span class="loupe-handle"></span>
        <div class="loupe-glass">
          <svg class="loupe-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
          <div class="loupe-dots"></div>
          <div class="loupe-caption">${cluster.label.toUpperCase()}</div>
        </div>`;
      loupe.addEventListener("click", (e) => e.stopPropagation());
      host.appendChild(loupe);

      const lsvg = loupe.querySelector(".loupe-map");
      const land = cluster.id === "nyc" ? NYC_LAND : [];
      land.forEach((poly) => {
        const pts = poly.map(([lon, lat]) => {
          const x = ((lon - cluster.lon0) / (cluster.lon1 - cluster.lon0)) * 100;
          const y = ((cluster.lat1 - lat) / (cluster.lat1 - cluster.lat0)) * 100;
          return `${x},${y}`;
        }).join(" ");
        lsvg.appendChild(this._svgEl("polygon", { points: pts, class: "map-continent" }));
      });

      const ldots = loupe.querySelector(".loupe-dots");
      cluster.iatas.forEach((iata) => {
        const ap = AIRPORTS.find((a) => a.iata === iata);
        if (!ap) return;
        const p = this._clusterPct(ap, cluster);
        const dot = this._makeDot(ap, p.left, p.top);
        ldots.appendChild(dot);
        this.dotEls[ap.iata] = dot;
      });

      this.clusterEls[cluster.id] = { cluster, btn, loupe };
    });
  }

  _toggleCluster(cluster) {
    if (this.openCluster && this.openCluster.id === cluster.id) {
      this._closeCluster();
      return;
    }
    this._closePopup();
    this.openCluster = cluster;
    for (const id in this.clusterEls) {
      const el = this.clusterEls[id];
      const on = el.cluster.id === cluster.id;
      el.btn.classList.toggle("hidden", on);
      el.loupe.classList.toggle("hidden", !on);
    }
  }

  _closeCluster() {
    this.openCluster = null;
    for (const id in this.clusterEls) {
      const el = this.clusterEls[id];
      el.btn.classList.remove("hidden");
      el.loupe.classList.add("hidden");
    }
  }

  _svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) {
      if (k === "class") el.setAttribute("class", attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    return el;
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
      const el = this.dotEls[iata];
      el.classList.toggle("from", !!this.from && this.from.iata === iata);
      el.classList.toggle("to", !!this.to && this.to.iata === iata);
    }

    for (const id in this.clusterEls) {
      const { cluster, btn } = this.clusterEls[id];
      const hasFrom = !!this.from && cluster.iatas.includes(this.from.iata);
      const hasTo = !!this.to && cluster.iatas.includes(this.to.iata);
      btn.classList.toggle("has-from", hasFrom);
      btn.classList.toggle("has-to", hasTo);
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
    if (!this.from || !this.to || this.from === this.to) return;
    this.onStart({
      airline: this.selectedAirline,
      aircraft: this.selectedAircraft,
      from: this.from,
      to: this.to,
    });
  }
}
