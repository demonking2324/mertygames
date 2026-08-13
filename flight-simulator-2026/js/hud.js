/* ============================================================
 * HUD — instruments drawn as a DOM overlay for crisp text.
 * ============================================================ */

class HUD {
  constructor(el) {
    this.el = el;
    this.el.innerHTML = `
      <div class="hud-tl">
        <div class="gauge"><span class="g-label">SPD</span><span id="hud-spd" class="g-val">0</span><span class="g-unit">kt</span></div>
        <div class="gauge"><span class="g-label">ALT</span><span id="hud-alt" class="g-val">0</span><span class="g-unit">ft</span></div>
        <div class="gauge"><span class="g-label">V/S</span><span id="hud-vs" class="g-val">0</span><span class="g-unit">fpm</span></div>
        <div class="gauge"><span class="g-label">HDG</span><span id="hud-aoa" class="g-val">0</span><span class="g-unit">° AoA</span></div>
      </div>

      <div class="hud-tr">
        <div class="route-badge">
          <div><b id="hud-dep">---</b> <span class="arrow">→</span> <b id="hud-arr">---</b></div>
          <div class="dist-line"><span id="hud-dist">0</span> km to go · <span id="hud-real">0</span> km real</div>
          <div class="prog"><div id="hud-prog" class="prog-bar"></div></div>
        </div>
      </div>

      <div class="hud-bl">
        <div class="lever"><span class="l-label">THR</span>
          <div class="bar"><div id="hud-thr" class="bar-fill"></div></div>
          <span id="hud-thr-val" class="l-val">0%</span>
        </div>
        <div class="chips">
          <span id="hud-flaps" class="chip">FLAPS 0</span>
          <span id="hud-gear" class="chip good">GEAR DN</span>
          <span id="hud-brakes" class="chip off">BRK</span>
        </div>
      </div>

      <div id="hud-stall" class="stall-warn hidden">STALL</div>
      <div id="hud-status" class="status-line"></div>
    `;
    this._injectStyle();
    this._c = (id) => this.el.querySelector(id);
  }

  update(ac, world) {
    this._c("#hud-spd").textContent = Math.round(msToKnots(ac.airspeed));
    const altFt = mToFeet(ac.y);
    this._c("#hud-alt").textContent = Math.round(altFt).toLocaleString();
    const vs = Math.round(msToFpm(ac.verticalSpeed));
    const vsEl = this._c("#hud-vs");
    vsEl.textContent = (vs > 0 ? "+" : "") + vs.toLocaleString();
    vsEl.style.color = vs > 50 ? "#22c55e" : vs < -50 ? "#f59e0b" : "#e5eefb";
    this._c("#hud-aoa").textContent = deg(ac.alpha).toFixed(1);

    this._c("#hud-dep").textContent = world.dep.iata;
    this._c("#hud-arr").textContent = world.arr.iata;
    const remainingM = Math.max(0, world.arrRunwayStart - ac.x);
    const totalM = world.arrRunwayStart;
    this._c("#hud-dist").textContent = (remainingM / 1000).toFixed(1);
    this._c("#hud-real").textContent = Math.round(world.realDistanceKm).toLocaleString();
    const prog = clamp(1 - remainingM / totalM, 0, 1) * 100;
    this._c("#hud-prog").style.width = prog.toFixed(1) + "%";

    const thrPct = Math.round(ac.throttle * 100);
    this._c("#hud-thr").style.width = thrPct + "%";
    this._c("#hud-thr-val").textContent = thrPct + "%";

    this._c("#hud-flaps").textContent = "FLAPS " + ac.flaps;
    const gear = this._c("#hud-gear");
    gear.textContent = ac.gearDown ? "GEAR DN" : "GEAR UP";
    gear.className = "chip " + (ac.gearDown ? "good" : "warn");
    const brk = this._c("#hud-brakes");
    brk.className = "chip " + (ac.brakes ? "danger" : "off");

    this._c("#hud-stall").classList.toggle("hidden", !ac.stalled);
  }

  setStatus(text) { this._c("#hud-status").textContent = text || ""; }

  _injectStyle() {
    if (document.getElementById("hud-style")) return;
    const s = document.createElement("style");
    s.id = "hud-style";
    s.textContent = `
      .hud-tl { position:absolute; top:16px; left:16px; display:flex; gap:10px; }
      .gauge { background:rgba(9,15,28,.72); border:1px solid #26344b; border-radius:12px; padding:8px 12px; min-width:92px; }
      .g-label { display:block; font-size:10px; letter-spacing:2px; color:#8ea3c2; }
      .g-val { font-size:26px; font-weight:800; }
      .g-unit { font-size:11px; color:#8ea3c2; margin-left:4px; }

      .hud-tr { position:absolute; top:16px; right:16px; }
      .route-badge { background:rgba(9,15,28,.72); border:1px solid #26344b; border-radius:12px; padding:10px 14px; min-width:220px; text-align:right; }
      .route-badge .arrow { color:#38bdf8; margin:0 6px; }
      .dist-line { font-size:12px; color:#8ea3c2; margin-top:4px; }
      .prog { margin-top:8px; height:6px; background:#1a263f; border-radius:4px; overflow:hidden; }
      .prog-bar { height:100%; width:0%; background:linear-gradient(90deg,#38bdf8,#22c55e); transition:width .2s ease; }

      .hud-bl { position:absolute; bottom:16px; left:16px; display:flex; flex-direction:column; gap:10px; }
      .lever { display:flex; align-items:center; gap:10px; background:rgba(9,15,28,.72); border:1px solid #26344b; border-radius:12px; padding:10px 12px; }
      .l-label { font-size:11px; color:#8ea3c2; letter-spacing:1px; }
      .bar { width:160px; height:12px; background:#1a263f; border-radius:6px; overflow:hidden; }
      .bar-fill { height:100%; width:0%; background:linear-gradient(90deg,#f59e0b,#22c55e); transition:width .08s linear; }
      .l-val { font-size:13px; font-weight:700; width:42px; }
      .chips { display:flex; gap:8px; }
      .chip { font-size:12px; font-weight:700; padding:6px 10px; border-radius:8px; background:#1a263f; border:1px solid #26344b; }
      .chip.good { color:#22c55e; border-color:#1f5133; }
      .chip.warn { color:#f59e0b; border-color:#5c451c; }
      .chip.danger { color:#ef4444; border-color:#5c2020; }
      .chip.off { color:#5b6b85; }

      .stall-warn { position:absolute; top:120px; left:50%; transform:translateX(-50%);
        color:#fff; background:#b91c1c; font-weight:900; letter-spacing:4px; padding:8px 18px;
        border-radius:8px; animation:blink .5s steps(2,start) infinite; }
      @keyframes blink { 50% { opacity:.25; } }

      .status-line { position:absolute; bottom:16px; left:50%; transform:translateX(-50%);
        background:rgba(9,15,28,.72); border:1px solid #26344b; border-radius:10px;
        padding:8px 16px; font-size:13px; color:#e5eefb; max-width:60%; text-align:center; }
      .status-line:empty { display:none; }
    `;
    document.head.appendChild(s);
  }
}
