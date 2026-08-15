/* ============================================================
 * LoadingScreen — brief, skippable interlude between menu and
 * flight, with route info, a progress bar, and a gameplay tip.
 * ============================================================ */

const LOAD_DURATION_MS = 3200;

const LOAD_STAGES_FLIGHT = [
  { t: 0.00, text: "Filing flight plan…" },
  { t: 0.18, text: "Loading scenery…" },
  { t: 0.42, text: "Spawning traffic…" },
  { t: 0.68, text: "Pushing back…" },
  { t: 0.90, text: "Cleared for departure" },
];

const LOAD_STAGES_TAKEOFF = [
  { t: 0.00, text: "Briefing takeoff…" },
  { t: 0.22, text: "Positioning on the runway…" },
  { t: 0.55, text: "Configuring the aircraft…" },
  { t: 0.88, text: "Cleared for takeoff" },
];

const LOAD_STAGES_LANDING = [
  { t: 0.00, text: "Briefing the approach…" },
  { t: 0.22, text: "Vectoring onto final…" },
  { t: 0.55, text: "Configuring for landing…" },
  { t: 0.88, text: "Cleared to land" },
];

class LoadingScreen {
  constructor() {
    this.el = document.getElementById("loading");
    this.titleEl = document.getElementById("load-title");
    this.metaEl = document.getElementById("load-meta");
    this.routeEl = document.getElementById("load-route");
    this.barEl = document.getElementById("load-bar");
    this.statusEl = document.getElementById("load-status");
    this.tipEl = document.getElementById("load-tip");
    this.accentEl = document.getElementById("load-accent");

    this._raf = 0;
    this._onDone = null;
    this._onCancel = null;
    this._startTs = 0;
    this._stages = LOAD_STAGES_FLIGHT;
    this._active = false;
    this._finished = false;

    this._onPointer = (e) => {
      if (!this._active) return;
      e.preventDefault();
      this._finish();
    };
    this._onKey = (e) => {
      if (!this._active || e.repeat) return;
      if (e.code === "Escape") {
        e.preventDefault();
        this._cancel();
        return;
      }
      if (this._isModifier(e.code)) return;
      e.preventDefault();
      this._finish();
    };

    this.el.addEventListener("pointerdown", this._onPointer);
    window.addEventListener("keydown", this._onKey);
  }

  get visible() { return this._active; }

  _isModifier(code) {
    return /^(Shift|Control|Alt|Meta|CapsLock|Tab|OS)/.test(code);
  }

  /* Show the overlay. `onDone` runs when the bar completes or the
   * player skips; `onCancel` runs if they press Esc. */
  show(config, onDone, onCancel) {
    this.hide();
    this._onDone = onDone;
    this._onCancel = onCancel || null;
    this._active = true;
    this._finished = false;
    this._startTs = 0;
    this._stages = this._stagesFor(config);

    this._fill(config);
    this.barEl.style.width = "0%";
    this.statusEl.textContent = this._stages[0].text;
    this.el.classList.add("hidden");
    void this.el.offsetWidth; // restart the fade-in if we were already showing
    this.el.classList.remove("hidden");

    this._raf = requestAnimationFrame((t) => this._tick(t));
  }

  hide() {
    this._active = false;
    this._finished = true;
    this._onDone = null;
    this._onCancel = null;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    this.el.classList.add("hidden");
  }

  _stagesFor(config) {
    if (config.training && config.trainingMode === "landing") return LOAD_STAGES_LANDING;
    if (config.training) return LOAD_STAGES_TAKEOFF;
    return LOAD_STAGES_FLIGHT;
  }

  _fill(config) {
    const airline = config.airline;
    const spec = config.aircraft;
    const from = config.from;
    const to = config.to;

    const accent = (airline && airline.accent) || "#38bdf8";
    const tail = (airline && airline.tail) || "#1d3f73";
    this.el.style.setProperty("--load-accent", accent);
    this.el.style.setProperty("--load-tail", tail);
    this.accentEl.style.background = `linear-gradient(90deg, ${tail}, ${accent})`;

    if (config.training) {
      const mode = config.trainingMode === "landing" ? "Landing" : "Takeoff";
      this.titleEl.textContent = "Preparing training";
      this.metaEl.textContent = `${spec ? spec.name : "Aircraft"} · ${mode} practice`;
      this.routeEl.textContent = "Training Field";
    } else {
      this.titleEl.textContent = "Preparing flight";
      this.metaEl.textContent = `${airline ? airline.name : ""} · ${spec ? spec.name : ""}`;
      const km = from && to ? Math.round(routeDistanceKm(from, to)).toLocaleString() : "";
      this.routeEl.innerHTML = from && to
        ? `<b>${from.city}</b> (${from.iata}) <span class="load-arrow">→</span> <b>${to.city}</b> (${to.iata})`
          + (km ? `<span class="load-km">${km} km</span>` : "")
        : "";
    }

    this.tipEl.textContent = pickLoadingTip(config);
  }

  _tick(now) {
    if (!this._active) return;
    if (!this._startTs) this._startTs = now;
    const t = clamp((now - this._startTs) / LOAD_DURATION_MS, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    this.barEl.style.width = (eased * 100).toFixed(2) + "%";

    let stage = this._stages[0];
    for (const s of this._stages) {
      if (t >= s.t) stage = s;
    }
    if (this.statusEl.textContent !== stage.text) this.statusEl.textContent = stage.text;

    if (t >= 1) {
      this._finish();
      return;
    }
    this._raf = requestAnimationFrame((ts) => this._tick(ts));
  }

  _finish() {
    if (!this._active || this._finished) return;
    this._finished = true;
    this._active = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }
    this.barEl.style.width = "100%";
    const done = this._onDone;
    this._onDone = null;
    this._onCancel = null;
    this.el.classList.add("hidden");
    if (done) done();
  }

  _cancel() {
    if (!this._active) return;
    const cancel = this._onCancel;
    this.hide();
    if (cancel) cancel();
  }
}
