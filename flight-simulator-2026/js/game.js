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

    this.state = "idle"; // idle | loading | flying | paused | ended
    this.lastT = 0;
    this.prevOnGround = true;
    this.touchdownVs = 0;
    this.smoke = []; // touchdown puff particles (world coords)

    this.training = false;
    this.trainingConfig = null;
    this.freeCam = false;
    this._lastConfig = null;
    this._camDrag = null;
    this.loading = new LoadingScreen();
    this.resetBtn = document.getElementById("reset-btn");
    this.resetBtn.addEventListener("click", () => this._resetTraining());

    this._bindKeys();
    this._bindFreeCamPointer();
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

  _bindFreeCamPointer() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      if (!this.freeCam || (this.state !== "flying" && this.state !== "paused")) return;
      this._camDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y };
      c.classList.add("dragging");
      try { c.setPointerCapture(e.pointerId); } catch (err) {}
    });
    c.addEventListener("pointermove", (e) => {
      if (!this._camDrag || e.pointerId !== this._camDrag.id) return;
      const dx = e.clientX - this._camDrag.x;
      const dy = e.clientY - this._camDrag.y;
      this.cam.x = this._camDrag.cx - dx / this.cam.scale;
      this.cam.y = this._camDrag.cy + dy / this.cam.scale;
      this._clampFreeCam();
    });
    const end = (e) => {
      if (!this._camDrag || (e && e.pointerId !== this._camDrag.id)) return;
      this._camDrag = null;
      c.classList.remove("dragging");
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("wheel", (e) => {
      if (!this.freeCam || (this.state !== "flying" && this.state !== "paused")) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        const f = e.deltaY > 0 ? 0.9 : 1.11;
        this.cam.scale = clamp(this.cam.scale * f, 0.18, 1.35);
      } else {
        this.cam.y -= e.deltaY / this.cam.scale;
        this._clampFreeCam();
      }
    }, { passive: false });
  }

  start(config) {
    this._lastConfig = config;
    this.state = "loading";
    this._hideMessage();
    document.getElementById("menu").classList.add("hidden");
    document.getElementById("game").classList.add("hidden");
    this.resetBtn.classList.add("hidden");
    this.loading.show(config, () => this._beginFlight(config), () => this.toMenu());
  }

  _beginFlight(config) {
    const { airline, aircraft, from, to } = config;
    this.training = !!config.training;
    this.trainingMode = config.trainingMode || "takeoff";
    this.trainingConfig = this.training ? config : null;
    this.freeCam = !!config.freeCam;
    this._landedAtArrival = false;
    this._landQuality = null;
    this._announcedClimb = false;
    this.traffic = [];
    this._depCleared = true;
    this._camDrag = null;

    if (this.freeCam) {
      this._beginFreeCam(config);
      return;
    }

    document.body.classList.remove("freecam");
    this.hud.setSpectator(false);
    this.cam.scale = 0.55;

    this.world = new World(from, to);
    this.ac = new Aircraft(aircraft, airline, this.world.groundElevation);

    if (this.training && this.trainingMode === "landing") {
      this._setupLandingApproach();
      this._announcedClimb = true; // already airborne — skip the climb hint
      this.hud.setStatus("Training: on final. Manage descent — gear down, full flaps, aim for the runway.");
    } else {
      this.traffic = [];
      this._depCleared = true;
      if (this.training) {
        this.ac.x = this.world.depRunwayStart + 150;
        this.hud.setStatus("Training: flaps (F), throttle up (D), and rotate (pull ↓) near " +
          Math.round(this.ac.spec.vRotate) + " kt.");
      } else {
        this._spawnDepartureQueue();
      }
    }

    // Position camera immediately on the aircraft.
    this.cam.x = this.ac.x;
    this.cam.y = Math.max(this.ac.y, 60);

    this.prevOnGround = this.ac.onGround;
    this.smoke = [];
    this.input.clear();
    this.state = "flying";
    this._hideMessage();

    this.resetBtn.classList.toggle("hidden", !this.training);

    document.getElementById("menu").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
    this._resize();
  }

  /* Spectator at one airport: no player ship, pan the 2D camera, AI theater. */
  _beginFreeCam(config) {
    const ap = config.from;
    document.body.classList.add("freecam");
    this.training = false;
    this.ac = null;
    this.world = new World(ap, ap, { singleField: true });
    this.world.liveApron = true;
    this.apron = this.world.apronLayout(ap, this.world.depRunwayStart, -1);
    this._gateOcc = new Array(this.apron.n).fill(null);
    this._nextAppear = 7 + Math.random() * 5;
    this._spawnAirportTheater();
    this._spawnArrival(1300);

    this.cam.scale = 0.55;
    this.cam.x = this.world.depRunwayStart + 80;
    this.cam.y = Math.max(this.world.groundElevation + 110, 110);
    this.smoke = [];
    this.input.clear();
    this.state = "flying";
    this._hideMessage();
    this.resetBtn.classList.add("hidden");
    this.hud.setSpectator(true, ap);
    this.hud.setStatus("Arrivals come from the left · WASD / drag to pan · scroll up for sky · Q/E to zoom · Esc menu");

    document.getElementById("menu").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
    this._resize();
  }

  _clampFreeCam() {
    if (!this.world) return;
    const w = this.world;
    this.cam.x = clamp(this.cam.x, w.depRunwayStart - 2300, w.depRunwayEnd + 8000);
    const gy = w.groundElevation;
    this.cam.y = clamp(this.cam.y, gy + 40, gy + 14000);
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
    this.freeCam = false;
    this._camDrag = null;
    this.ac = null;
    document.body.classList.remove("freecam");
    this.hud.setSpectator(false);
    this.canvas.classList.remove("dragging");
    this.loading.hide();
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
    try {
      if (this.state === "flying") {
        this._update(dt);
        this._render();
      } else if (this.state === "paused" || this.state === "ended") {
        this._render();
      }
      this.input.endFrame();
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(this._loop);
  }

  _update(dt) {
    if (this.freeCam) {
      this._updateFreeCam(dt);
      return;
    }

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
    this._updateTraffic(dt);
    this._holdForQueue();

    this._updateSmoke(dt);
    this._checkTransitions();
    this._updateStatus();

    const extraLook = (!this._depCleared && ac.onGround) ? 260 : 0;
    this.cam.follow(ac.x + extraLook, ac.y, dt);
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
      // waiting in the queue / on the numbers — keep the current hint
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
    if (this._lastConfig) {
      this.start(this._lastConfig);
      return;
    }
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

  /* Line up 2–3 jets on the taxiway before the threshold. Only one
   * aircraft is released onto the runway at a time. */
  _spawnDepartureQueue() {
    const w = this.world;
    const thresh = w.depRunwayStart;
    const holdShort = thresh - 80;
    const gap = 320;
    const n = 2 + Math.floor(Math.random() * 2); // 2 or 3
    this.traffic = [];
    for (let i = 0; i < n; i++) {
      const pick = this._pickTraffic();
      const x = holdShort - (i + 1) * gap;
      const t = new TrafficPlane(pick.spec, pick.airline, x, w.groundElevation);
      t.goalX = x;
      t.wait = i === 0 ? 0.6 : 0.4;
      this.traffic.push(t);
    }
    this.ac.x = holdShort - (n + 1) * gap;
    this._depCleared = false;
    this._queueHint();
  }

  _pickTraffic() {
    if (this.freeCam) return this._pickFreshTraffic();
    const exclude = this.ac && this.ac.airline && this.ac.airline.id;
    return pickAirportTraffic(this.world.dep, exclude);
  }

  _usedTrafficKeys() {
    const used = new Set();
    for (const t of this.traffic || []) {
      if (t.phase === "gone" || t.phase === "cruise") continue;
      used.add(t.airline.id + "|" + t.spec.id);
    }
    return used;
  }

  /* Weighted pick, preferring types/liveries not already on the field. */
  _pickFreshTraffic(extraKey) {
    const avoid = this._usedTrafficKeys();
    if (extraKey) avoid.add(extraKey);
    return pickAirportTraffic(this.world.dep, null, { avoid });
  }

  _hubAirlineId() {
    const fleet = AIRPORT_FLEETS[this.world.dep.iata] || [];
    return fleet.length ? fleet[0][0] : null;
  }

  _holdingTraffic() {
    return (this.traffic || []).filter((t) => t.phase !== "gone" && t.phase !== "fade");
  }

  /* True while any traffic is using (or still over) the runway. */
  _runwayBusy() {
    return (this.traffic || []).some((t) => t.active);
  }

  _queueHint() {
    const holding = this._holdingTraffic();
    if (!holding.length) {
      this._depCleared = true;
      this.hud.setStatus("Cleared for takeoff — flaps (F), throttle up (D), and rotate (pull ↓) near " +
        Math.round(this.ac.spec.vRotate) + " kt.");
      return;
    }
    const rolling = this._runwayBusy();
    const ahead = this.traffic.filter((t) => t.phase !== "gone" && t.phase !== "fade").length;
    if (rolling) this.hud.setStatus("Traffic rolling — hold position.");
    else this.hud.setStatus("Hold position — number " + (ahead + 1) + " for departure.");
  }

  _updateTraffic(dt) {
    const list = this.traffic;
    if (!list || !list.length) return;
    const gy = this.world.groundElevation;
    const thresh = this.world.depRunwayStart;

    if (!this._runwayBusy()) {
      let next = null;
      for (const t of list) {
        if (t.phase !== "hold") continue;
        if (!next || t.x > next.x) next = t;
      }
      if (next) {
        next.wait -= dt;
        if (next.wait <= 0) {
          next.phase = "taxi";
          next.active = true;
          this._refreshQueueSlots();
        }
      }
    }

    for (const t of list) {
      if (t.phase === "gone") continue;
      t.update(dt, gy, thresh, this.world.depRunwayEnd);
    }

    if (!this._depCleared && !this._holdingTraffic().length) this._queueHint();
    else if (!this._depCleared && this.ac.onGround) this._queueHint();
  }

  _refreshQueueSlots() {
    const thresh = this.world.depRunwayStart;
    const holdShort = thresh - 80;
    const gap = 320;
    const waiting = this.traffic
      .filter((t) => t.phase === "hold" || t.phase === "advance")
      .sort((a, b) => b.x - a.x);
    waiting.forEach((t, i) => {
      t.goalX = holdShort - (i + 1) * gap;
      if (t.phase === "hold" && t.x < t.goalX - 20) {
        t.phase = "advance";
        t.wait = 0.4;
      }
    });
  }

  /* Hold short of the runway until traffic is gone, and don't nose into the jet ahead. */
  _holdForQueue() {
    const ac = this.ac;
    if (!ac || this._depCleared || !ac.onGround) return;
    const thresh = this.world.depRunwayStart;
    const holdShort = thresh - 40;
    if (ac.x > holdShort) {
      ac.x = holdShort;
      ac.vx = 0;
    }
    let nearest = null;
    for (const t of this.traffic) {
      if (t.phase === "gone" || t.phase === "fade") continue;
      if (!t.onGround && t.y - this.world.groundElevation > 40) continue;
      if (t.x <= ac.x) continue;
      if (!nearest || t.x < nearest.x) nearest = t;
    }
    if (!nearest) return;
    const minGap = 210;
    if (nearest.x - ac.x < minGap) {
      ac.x = nearest.x - minGap;
      ac.vx = 0;
    }
  }

  _updateFreeCam(dt) {
    const speed = (this.input.down("ShiftLeft") || this.input.down("ShiftRight")) ? 920 : 420;
    let dx = 0, dy = 0;
    if (this.input.down("KeyA") || this.input.down("ArrowLeft")) dx -= 1;
    if (this.input.down("KeyD") || this.input.down("ArrowRight")) dx += 1;
    if (this.input.down("KeyW") || this.input.down("ArrowUp")) dy += 1;
    if (this.input.down("KeyS") || this.input.down("ArrowDown")) dy -= 1;
    if (dx || dy) {
      const mag = Math.hypot(dx, dy) || 1;
      this.cam.x += (dx / mag) * speed * dt;
      this.cam.y += (dy / mag) * speed * dt;
    }
    if (this.input.down("KeyQ") || this.input.down("Minus")) {
      this.cam.scale = clamp(this.cam.scale - dt * 0.38, 0.18, 1.35);
    }
    if (this.input.down("KeyE") || this.input.down("Equal")) {
      this.cam.scale = clamp(this.cam.scale + dt * 0.38, 0.18, 1.35);
    }
    this._clampFreeCam();
    this._updateFreeCamTraffic(dt);
    this._updateSmoke(dt);
  }

  _spawnAirportTheater() {
    const gy = this.world.groundElevation;
    const slots = this.apron.slots;
    this.traffic = [];
    this._gateOcc = new Array(slots.length).fill(null);
    const nParked = Math.min(4, slots.length - 2);
    const hubId = this._hubAirlineId();
    const usedAl = new Set();
    for (let i = 0; i < nParked; i++) {
      const avoid = this._usedTrafficKeys();
      const pick = (i < 2 && hubId)
        ? pickAirportTraffic(this.world.dep, null, { airlineId: hubId, avoid })
        : pickAirportTraffic(this.world.dep, null, { avoid });
      usedAl.add(pick.airline.id);
      const t = new TrafficPlane(pick.spec, pick.airline, slots[i], gy);
      t.phase = "gate";
      t.facing = -1;
      t.gateSlot = i;
      t.goalX = slots[i];
      t.wait = 0.8 + (nParked - 1 - i) * 0.9 + Math.random() * 0.6;
      t.persist = true;
      this.traffic.push(t);
      this._gateOcc[i] = t;
    }
  }

  _freeGate() {
    for (let i = 0; i < this._gateOcc.length; i++) {
      if (!this._gateOcc[i]) return i;
    }
    return -1;
  }

  _pipelineBusy() {
    const block = new Set(["turn", "taxiOut", "hold", "advance", "taxi", "lineup", "spool", "roll", "approach", "rollout", "taxiIn"]);
    return this.traffic.some((t) => block.has(t.phase));
  }

  _findRecyclableCruiser() {
    const far = this.world.depRunwayEnd + 1800;
    return this.traffic.find((p) => {
      if (p.phase !== "cruise" || p.x < far) return false;
      return this.cam.worldToScreenX(p.x) > this.cam.w + 160;
    }) || null;
  }

  _updateFreeCamTraffic(dt) {
    const gy = this.world.groundElevation;
    const thresh = this.world.depRunwayStart;
    const list = this.traffic;

    for (const t of list) {
      if (t.phase === "gate") t.wait -= dt;
    }

    if (!this._runwayBusy()) {
      const ops = [];
      const freeGate = this._freeGate() >= 0;
      const inbound = list.some((t) => t.phase === "approach" || t.phase === "rollout");
      const canRecycle = !!this._findRecyclableCruiser();
      const canSpawnArr = freeGate && list.length < 8;
      if (freeGate && !inbound && (canRecycle || canSpawnArr)) ops.push("arrival");

      const holding = list.filter((t) => t.phase === "hold");
      if (holding.length) ops.push("depart");
      else if (!this._pipelineBusy()) {
        const ready = list.filter((t) => t.phase === "gate" && t.wait <= 0);
        if (ready.length) ops.push("push");
      }

      if (ops.length) {
        const op = ops[Math.floor(Math.random() * ops.length)];
        if (op === "arrival") {
          if (!this._recycleCruiserAsArrival()) this._spawnArrival(1300);
        } else if (op === "depart") {
          let next = holding[0];
          for (const t of holding) if (t.x > next.x) next = t;
          next.phase = "taxi";
          next.active = true;
        } else if (op === "push") {
          let next = null;
          for (const t of list) {
            if (t.phase !== "gate" || t.wait > 0) continue;
            if (!next || t.x > next.x) next = t;
          }
          if (next) {
            this._gateOcc[next.gateSlot] = null;
            next.gateSlot = -1;
            next.phase = "turn";
            next.wait = 0.35;
            next.turnTo = 1;
            next.afterTurn = "taxiOut";
            next.goalX = thresh - 90;
          }
        }
      }
    }

    this._nextAppear -= dt;
    if (this._nextAppear <= 0) this._nextAppear = 8;

    for (const t of list) {
      if (t.phase === "gone") continue;
      t.update(dt, gy, thresh, this.world.depRunwayEnd);
      if (t.justLanded) {
        t.justLanded = false;
        this._spawnPlaneSmoke(t);
      }
    }
  }

  _recycleCruiserAsArrival() {
    const slot = this._freeGate();
    if (slot < 0) return false;
    const t = this._findRecyclableCruiser();
    if (!t) return false;
    const gy = this.world.groundElevation;
    const thresh = this.world.depRunwayStart;
    const dist = 1300;
    t.phase = "approach";
    t.x = thresh - dist;
    t.y = gy + dist * 0.052;
    t.vx = (t.spec.vApproach || 138) / MS_TO_KT;
    t.vy = -t.vx * 0.052;
    t.pitch = rad(-2.4);
    t.alpha = 1;
    t.active = true;
    t.facing = 1;
    t.onGround = false;
    t.gearDown = true;
    t.flaps = Math.min(t.spec.flapNotches, 3);
    t.throttle = 0.38;
    t.gateSlot = slot;
    t.goalX = this.apron.slots[slot];
    t.wait = 0;
    t.handoff = null;
    const pick = this._pickFreshTraffic(t.airline.id + "|" + t.spec.id);
    t.spec = pick.spec;
    t.airline = pick.airline;
    t.flaps = Math.min(t.spec.flapNotches, 3);
    this._gateOcc[slot] = t;
    return true;
  }

  _spawnAtGate(slot) {
    const gy = this.world.groundElevation;
    const x = this.apron.slots[slot];
    const pick = this._pickTraffic();
    const t = new TrafficPlane(pick.spec, pick.airline, x, gy);
    t.phase = "appear";
    t.facing = -1;
    t.gateSlot = slot;
    t.goalX = x;
    t.alpha = 0;
    t.wait = 3 + Math.random() * 5;
    this.traffic.push(t);
    this._gateOcc[slot] = t;
  }

  _spawnArrival(dist) {
    const slot = this._freeGate();
    if (slot < 0) return;
    const gy = this.world.groundElevation;
    const thresh = this.world.depRunwayStart;
    const pick = this._pickTraffic();
    dist = dist || 2100;
    const t = new TrafficPlane(pick.spec, pick.airline, thresh - dist, gy + dist * 0.052);
    t.phase = "approach";
    t.facing = 1;
    t.onGround = false;
    t.gearDown = true;
    t.flaps = Math.min(t.spec.flapNotches, 3);
    t.goalX = this.apron.slots[slot];
    t.gateSlot = slot;
    t.active = true;
    t.persist = true;
    t.alpha = 1;
    t.vx = (t.spec.vApproach || 138) / MS_TO_KT;
    this.traffic.push(t);
    this._gateOcc[slot] = t;
  }

  _spawnPlaneSmoke(ac) {
    const gyw = this.world.groundElevation;
    const speed = ac.airspeed || ac.vx || 40;
    const spread = ac.spec.length * 0.7;
    for (let i = 0; i < 12; i++) {
      this.smoke.push({
        x: ac.x - ac.spec.length * 0.1 + (Math.random() - 0.5) * spread,
        y: gyw + Math.random() * 1.5,
        vx: -speed * 0.12 - Math.random() * 4,
        vy: 2.5 + Math.random() * 6,
        r: ac.spec.length * (0.12 + Math.random() * 0.18),
        age: 0,
        ttl: 0.9 + Math.random() * 0.9,
      });
    }
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
    if (this.traffic) {
      for (const t of this.traffic) {
        if (t.phase === "gone") continue;
        this._paintPlane(ctx, t, t.alpha);
      }
    }
    if (this.ac) this._paintPlane(ctx, this.ac, 1);
    this._drawSmoke(ctx);
  }

  _paintPlane(ctx, ac, alpha) {
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
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(sx, sy);
    ctx.rotate(-ac.pitch); // screen y is inverted
    if ((ac.facing || 1) < 0) ctx.scale(-1, 1);
    ctx.translate(0, -contactY); // lift body so wheels pivot on the ground point
    this._drawPlaneBody(ctx, ac, px);
    ctx.restore();

    if (alpha < 0.2) return;
    if (ac.phase === "gate" || ac.phase === "appear") return;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = "rgba(9,15,28,0.7)";
    ctx.font = "700 12px system-ui, sans-serif";
    const tag = `${ac.airline.code} · ${ac.spec.name}`;
    const tw = ctx.measureText(tag).width;
    ctx.fillText(tag, sx - tw / 2, sy - px * 0.72);
    ctx.restore();
  }

  /* Detailed side-view airliner/GA drawing in local (nose-right) coordinates. */
  _drawPlaneBody(ctx, ac, L) {
    const spec = ac.spec;
    const H = L * (spec.wide ? 0.14 : 0.115);
    const al = ac.airline;
    const body = al.fuselage;
    const belly = al.belly || shade(body, -14);
    const tail = al.tail;
    const accent = al.accent;
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

    // ---- Horizontal stabilizer ----
    ctx.fillStyle = shade(body, -10);
    ctx.beginPath();
    ctx.moveTo(-L * 0.34, -H * 0.2);
    ctx.lineTo(-L * 0.52, -H * 0.9);
    ctx.lineTo(-L * 0.40, -H * 0.9);
    ctx.lineTo(-L * 0.30, -H * 0.2);
    ctx.closePath();
    ctx.fill();

    // ---- Vertical tail fin + airline artwork ----
    this._tailFinPath(ctx, L, H);
    ctx.fillStyle = tail;
    ctx.fill();
    this._drawTailMark(ctx, al, L, H);

    // ---- Wing (behind fuselage), swept for jets ----
    const wingY = highWing ? -H * 0.7 : H * 0.55;
    const wingDrop = highWing ? -1 : 1;
    ctx.fillStyle = shade(body, -16);
    ctx.beginPath();
    ctx.moveTo(L * 0.14, wingY);
    ctx.lineTo(-L * 0.30, wingY + wingDrop * H * (isJet ? 1.5 : 1.1));
    ctx.lineTo(-L * 0.14, wingY + wingDrop * H * (isJet ? 1.5 : 1.1));
    ctx.lineTo(L * 0.30, wingY);
    ctx.closePath();
    ctx.fill();

    if (spec.winglets) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.30, wingY + wingDrop * H * 1.5);
      ctx.lineTo(-L * 0.33, wingY + wingDrop * H * 2.1);
      ctx.lineTo(-L * 0.27, wingY + wingDrop * H * 2.1);
      ctx.closePath();
      ctx.fill();
    }

    this._drawEngines(ctx, ac, L, H, wingY, wingDrop);

    // ---- Fuselage ----
    this._fuselagePath(ctx, L, H);
    ctx.fillStyle = body;
    ctx.fill();

    // Belly, cheatline and titles clipped to the body.
    ctx.save();
    this._fuselagePath(ctx, L, H);
    ctx.clip();
    ctx.fillStyle = belly;
    const bellyTop = al.cheat === "split" ? H * 0.15 : H * 0.22;
    ctx.fillRect(-L * 0.52, bellyTop, L * 1.06, H * 1.2);
    this._drawCheat(ctx, al, L, H);
    this._drawTitles(ctx, al, L, H, ac.facing);
    ctx.restore();

    // Subtle belly shading for volume.
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#000";
    this._fuselagePath(ctx, L, H);
    ctx.clip();
    ctx.fillRect(-L * 0.52, H * 0.35, L * 1.06, H);
    ctx.restore();

    // ---- Cockpit windows ----
    ctx.fillStyle = "#0f2233";
    ctx.beginPath();
    ctx.moveTo(L * 0.46, -H * 0.28);
    ctx.lineTo(L * 0.33, -H * 0.55);
    ctx.lineTo(L * 0.30, -H * 0.18);
    ctx.closePath();
    ctx.fill();

    // ---- Cabin windows ----
    ctx.fillStyle = "rgba(150,200,235,0.95)";
    const count = spec.engineType === "prop" ? 4 : (spec.wide ? 14 : 9);
    const startX = L * 0.28, endX = -L * 0.28;
    const winY = -H * 0.18;
    const wsz = Math.max(1.2, H * 0.22);
    for (let i = 0; i < count; i++) {
      const wx = lerp(startX, endX, i / (count - 1));
      ctx.fillRect(wx - wsz / 2, winY, wsz, wsz * 1.3);
    }

    // ---- Landing gear ----
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

  _fuselagePath(ctx, L, H) {
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.quadraticCurveTo(L * 0.44, -H, L * 0.18, -H);
    ctx.lineTo(-L * 0.30, -H * 0.92);
    ctx.quadraticCurveTo(-L * 0.5, -H * 0.55, -L * 0.5, 0);
    ctx.quadraticCurveTo(-L * 0.5, H * 0.55, -L * 0.30, H * 0.92);
    ctx.lineTo(L * 0.18, H);
    ctx.quadraticCurveTo(L * 0.44, H, L * 0.5, 0);
    ctx.closePath();
  }

  _tailFinPath(ctx, L, H) {
    ctx.beginPath();
    ctx.moveTo(-L * 0.42, -H * 0.7);
    ctx.quadraticCurveTo(-L * 0.50, -H * 2.9, -L * 0.40, -H * 2.9);
    ctx.lineTo(-L * 0.26, -H * 0.7);
    ctx.closePath();
  }

  _drawCheat(ctx, al, L, H) {
    const cheat = al.cheat || "thin";
    const accent = al.accent;
    const accent2 = al.accent2;
    if (cheat === "none") return;

    if (cheat === "split") {
      ctx.fillStyle = accent;
      ctx.fillRect(-L * 0.48, H * 0.02, L * 0.96, H * 0.22);
      return;
    }
    if (cheat === "band") {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(-L * 0.40, -H * 0.16, L * 0.78, H * 0.28);
      ctx.globalAlpha = 1;
      return;
    }
    if (cheat === "flag3") {
      const h = H * 0.14;
      ctx.fillStyle = "#078930";
      ctx.fillRect(-L * 0.38, -H * 0.08, L * 0.74, h);
      ctx.fillStyle = accent;
      ctx.fillRect(-L * 0.38, -H * 0.08 + h, L * 0.74, h);
      ctx.fillStyle = accent2 || "#da121a";
      ctx.fillRect(-L * 0.38, -H * 0.08 + h * 2, L * 0.74, h);
      return;
    }
    if (cheat === "ribbon") {
      ctx.strokeStyle = al.tail;
      ctx.lineWidth = Math.max(1.4, H * 0.16);
      ctx.beginPath();
      ctx.moveTo(L * 0.28, -H * 0.12);
      ctx.quadraticCurveTo(L * 0.12, -H * 0.55, -L * 0.02, -H * 0.10);
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.moveTo(L * 0.26, -H * 0.02);
      ctx.quadraticCurveTo(L * 0.10, -H * 0.38, -L * 0.04, 0);
      ctx.stroke();
      return;
    }

    const clw = Math.max(1.5, H * (cheat === "dual" ? 0.18 : 0.22));
    ctx.lineWidth = clw;
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-L * 0.36, -H * 0.02);
    ctx.lineTo(L * 0.40, -H * 0.06);
    ctx.stroke();
    if (cheat === "dual" && accent2) {
      ctx.strokeStyle = accent2;
      ctx.beginPath();
      ctx.moveTo(-L * 0.36, -H * 0.02 + clw);
      ctx.lineTo(L * 0.40, -H * 0.06 + clw);
      ctx.stroke();
    }
  }

  _drawTitles(ctx, al, L, H, facing) {
    const text = al.titles;
    if (!text || H < 7) return;
    ctx.save();
    ctx.fillStyle = al.titleColor || "#1a1a1a";
    ctx.font = `800 ${Math.max(7, H * 0.52)}px system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    if ((facing || 1) < 0) {
      ctx.scale(-1, 1);
      ctx.textAlign = "right";
      ctx.fillText(text, L * 0.08, -H * 0.52);
    } else {
      ctx.textAlign = "left";
      ctx.fillText(text, -L * 0.08, -H * 0.52);
    }
    ctx.restore();
  }

  _drawTailMark(ctx, al, L, H) {
    const mark = al.tailMark || "none";
    if (mark === "none") return;
    ctx.save();
    this._tailFinPath(ctx, L, H);
    ctx.clip();
    const cx = -L * 0.38, cy = -H * 1.7;
    const s = H;

    if (mark === "aa-flag") {
      const x0 = -L * 0.48, x1 = -L * 0.26, w = x1 - x0;
      ctx.fillStyle = "#0a3161"; ctx.fillRect(x0 + w * 0.55, -H * 3.0, w * 0.5, H * 2.6);
      ctx.fillStyle = "#f4f6f8"; ctx.fillRect(x0 + w * 0.28, -H * 3.0, w * 0.32, H * 2.6);
      ctx.fillStyle = "#c8102e"; ctx.fillRect(x0, -H * 3.0, w * 0.32, H * 2.6);
    } else if (mark === "widget") {
      ctx.fillStyle = al.accent;
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.55, cy);
      ctx.lineTo(cx - s * 0.55, cy - s * 0.85);
      ctx.lineTo(cx - s * 0.55, cy + s * 0.85);
      ctx.closePath();
      ctx.fill();
    } else if (mark === "globe") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1.2, s * 0.12);
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.55, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.22, s * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke();
    } else if (mark === "heart") {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx - s * 0.22, cy - s * 0.05, s * 0.28, 0, Math.PI * 2);
      ctx.arc(cx + s * 0.22, cy - s * 0.05, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.48, cy + s * 0.05);
      ctx.lineTo(cx, cy + s * 0.7);
      ctx.lineTo(cx + s * 0.48, cy + s * 0.05);
      ctx.closePath();
      ctx.fill();
    } else if (mark === "mosaic") {
      const cols = ["#68b8e8", "#2ba6df", "#7ec8f0", "#1a6f9e"];
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(cx - s * 0.5 + (i % 3) * s * 0.38, cy - s * 0.7 + Math.floor(i / 3) * s * 0.42, s * 0.32, s * 0.32);
      }
    } else if (mark === "union") {
      ctx.strokeStyle = "#c8102e";
      ctx.lineWidth = Math.max(2, s * 0.22);
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.6, cy - s * 0.9);
      ctx.quadraticCurveTo(cx, cy, cx + s * 0.5, cy + s * 0.9);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1.4, s * 0.12);
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.45, cy - s * 0.7);
      ctx.quadraticCurveTo(cx - s * 0.1, cy + s * 0.1, cx + s * 0.35, cy + s * 0.75);
      ctx.stroke();
    } else if (mark === "crane") {
      ctx.fillStyle = al.accent;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.22, s * 0.55, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.1, cy);
      ctx.quadraticCurveTo(cx - s * 0.7, cy - s * 0.2, cx - s * 0.15, cy - s * 0.55);
      ctx.quadraticCurveTo(cx + s * 0.05, cy - s * 0.15, cx - s * 0.1, cy);
      ctx.fill();
    } else if (mark === "tricolor") {
      const x = -L * 0.48;
      ctx.fillStyle = "#002157"; ctx.fillRect(x, -H * 3, L * 0.05, H * 2.5);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(x + L * 0.05, -H * 3, L * 0.045, H * 2.5);
      ctx.fillStyle = "#ef3340"; ctx.fillRect(x + L * 0.095, -H * 3, L * 0.05, H * 2.5);
    } else if (mark === "crown") {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.45, cy + s * 0.25);
      ctx.lineTo(cx - s * 0.45, cy - s * 0.05);
      ctx.lineTo(cx - s * 0.2, cy + s * 0.12);
      ctx.lineTo(cx, cy - s * 0.45);
      ctx.lineTo(cx + s * 0.2, cy + s * 0.12);
      ctx.lineTo(cx + s * 0.45, cy - s * 0.05);
      ctx.lineTo(cx + s * 0.45, cy + s * 0.25);
      ctx.closePath();
      ctx.fill();
    } else if (mark === "arabic") {
      ctx.strokeStyle = al.accent;
      ctx.lineWidth = Math.max(1.6, s * 0.16);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.45, cy + s * 0.15);
      ctx.quadraticCurveTo(cx - s * 0.1, cy - s * 0.7, cx + s * 0.5, cy - s * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.35, cy + s * 0.4);
      ctx.quadraticCurveTo(cx + s * 0.05, cy - s * 0.15, cx + s * 0.4, cy + s * 0.35);
      ctx.stroke();
    } else if (mark === "bird") {
      ctx.fillStyle = al.accent;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.15);
      ctx.quadraticCurveTo(cx - s * 0.7, cy + s * 0.2, cx - s * 0.15, cy + s * 0.45);
      ctx.quadraticCurveTo(cx, cy + s * 0.1, cx + s * 0.15, cy + s * 0.45);
      ctx.quadraticCurveTo(cx + s * 0.7, cy + s * 0.2, cx, cy - s * 0.15);
      ctx.fill();
    } else if (mark === "roo") {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.05, cy + s * 0.1, s * 0.28, s * 0.42, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.15, cy + s * 0.2);
      ctx.quadraticCurveTo(cx - s * 0.55, cy + s * 0.55, cx - s * 0.2, cy + s * 0.7);
      ctx.quadraticCurveTo(cx - s * 0.05, cy + s * 0.4, cx - s * 0.15, cy + s * 0.2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.18, cy - s * 0.35, s * 0.16, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (mark === "tsuru") {
      ctx.fillStyle = al.accent;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.15, cy - s * 0.1);
      ctx.quadraticCurveTo(cx - s * 0.4, cy - s * 0.2, cx - s * 0.1, cy + s * 0.35);
      ctx.quadraticCurveTo(cx + s * 0.05, cy, cx + s * 0.35, cy + s * 0.25);
      ctx.closePath();
      ctx.fill();
    } else if (mark === "maple") {
      ctx.fillStyle = al.accent;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.7);
      ctx.lineTo(cx + s * 0.18, cy - s * 0.28);
      ctx.lineTo(cx + s * 0.55, cy - s * 0.32);
      ctx.lineTo(cx + s * 0.28, cy + s * 0.05);
      ctx.lineTo(cx + s * 0.38, cy + s * 0.45);
      ctx.lineTo(cx, cy + s * 0.18);
      ctx.lineTo(cx - s * 0.38, cy + s * 0.45);
      ctx.lineTo(cx - s * 0.28, cy + s * 0.05);
      ctx.lineTo(cx - s * 0.55, cy - s * 0.32);
      ctx.lineTo(cx - s * 0.18, cy - s * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - s * 0.07, cy + s * 0.15, s * 0.14, s * 0.45);
    } else if (mark === "eth-flag") {
      ctx.fillStyle = "#078930"; ctx.fillRect(-L * 0.5, -H * 3, L * 0.28, H * 0.85);
      ctx.fillStyle = "#fcd116"; ctx.fillRect(-L * 0.5, -H * 2.15, L * 0.28, H * 0.85);
      ctx.fillStyle = "#da121a"; ctx.fillRect(-L * 0.5, -H * 1.3, L * 0.28, H * 0.85);
    } else if (mark === "kq") {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.4, cy);
      ctx.quadraticCurveTo(cx, cy - s * 0.7, cx - s * 0.45, cy - s * 0.1);
      ctx.quadraticCurveTo(cx, cy + s * 0.15, cx + s * 0.4, cy);
      ctx.fill();
    } else if (mark === "thy") {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c8102e";
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.38, cy);
      ctx.quadraticCurveTo(cx, cy - s * 0.55, cx - s * 0.42, cy - s * 0.05);
      ctx.quadraticCurveTo(cx - s * 0.05, cy + s * 0.08, cx + s * 0.1, cy + s * 0.22);
      ctx.quadraticCurveTo(cx + s * 0.28, cy + s * 0.12, cx + s * 0.38, cy);
      ctx.fill();
    } else if (mark === "pegasus") {
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.1, cy, s * 0.28, s * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.05, cy - s * 0.1);
      ctx.quadraticCurveTo(cx - s * 0.7, cy - s * 0.5, cx - s * 0.2, cy + s * 0.35);
      ctx.quadraticCurveTo(cx - s * 0.05, cy + s * 0.1, cx - s * 0.05, cy - s * 0.1);
      ctx.fill();
    } else if (mark === "oryx") {
      ctx.fillStyle = "#f4f7fa";
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.05, cy + s * 0.12, s * 0.22, s * 0.32, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.12, cy - s * 0.15);
      ctx.quadraticCurveTo(cx - s * 0.05, cy - s * 0.7, cx - s * 0.35, cy - s * 0.55);
      ctx.quadraticCurveTo(cx, cy - s * 0.35, cx + s * 0.12, cy - s * 0.15);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.22, cy - s * 0.18, s * 0.14, s * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (mark === "iberia") {
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(cx - s * 0.55, cy - s * 0.18, s * 1.1, s * 0.22);
      ctx.fillStyle = "#d7042c";
      ctx.fillRect(cx - s * 0.55, cy + s * 0.04, s * 1.1, s * 0.14);
    } else if (mark === "harp") {
      ctx.fillStyle = "#073590";
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#073590";
      ctx.lineWidth = Math.max(1.4, s * 0.12);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.05, cy - s * 0.55);
      ctx.quadraticCurveTo(cx + s * 0.45, cy, cx - s * 0.05, cy + s * 0.55);
      ctx.stroke();
    } else if (mark === "latam") {
      ctx.fillStyle = "#e0001b";
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.45, cy + s * 0.35);
      ctx.quadraticCurveTo(cx - s * 0.1, cy - s * 0.7, cx + s * 0.5, cy - s * 0.15);
      ctx.quadraticCurveTo(cx + s * 0.15, cy + s * 0.15, cx - s * 0.45, cy + s * 0.35);
      ctx.fill();
    } else if (mark === "taegeuk") {
      ctx.fillStyle = "#c8102e";
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.42, Math.PI, 0, false);
      ctx.fill();
      ctx.fillStyle = "#003478";
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.42, 0, Math.PI, false);
      ctx.fill();
      ctx.fillStyle = "#c8102e";
      ctx.beginPath();
      ctx.arc(cx - s * 0.21, cy, s * 0.21, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#003478";
      ctx.beginPath();
      ctx.arc(cx + s * 0.21, cy, s * 0.21, 0, Math.PI * 2);
      ctx.fill();
    } else if (mark === "sas") {
      ctx.fillStyle = "#c5a35a";
      ctx.fillRect(cx - s * 0.5, cy - s * 0.12, s, s * 0.1);
      ctx.fillRect(cx - s * 0.5, cy + s * 0.08, s, s * 0.1);
      ctx.fillStyle = "#f4f7fa";
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.55);
      ctx.lineTo(cx + s * 0.18, cy - s * 0.18);
      ctx.lineTo(cx + s * 0.55, cy - s * 0.18);
      ctx.lineTo(cx + s * 0.22, cy + s * 0.05);
      ctx.lineTo(cx + s * 0.34, cy + s * 0.5);
      ctx.lineTo(cx, cy + s * 0.22);
      ctx.lineTo(cx - s * 0.34, cy + s * 0.5);
      ctx.lineTo(cx - s * 0.22, cy + s * 0.05);
      ctx.lineTo(cx - s * 0.55, cy - s * 0.18);
      ctx.lineTo(cx - s * 0.18, cy - s * 0.18);
      ctx.closePath();
      ctx.fill();
    } else if (mark === "chakra") {
      ctx.strokeStyle = "#f4f7fa";
      ctx.lineWidth = Math.max(1.4, s * 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * s * 0.42, cy + Math.sin(a) * s * 0.42);
        ctx.stroke();
      }
    } else if (mark === "eagle") {
      ctx.fillStyle = "#c8102e";
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.55);
      ctx.quadraticCurveTo(cx + s * 0.55, cy - s * 0.1, cx + s * 0.15, cy + s * 0.45);
      ctx.lineTo(cx, cy + s * 0.2);
      ctx.lineTo(cx - s * 0.15, cy + s * 0.45);
      ctx.quadraticCurveTo(cx - s * 0.55, cy - s * 0.1, cx, cy - s * 0.55);
      ctx.fill();
    } else if (mark === "brushwing") {
      ctx.fillStyle = "#f4f7fa";
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.5, cy + s * 0.15);
      ctx.quadraticCurveTo(cx - s * 0.1, cy - s * 0.65, cx + s * 0.55, cy - s * 0.25);
      ctx.quadraticCurveTo(cx + s * 0.1, cy + s * 0.05, cx - s * 0.5, cy + s * 0.15);
      ctx.fill();
    } else if (mark === "ana") {
      ctx.fillStyle = "#f4f7fa";
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#003da5";
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    } else if (mark === "ezy") {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff6600";
      ctx.fillRect(cx - s * 0.22, cy - s * 0.08, s * 0.44, s * 0.16);
    } else if (mark === "lady") {
      ctx.fillStyle = "#f4f7fa";
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.1, cy + s * 0.5);
      ctx.quadraticCurveTo(cx - s * 0.45, cy - s * 0.1, cx - s * 0.05, cy - s * 0.55);
      ctx.quadraticCurveTo(cx + s * 0.45, cy - s * 0.2, cx + s * 0.2, cy + s * 0.45);
      ctx.closePath();
      ctx.fill();
    } else if (mark === "face") {
      ctx.fillStyle = "#f4f7fa";
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#01426a";
      ctx.beginPath();
      ctx.arc(cx - s * 0.14, cy - s * 0.08, s * 0.07, 0, Math.PI * 2);
      ctx.arc(cx + s * 0.14, cy - s * 0.08, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#01426a";
      ctx.lineWidth = Math.max(1.4, s * 0.08);
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.08, s * 0.22, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else if (mark === "koru") {
      ctx.strokeStyle = "#f4f7fa";
      ctx.lineWidth = Math.max(2.2, s * 0.16);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.38, 0.4, Math.PI * 1.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + s * 0.08, cy - s * 0.05, s * 0.16, Math.PI * 0.2, Math.PI * 1.5);
      ctx.stroke();
    } else if (mark === "orchid") {
      ctx.fillStyle = "#c5a35a";
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * s * 0.18, cy + Math.sin(a) * s * 0.18, s * 0.16, s * 0.28, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (mark === "horus") {
      ctx.fillStyle = "#c8a24a";
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.45, cy + s * 0.1);
      ctx.quadraticCurveTo(cx - s * 0.1, cy - s * 0.55, cx + s * 0.5, cy - s * 0.2);
      ctx.quadraticCurveTo(cx + s * 0.15, cy + s * 0.15, cx - s * 0.45, cy + s * 0.1);
      ctx.fill();
      ctx.fillStyle = "#f4f7fa";
      ctx.beginPath();
      ctx.arc(cx + s * 0.18, cy - s * 0.12, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
      ctx.fillStyle = ac.airline.engine || "#374151";
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
    ctx.fillStyle = ac.airline.engine || shade(ac.airline.fuselage, -28);
    roundRect(ctx, -L * 0.02, ey - eh / 2, ew, eh, eh * 0.45);
    ctx.fill();
    ctx.fillStyle = "#0f1620";
    ctx.beginPath();
    ctx.ellipse(-L * 0.02 + ew, ey, eh * 0.16, eh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(ac.airline.engine || ac.airline.fuselage, -40);
    ctx.beginPath();
    ctx.ellipse(-L * 0.02, ey, eh * 0.12, eh * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _showMessage(titleHtml, bodyHtml, withButtons) {
    this.messageEl.innerHTML = `<h2>${titleHtml}</h2>${bodyHtml}`;
    this.messageEl.classList.remove("hidden");
  }
  _hideMessage() { this.messageEl.classList.add("hidden"); }
}

/* Scripted departure traffic: hold, spool, roll, climb, fade. */
class TrafficPlane {
  constructor(spec, airline, x, groundY) {
    this.spec = spec;
    this.airline = airline;
    this.x = x;
    this.y = groundY;
    this.vx = 0;
    this.vy = 0;
    this.pitch = 0;
    this.throttle = 0;
    this.flaps = Math.min(2, spec.flapNotches);
    this.gearDown = true;
    this.onGround = true;
    this.airspeed = 0;
    this.phase = "hold";
    this.alpha = 1;
    this.wait = 0;
    this.goalX = x;
    this.active = false;
    this.facing = 1;
    this.gateSlot = -1;
    this.turnTo = 1;
    this.afterTurn = "taxiOut";
    this.justLanded = false;
    this.handoff = null;
    this.persist = false;
  }

  update(dt, groundY, thresh, runwayEnd) {
    const vr = (this.spec.vRotate || 145) / MS_TO_KT;
    const taxiSpeed = 16; // ~31 kt — taxi, not a takeoff roll
    const runLen = Math.max(900, (runwayEnd != null ? runwayEnd : thresh + 2500) - thresh);
    const rollMin = clamp(runLen * 0.28, 850, 1500);
    const rolloutMin = clamp(runLen * 0.2, 550, 1000);
    const lineupX = thresh + 120;

    if (this.phase === "gate" || this.phase === "appear") {
      this.throttle = 0;
      this.vx = 0;
      this.pitch = 0;
      this.y = groundY;
      this.onGround = true;
      this.airspeed = 0;
      this.facing = -1;
      if (this.phase === "appear") {
        this.alpha = Math.min(1, this.alpha + dt / 1.15);
        if (this.alpha >= 1) this.phase = "gate";
      }
      return;
    }

    if (this.phase === "turn") {
      this.throttle = 0;
      this.vx = 0;
      this.y = groundY;
      this.onGround = true;
      this.airspeed = 0;
      if (this.afterTurn === "taxiIn") this.active = true;
      this.wait -= dt;
      if (this.wait <= 0) {
        this.facing = this.turnTo || 1;
        this.phase = this.afterTurn || "taxiOut";
      }
      return;
    }

    if (this.phase === "taxiOut") {
      this.facing = 1;
      this.throttle = 0.14;
      this.vx = lerp(this.vx, taxiSpeed, 1 - Math.exp(-dt * 4));
      this.x += this.vx * dt;
      this.airspeed = this.vx;
      this.y = groundY;
      this.onGround = true;
      this.pitch = 0;
      if (this.x >= this.goalX) {
        this.x = this.goalX;
        this.vx = 0;
        this.throttle = 0;
        this.airspeed = 0;
        this.phase = "hold";
        this.wait = 0.35;
      }
      return;
    }

    if (this.phase === "approach") {
      this.facing = 1;
      this.onGround = false;
      this.gearDown = true;
      this.active = true;
      const spd = (this.spec.vApproach || 138) / MS_TO_KT;
      this.vx = spd;
      this.x += this.vx * dt;
      const remain = (thresh + 80) - this.x;
      const alt = Math.max(0, remain * 0.052);
      this.y = groundY + alt;
      this.vy = -spd * 0.052;
      this.pitch = rad(-2.4);
      this.airspeed = Math.hypot(this.vx, this.vy);
      this.throttle = 0.38;
      if (remain <= 0 || this.y <= groundY + 1.5) {
        this.y = groundY;
        this.onGround = true;
        this.pitch = 0;
        this.phase = "rollout";
        this.justLanded = true;
        this.airspeed = this.vx;
      }
      return;
    }

    if (this.phase === "rollout") {
      this.facing = 1;
      this.onGround = true;
      this.y = groundY;
      this.throttle = 0;
      this.active = true;
      this.pitch = 0;
      this.vx = Math.max(taxiSpeed, this.vx - 7.5 * dt);
      this.x += this.vx * dt;
      this.airspeed = this.vx;
      if (this.x >= thresh + rolloutMin && this.vx <= taxiSpeed + 1.5) {
        this.phase = "turn";
        this.wait = 0.55;
        this.turnTo = -1;
        this.afterTurn = "taxiIn";
      }
      return;
    }

    if (this.phase === "taxiIn") {
      this.facing = -1;
      this.throttle = 0.14;
      this.vx = lerp(this.vx, -taxiSpeed, 1 - Math.exp(-dt * 3));
      this.x += this.vx * dt;
      this.airspeed = Math.abs(this.vx);
      this.y = groundY;
      this.onGround = true;
      this.pitch = 0;
      this.active = this.x > thresh - 40;
      if (this.x <= this.goalX) {
        this.x = this.goalX;
        this.vx = 0;
        this.airspeed = 0;
        this.throttle = 0;
        this.active = false;
        this.phase = "gate";
        this.wait = 4 + Math.random() * 6;
      }
      return;
    }

    if (this.phase === "hold") {
      this.throttle = 0;
      this.vx = 0;
      this.pitch = 0;
      this.y = groundY;
      this.onGround = true;
      return;
    }

    if (this.phase === "advance") {
      this.wait -= dt;
      if (this.wait > 0) return;
      this.throttle = 0.14;
      this.vx = lerp(this.vx, taxiSpeed, 1 - Math.exp(-dt * 4));
      this.x += this.vx * dt;
      this.airspeed = this.vx;
      this.y = groundY;
      this.onGround = true;
      this.pitch = 0;
      if (this.x >= this.goalX) {
        this.x = this.goalX;
        this.vx = 0;
        this.throttle = 0;
        this.airspeed = 0;
        this.phase = "hold";
      }
      return;
    }

    if (this.phase === "taxi") {
      this.facing = 1;
      this.y = groundY;
      this.onGround = true;
      this.pitch = 0;
      if (this.x >= lineupX) {
        this.throttle = 0.06;
        this.vx *= Math.exp(-dt * 7);
        this.x += this.vx * dt;
        this.airspeed = this.vx;
        if (this.vx < 2.2) {
          this.vx = 0;
          this.airspeed = 0;
          this.x = lineupX;
          this.phase = "lineup";
          this.wait = 0.7;
        }
        return;
      }
      this.throttle = 0.16;
      this.vx = lerp(this.vx, taxiSpeed, 1 - Math.exp(-dt * 4));
      this.x += this.vx * dt;
      this.airspeed = this.vx;
      return;
    }

    if (this.phase === "lineup") {
      this.throttle = 0.12;
      this.vx = 0;
      this.airspeed = 0;
      this.y = groundY;
      this.onGround = true;
      this.pitch = 0;
      this.x = lineupX;
      this.wait -= dt;
      if (this.wait <= 0) this.phase = "spool";
      return;
    }

    if (this.phase === "spool") {
      this.y = groundY;
      this.onGround = true;
      this.pitch = 0;
      this.vx = 0;
      this.airspeed = 0;
      this.x = lineupX;
      this.throttle = Math.min(1, this.throttle + dt * 1.15);
      if (this.throttle >= 0.95) this.phase = "roll";
      return;
    }

    if (this.phase === "roll") {
      this.throttle = 1;
      this.onGround = true;
      this.y = groundY;
      this.pitch = 0;
      this.vx = Math.min(this.vx + 5.4 * dt, vr * 1.03);
      this.x += this.vx * dt;
      this.airspeed = this.vx;
      const onRunway = this.x >= thresh + 80;
      const farEnough = this.x >= thresh + rollMin;
      if (onRunway && farEnough && this.vx >= vr * 0.95) this.phase = "climb";
      return;
    }

    if (this.phase === "climb") {
      // Never rotate off the taxiway — dump back into the roll if we got here early.
      if (this.x < thresh + 400) {
        this.phase = "roll";
        this.onGround = true;
        this.pitch = 0;
        this.y = groundY;
        return;
      }
      this.throttle = 1;
      this.onGround = false;
      this.pitch = lerp(this.pitch, rad(12), 1 - Math.exp(-dt * 3.4));
      this.vx = Math.max(this.vx, vr * 1.1);
      this.vy = 32;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.airspeed = Math.hypot(this.vx, this.vy);
      if (this.y - groundY > 22) this.gearDown = false;
      if (this.y - groundY > 150) {
        this.active = false;
        this.handoff = "arrival";
        this.phase = this.persist ? "cruise" : "fade";
      }
      return;
    }

    if (this.phase === "cruise") {
      this.active = false;
      this.onGround = false;
      this.gearDown = false;
      this.alpha = 1;
      this.throttle = 0.72;
      this.pitch = lerp(this.pitch, rad(3.5), 1 - Math.exp(-dt * 1.1));
      this.vy = lerp(this.vy, 3, 1 - Math.exp(-dt * 0.9));
      this.vx = Math.max(this.vx, vr * 1.12);
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.airspeed = Math.hypot(this.vx, this.vy);
      return;
    }

    if (this.phase === "fade") {
      this.active = false;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.alpha = Math.max(0, this.alpha - dt / 1.5);
      if (this.alpha <= 0) this.phase = "gone";
    }
  }
}

/* Lighten/darken a hex color by an amount (-100..100). */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt / 100;
  const adj = (x) => Math.round(clamp(x + (f < 0 ? x * f : (255 - x) * f), 0, 255));
  return `rgb(${adj(r)},${adj(g)},${adj(b)})`;
}
