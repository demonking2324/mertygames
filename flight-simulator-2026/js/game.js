/* ============================================================
 * Game — loop, state machine, aircraft rendering, outcomes.
 * ============================================================ */

class Game {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.cam = new Camera();
    this.input = new Input();
    this.hud = new HUD(document.getElementById("hud"));
    this.messageEl = document.getElementById("message");

    this.state = "idle"; // idle | flying | paused | ended
    this.lastT = 0;
    this.prevOnGround = true;
    this.touchdownVs = 0;
    this.smoke = []; // touchdown puff particles (world coords)

    this.training = false;
    this.trainingConfig = null;
    this.resetBtn = document.getElementById("reset-btn");
    this.resetBtn.addEventListener("click", () => this._resetTraining());

    this._bindKeys();
    window.addEventListener("resize", () => this._resize());
    this._resize();

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cam.resize(w, h);
  }

  _bindKeys() {
    this.input.onKeyDownExtra = (code) => {
      if (this.state === "flying" || this.state === "paused") {
        if (code === "KeyP") this._togglePause();
        if (code === "Escape") this.toMenu();
      }
    };
  }

  start(config) {
    const { airline, aircraft, from, to } = config;
    this.training = !!config.training;
    this.trainingMode = config.trainingMode || "takeoff";
    this.trainingConfig = this.training ? config : null;
    this._landedAtArrival = false;
    this._landQuality = null;
    this._announcedClimb = false;

    this.world = new World(from, to);
    this.ac = new Aircraft(aircraft, airline, this.world.groundElevation);

    if (this.training && this.trainingMode === "landing") {
      this._setupLandingApproach();
      this._announcedClimb = true; // already airborne — skip the climb hint
      this.hud.setStatus("Training: on final. Manage descent — gear down, full flaps, aim for the runway.");
    } else {
      this.ac.x = this.world.depRunwayStart + 150;
      this.hud.setStatus((this.training ? "Training: " : "Cleared for takeoff — ") +
        "flaps (F), throttle up (D), and rotate (pull ↓) near " +
        Math.round(this.ac.spec.vRotate) + " kt.");
    }

    // Position camera immediately on the aircraft.
    this.cam.x = this.ac.x;
    this.cam.y = Math.max(this.ac.y, 60);

    this.prevOnGround = this.ac.onGround;
    this.smoke = [];
    this.state = "flying";
    this._hideMessage();

    this.resetBtn.classList.toggle("hidden", !this.training);

    document.getElementById("menu").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
    this._resize();
  }

  /* Place the aircraft airborne on a ~3.5° final approach to the runway. */
  _setupLandingApproach() {
    const ac = this.ac, w = this.world, spec = ac.spec;
    const spd = spec.vApproach / MS_TO_KT;   // m/s
    const approach = 6500;                    // meters before the threshold
    const alt = 400;                          // meters above the field
    ac.x = w.arrRunwayStart - approach;
    ac.y = w.groundElevation + alt;
    ac.vx = spd;
    ac.vy = -spd * (alt / approach);          // aim the vector at the numbers
    ac.pitch = rad(2);
    ac.onGround = false;
    ac.gearDown = true;
    ac.flaps = spec.flapNotches;
    ac.throttle = 0.4;
  }

  _resetTraining() {
    if (this.trainingConfig) this.start(this.trainingConfig);
  }

  toMenu() {
    this.state = "idle";
    this.resetBtn.classList.add("hidden");
    document.getElementById("game").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
    this._hideMessage();
  }

  _togglePause() {
    if (this.state === "flying") {
      this.state = "paused";
      this._showMessage("Paused", "<p>Press <b>P</b> (or tap <b>❚❚</b>) to resume, <b>Esc</b> / <b>☰</b> for menu.</p>", false);
    } else if (this.state === "paused") {
      this.state = "flying";
      this._hideMessage();
    }
  }

  _loop(t) {
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0);
    this.lastT = t;

    if (this.state === "flying") {
      this._update(dt);
      this._render();
    } else if (this.state === "paused" || this.state === "ended") {
      this._render();
    }
    this.input.endFrame();
    requestAnimationFrame(this._loop);
  }

  _update(dt) {
    const ac = this.ac;
    const ctrl = this.input.sample(dt);

    // Discrete actions.
    if (this.input.pressed("KeyF")) ac.flaps = Math.min(ac.spec.flapNotches, ac.flaps + 1);
    if (this.input.pressed("KeyR")) ac.flaps = Math.max(0, ac.flaps - 1);
    if (this.input.pressed("KeyG")) ac.gearDown = !ac.gearDown;

    // Throttle: the touch slider sets it absolutely; keyboard nudges it.
    if (ctrl.throttleAbsolute != null) {
      ac.setThrottle(ctrl.throttleAbsolute);
    } else {
      const rate = 0.5; // per second full-travel
      if (ctrl.throttleUp) ac.setThrottle(ac.throttle + rate * dt);
      if (ctrl.throttleDown) ac.setThrottle(ac.throttle - rate * dt);
    }
    ac.brakes = ctrl.brakes && ac.onGround;

    ac.update(dt, { pitch: ctrl.pitch });

    this._updateSmoke(dt);
    this._checkTransitions();
    this._updateStatus();

    this.cam.follow(ac.x, ac.y, dt);
    this.hud.update(ac, this.world);
    if (this.mobile) this.mobile.sync(ac);
  }

  _checkTransitions() {
    const ac = this.ac;
    const w = this.world;

    // Just touched down?
    if (!this.prevOnGround && ac.onGround) {
      this.touchdownVs = Math.abs(ac.verticalSpeed);
      if (ac.airspeed > 8) this._spawnLandingSmoke();
      const atArrival = ac.x >= w.arrRunwayStart - 150 && ac.x <= w.arrRunwayEnd + 150;
      const q = this.touchdownVs < 1.5 ? "smooth" : this.touchdownVs < 3.0 ? "firm" : "hard";

      if (!ac.gearDown) {
        return this._end(false, "Gear-up landing", "You touched down without landing gear.");
      }
      if (this.touchdownVs > 5.0) {
        return this._end(false, "Crash", `Impact too hard (${this.touchdownVs.toFixed(1)} m/s descent).`);
      }
      if (atArrival) {
        this._landedAtArrival = true;
        this._landQuality = q;
        this.hud.setStatus(`Touchdown at ${w.arr.iata} (${q}, ${this.touchdownVs.toFixed(1)} m/s). Brake to a stop (Space).`);
      } else {
        this.hud.setStatus(`Landed off-airport (${q}). Roll to a stop or take off again.`);
      }
    }
    this.prevOnGround = ac.onGround;

    // Stopped at destination -> success.
    if (this._landedAtArrival && ac.onGround && ac.airspeed < 2) {
      const q = this._landQuality;
      const nice = q === "smooth" ? "Butter-smooth landing!" : q === "firm" ? "Solid landing." : "Rough, but you made it.";
      this._end(true, "Flight complete", `${nice} Welcome to ${this.world.arr.city}.`);
    }

    // Overran the arrival end while still fast.
    if (ac.x > w.arrRunwayEnd + 400 && ac.onGround) {
      this._end(false, "Runway overrun", "You rolled off the end of the runway.");
    }
  }

  _updateStatus() {
    const ac = this.ac;
    if (this.state !== "flying") return;
    if (ac.onGround && ac.airspeed < 1 && ac.throttle < 0.05 && !this._landedAtArrival) {
      // waiting on the ramp — keep takeoff hint
      return;
    }
    if (!ac.onGround && !this._announcedClimb && ac.y - this.world.groundElevation > 120) {
      this.hud.setStatus("Airborne! Gear up (G), then climb toward " +
        Math.round(mToFeet(ac.spec.cruiseAlt)).toLocaleString() + " ft.");
      this._announcedClimb = true;
    }
  }

  _end(success, title, detail) {
    if (this.state === "ended") return;
    this.state = "ended";
    const cls = success ? "good" : "bad";
    const score = success ? this._score() : null;
    const scoreHtml = score != null ? `<p>Score: <b>${score}</b> / 100</p>` : "";
    this._showMessage(
      `<span class="${cls}">${title}</span>`,
      `<p>${detail}</p>${scoreHtml}
       <button id="msg-retry">Fly again</button>
       <button id="msg-menu">Main menu</button>`,
      true
    );
    setTimeout(() => {
      const r = document.getElementById("msg-retry");
      const m = document.getElementById("msg-menu");
      if (r) r.onclick = () => { this._resetSame(); };
      if (m) m.onclick = () => this.toMenu();
    }, 0);
  }

  _score() {
    let s = 100;
    const vs = this.touchdownVs;
    if (vs > 1.5) s -= (vs - 1.5) * 12;         // penalize firm/hard touchdowns
    s = clamp(Math.round(s), 0, 100);
    return s;
  }

  _resetSame() {
    if (this.training && this.trainingConfig) {
      this.start(this.trainingConfig);
      return;
    }
    this.start({
      airline: this.ac.airline,
      aircraft: this.ac.spec,
      from: this.world.dep,
      to: this.world.arr,
    });
  }

  /* Kick up a burst of tire smoke at the main gear on touchdown. */
  _spawnLandingSmoke() {
    const ac = this.ac;
    const gyw = this.world.groundElevation;
    const speed = ac.airspeed;
    const spread = ac.spec.length * 0.7;
    const n = 16;
    for (let i = 0; i < n; i++) {
      this.smoke.push({
        x: ac.x - ac.spec.length * 0.1 + (Math.random() - 0.5) * spread,
        y: gyw + Math.random() * 1.5,
        vx: -speed * 0.12 - Math.random() * 4,          // drift back behind the wheels
        vy: 2.5 + Math.random() * 6,                    // billow upward
        r: ac.spec.length * (0.12 + Math.random() * 0.18),
        age: 0,
        ttl: 0.9 + Math.random() * 0.9,
      });
    }
  }

  _updateSmoke(dt) {
    const s = this.smoke;
    for (let i = s.length - 1; i >= 0; i--) {
      const p = s[i];
      p.age += dt;
      if (p.age >= p.ttl) { s.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - 0.8 * dt);
      p.vy *= (1 - 0.5 * dt);
      p.r += p.r * 1.1 * dt; // expand as it dissipates
    }
  }

  _drawSmoke(ctx) {
    if (!this.smoke.length) return;
    const cam = this.cam;
    ctx.save();
    for (const p of this.smoke) {
      const sx = cam.worldToScreenX(p.x);
      const sy = cam.worldToScreenY(p.y);
      const r = cam.toScreenLen(p.r);
      if (r < 0.5) continue;
      const a = clamp(1 - p.age / p.ttl, 0, 1);
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = "#d9dee4";
      puff(ctx, sx, sy, r);
    }
    ctx.restore();
  }

  /* ---------------- Rendering ---------------- */
  _render() {
    const ctx = this.ctx;
    this.world.render(ctx, this.cam);
    this._drawAircraft(ctx);
    this._drawSmoke(ctx);
  }

  _drawAircraft(ctx) {
    const ac = this.ac;
    const cam = this.cam;
    const sx = cam.worldToScreenX(ac.x);
    const sy = cam.worldToScreenY(ac.y);

    // Fixed on-screen size (scaled a little by aircraft length), so it stays visible.
    const px = clamp(ac.spec.length * 3.9, 64, 200);

    // Offset so the wheels (or belly, gear up) rest on ac.y — the ground
    // contact height — instead of the fuselage centerline floating above it.
    const H = px * (ac.spec.wide ? 0.14 : 0.115);
    const gearLen = H * (ac.spec.fixedGear ? 0.7 : 0.45);
    const showGear = ac.gearDown || ac.spec.fixedGear;
    const contactY = showGear ? H * 0.92 + gearLen + H * 0.58 : H;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-ac.pitch); // screen y is inverted
    ctx.translate(0, -contactY); // lift body so wheels pivot on the ground point
    this._drawPlaneBody(ctx, ac, px);
    ctx.restore();

    // Airline code above the aircraft.
    ctx.fillStyle = "rgba(9,15,28,0.7)";
    ctx.font = "700 12px system-ui, sans-serif";
    const tag = `${ac.airline.code} · ${ac.spec.name}`;
    const tw = ctx.measureText(tag).width;
    ctx.fillText(tag, sx - tw / 2, sy - px * 0.72);
  }

  /* Detailed side-view airliner/GA drawing in local (nose-right) coordinates. */
  _drawPlaneBody(ctx, ac, L) {
    const spec = ac.spec;
    const H = L * (spec.wide ? 0.14 : 0.115);   // fuselage half-height reference
    const body = ac.airline.fuselage;
    const tail = ac.airline.tail;
    const accent = ac.airline.accent;
    const accent2 = ac.airline.accent2; // optional second cheatline (e.g. retro AA)
    const isJet = spec.engineType === "jet";
    const highWing = spec.highWing;

    // ---- Contrails (two thin lines) when high and powered ----
    if (isJet && ac.throttle > 0.15 && ac.y - this.world.groundElevation > 2500) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = Math.max(1.5, H * 0.25);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-L * 0.55, -H * 0.2); ctx.lineTo(-L * 1.6, -H * 0.2);
      ctx.moveTo(-L * 0.55, H * 0.2);  ctx.lineTo(-L * 1.6, H * 0.2);
      ctx.stroke();
      ctx.restore();
    } else if (ac.throttle > 0.1 && ac.airspeed > 8) {
      ctx.save();
      ctx.globalAlpha = 0.18 * ac.throttle;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(-L * 0.8, 0, L * 0.45, H * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- Horizontal stabilizer (tailplane) ----
    ctx.fillStyle = shade(body, -10);
    ctx.beginPath();
    ctx.moveTo(-L * 0.34, -H * 0.2);
    ctx.lineTo(-L * 0.52, -H * 0.9);
    ctx.lineTo(-L * 0.40, -H * 0.9);
    ctx.lineTo(-L * 0.30, -H * 0.2);
    ctx.closePath();
    ctx.fill();

    // ---- Vertical tail fin (airline tail color) ----
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(-L * 0.42, -H * 0.7);
    ctx.quadraticCurveTo(-L * 0.50, -H * 2.9, -L * 0.40, -H * 2.9);
    ctx.lineTo(-L * 0.26, -H * 0.7);
    ctx.closePath();
    ctx.fill();
    // small logo dot on the tail
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-L * 0.40, -H * 1.7, H * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // ---- Wing (behind fuselage), swept for jets ----
    const wingY = highWing ? -H * 0.7 : H * 0.55;
    const wingDrop = highWing ? -1 : 1; // direction the wing extends vertically
    ctx.fillStyle = shade(body, -16);
    ctx.beginPath();
    ctx.moveTo(L * 0.14, wingY);
    ctx.lineTo(-L * 0.30, wingY + wingDrop * H * (isJet ? 1.5 : 1.1));
    ctx.lineTo(-L * 0.14, wingY + wingDrop * H * (isJet ? 1.5 : 1.1));
    ctx.lineTo(L * 0.30, wingY);
    ctx.closePath();
    ctx.fill();

    // Winglet at the wing tip.
    if (spec.winglets) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.30, wingY + wingDrop * H * 1.5);
      ctx.lineTo(-L * 0.33, wingY + wingDrop * H * 2.1);
      ctx.lineTo(-L * 0.27, wingY + wingDrop * H * 2.1);
      ctx.closePath();
      ctx.fill();
    }

    // ---- Engines ----
    this._drawEngines(ctx, ac, L, H, wingY, wingDrop);

    // ---- Fuselage (rounded capsule with pointed nose, tapered tail) ----
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);                                 // nose tip
    ctx.quadraticCurveTo(L * 0.44, -H, L * 0.18, -H);
    ctx.lineTo(-L * 0.30, -H * 0.92);
    ctx.quadraticCurveTo(-L * 0.5, -H * 0.55, -L * 0.5, 0); // tail cone top
    ctx.quadraticCurveTo(-L * 0.5, H * 0.55, -L * 0.30, H * 0.92);
    ctx.lineTo(L * 0.18, H);
    ctx.quadraticCurveTo(L * 0.44, H, L * 0.5, 0);
    ctx.closePath();
    ctx.fill();

    // Subtle belly shading for volume.
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(-L * 0.30, H * 0.92);
    ctx.lineTo(L * 0.18, H);
    ctx.quadraticCurveTo(L * 0.44, H, L * 0.5, 0);
    ctx.lineTo(L * 0.42, H * 0.4);
    ctx.lineTo(-L * 0.30, H * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ---- Cheatline (accent stripe along the windows) ----
    // A second accent draws a parallel stripe just below for classic
    // twin-line liveries like American's retro "silverbird".
    const clw = Math.max(1.5, H * 0.22);
    ctx.lineWidth = clw;
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-L * 0.36, -H * 0.02);
    ctx.lineTo(L * 0.40, -H * 0.06);
    ctx.stroke();
    if (accent2) {
      ctx.strokeStyle = accent2;
      ctx.beginPath();
      ctx.moveTo(-L * 0.36, -H * 0.02 + clw);
      ctx.lineTo(L * 0.40, -H * 0.06 + clw);
      ctx.stroke();
    }

    // ---- Cockpit windows ----
    ctx.fillStyle = "#0f2233";
    ctx.beginPath();
    ctx.moveTo(L * 0.46, -H * 0.28);
    ctx.lineTo(L * 0.33, -H * 0.55);
    ctx.lineTo(L * 0.30, -H * 0.18);
    ctx.closePath();
    ctx.fill();

    // ---- Cabin windows (scaled to length) ----
    ctx.fillStyle = "rgba(150,200,235,0.95)";
    const count = spec.engineType === "prop" ? 4 : (spec.wide ? 14 : 9);
    const startX = L * 0.28, endX = -L * 0.28;
    const winY = -H * 0.18;
    const wsz = Math.max(1.2, H * 0.22);
    for (let i = 0; i < count; i++) {
      const wx = lerp(startX, endX, i / (count - 1));
      ctx.fillRect(wx - wsz / 2, winY, wsz, wsz * 1.3);
    }

    // ---- Landing gear (or fixed gear for the Cessna) ----
    if (ac.gearDown || spec.fixedGear) {
      const strutColor = "#243040";
      const wheelColor = "#0b1118";
      const gy = H * 0.92;
      const legLen = H * (spec.fixedGear ? 0.7 : 0.45);
      ctx.strokeStyle = strutColor;
      ctx.lineWidth = Math.max(1.6, H * 0.22);
      const legs = [L * 0.30, -L * 0.12];
      for (const lx of legs) {
        ctx.beginPath();
        ctx.moveTo(lx, gy);
        ctx.lineTo(lx, gy + legLen);
        ctx.stroke();
        ctx.fillStyle = wheelColor;
        ctx.beginPath();
        ctx.arc(lx, gy + legLen + H * 0.28, H * 0.30, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawEngines(ctx, ac, L, H, wingY, wingDrop) {
    const spec = ac.spec;
    if (spec.engineType === "prop") {
      // Nose spinner + spinning-prop disc (Cessna).
      ctx.fillStyle = "#1f2937";
      ctx.beginPath();
      ctx.ellipse(L * 0.52, 0, H * 0.18, H * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = ac.throttle > 0.05 ? 0.35 : 0.9;
      ctx.strokeStyle = "#2b3442";
      ctx.lineWidth = Math.max(1.4, H * 0.18);
      ctx.beginPath();
      ctx.moveTo(L * 0.54, -H * 1.1);
      ctx.lineTo(L * 0.54, H * 1.1);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (spec.engineType === "turboprop") {
      // Nacelle on the wing with a spinner + prop disc (Dash 8).
      const ny = wingY + wingDrop * H * 0.4;
      ctx.fillStyle = "#374151";
      roundRect(ctx, L * 0.02, ny - H * 0.35, L * 0.22, H * 0.7, H * 0.25);
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = ac.throttle > 0.05 ? 0.35 : 0.85;
      ctx.strokeStyle = "#2b3442";
      ctx.lineWidth = Math.max(1.4, H * 0.16);
      ctx.beginPath();
      ctx.moveTo(L * 0.26, ny - H * 0.9);
      ctx.lineTo(L * 0.26, ny + H * 0.9);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Jet: underslung turbofan pod below the wing.
    const ey = wingY + wingDrop * H * 1.05;
    const ew = spec.wide ? L * 0.26 : L * 0.20;
    const eh = spec.wide ? H * 1.15 : H * 0.95;
    ctx.fillStyle = shade(ac.airline.fuselage, -28);
    roundRect(ctx, -L * 0.02, ey - eh / 2, ew, eh, eh * 0.45);
    ctx.fill();
    // Intake lip.
    ctx.fillStyle = "#0f1620";
    ctx.beginPath();
    ctx.ellipse(-L * 0.02 + ew, ey, eh * 0.16, eh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // Accent band on the nacelle.
    ctx.strokeStyle = ac.airline.accent;
    ctx.lineWidth = Math.max(1.2, eh * 0.12);
    ctx.beginPath();
    ctx.moveTo(-L * 0.02 + ew * 0.15, ey - eh * 0.45);
    ctx.lineTo(-L * 0.02 + ew * 0.15, ey + eh * 0.45);
    ctx.stroke();
  }

  _showMessage(titleHtml, bodyHtml, withButtons) {
    this.messageEl.innerHTML = `<h2>${titleHtml}</h2>${bodyHtml}`;
    this.messageEl.classList.remove("hidden");
  }
  _hideMessage() { this.messageEl.classList.add("hidden"); }
}

/* Lighten/darken a hex color by an amount (-100..100). */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt / 100;
  const adj = (x) => Math.round(clamp(x + (f < 0 ? x * f : (255 - x) * f), 0, 255));
  return `rgb(${adj(r)},${adj(g)},${adj(b)})`;
}
