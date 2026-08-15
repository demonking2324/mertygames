/* ============================================================
 * MobileControls — on-screen touch controls (throttle, pitch
 * joystick, and gear/flap/brake/menu/pause buttons) that drive
 * the same Input the keyboard uses.
 * ============================================================ */

class MobileControls {
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.dragThrottle = false;
    this.dragStick = false;

    this._build();
    this._wirePreference();
    game.mobile = this;
  }

  /* Detect whether this looks like a touch device (best-effort). */
  _detectTouch() {
    return (
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 820
    );
  }

  setEnabled(on) {
    this.enabled = !!on;
    document.body.classList.toggle("touch", this.enabled);
  }

  /* The menu toggle overrides auto-detection and is remembered. */
  _wirePreference() {
    const box = document.getElementById("touch-toggle");
    let saved = null;
    try { saved = localStorage.getItem("touchControls"); } catch (e) {}
    const enabled = saved === null ? this._detectTouch() : saved === "on";
    this.setEnabled(enabled);
    if (box) {
      box.checked = enabled;
      box.addEventListener("change", () => {
        this.setEnabled(box.checked);
        try { localStorage.setItem("touchControls", box.checked ? "on" : "off"); } catch (e) {}
      });
    }
  }

  _build() {
    const host = document.getElementById("game");
    const wrap = document.createElement("div");
    wrap.className = "mobile-controls";
    wrap.innerHTML = `
      <div class="mc-throttle" id="mc-throttle">
        <div class="mc-th-fill" id="mc-th-fill"></div>
        <div class="mc-th-knob" id="mc-th-knob"></div>
        <div class="mc-cap"><span id="mc-th-val">0</span>%<br>THR</div>
      </div>

      <div class="mc-stick" id="mc-stick">
        <div class="mc-stick-knob" id="mc-stick-knob"></div>
        <div class="mc-cap mc-cap-stick">PITCH</div>
      </div>

      <div class="mc-buttons">
        <button class="mc-btn mc-sm" id="mc-menu">☰</button>
        <button class="mc-btn mc-sm" id="mc-pause">❚❚</button>
        <button class="mc-btn" id="mc-flapdn">FLAP −</button>
        <button class="mc-btn" id="mc-flapup">FLAP +</button>
        <span class="mc-chip" id="mc-flaps">FLAPS 0</span>
        <button class="mc-btn" id="mc-gear">GEAR DN</button>
        <button class="mc-btn mc-brake" id="mc-brake">BRK</button>
      </div>
    `;
    host.appendChild(wrap);

    this.thEl = wrap.querySelector("#mc-throttle");
    this.thKnob = wrap.querySelector("#mc-th-knob");
    this.thFill = wrap.querySelector("#mc-th-fill");
    this.thVal = wrap.querySelector("#mc-th-val");
    this.stick = wrap.querySelector("#mc-stick");
    this.stickKnob = wrap.querySelector("#mc-stick-knob");
    this.gearBtn = wrap.querySelector("#mc-gear");
    this.flapsChip = wrap.querySelector("#mc-flaps");
    this.brakeBtn = wrap.querySelector("#mc-brake");

    this._wireThrottle();
    this._wireStick();
    this._wireButtons();
    this._renderThrottle(0);
  }

  /* ---- Throttle (vertical slider) ---- */
  _wireThrottle() {
    const el = this.thEl;
    const set = (clientY) => {
      const r = el.getBoundingClientRect();
      const pad = 12, knob = 26;
      const usable = r.height - pad * 2 - knob;
      let v = 1 - (clientY - (r.top + pad + knob / 2)) / usable;
      v = clamp(v, 0, 1);
      this.input.setTouchThrottle(v);
      this._renderThrottle(v);
    };
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); this.dragThrottle = true; el.setPointerCapture(e.pointerId); set(e.clientY); });
    el.addEventListener("pointermove", (e) => { if (this.dragThrottle) set(e.clientY); });
    const end = () => { this.dragThrottle = false; };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  _renderThrottle(v) {
    const pad = 12, knob = 26;
    const h = this.thEl.clientHeight || 180;
    const usable = h - pad * 2 - knob;
    this.thKnob.style.top = (pad + (1 - v) * usable) + "px";
    this.thFill.style.height = (v * (h - pad * 2)) + "px";
    this.thVal.textContent = Math.round(v * 100);
  }

  /* ---- Pitch joystick (vertical axis) ---- */
  _wireStick() {
    const el = this.stick;
    const set = (clientY) => {
      const r = el.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      const maxR = r.height / 2 - 24;
      let dy = clamp(clientY - cy, -maxR, maxR);
      this.input.setTouchPitch(-dy / maxR);       // drag up = nose up
      this.stickKnob.style.transform = `translate(-50%, calc(-50% + ${dy}px))`;
    };
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); this.dragStick = true; el.setPointerCapture(e.pointerId); set(e.clientY); });
    el.addEventListener("pointermove", (e) => { if (this.dragStick) set(e.clientY); });
    const end = () => {
      this.dragStick = false;
      this.input.setTouchPitch(0);
      this.stickKnob.style.transform = "translate(-50%, -50%)";
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  /* ---- Buttons ---- */
  _wireButtons() {
    const g = this.game, inp = this.input;
    const tap = (id, fn) => {
      document.getElementById(id).addEventListener("pointerdown", (e) => { e.preventDefault(); fn(); });
    };
    tap("mc-gear", () => inp.pulse("KeyG"));
    tap("mc-flapup", () => inp.pulse("KeyF"));
    tap("mc-flapdn", () => inp.pulse("KeyR"));
    tap("mc-menu", () => g.toMenu());
    tap("mc-pause", () => g._togglePause());

    const brake = this.brakeBtn;
    const down = (e) => { e.preventDefault(); inp.setTouchBrakes(true); brake.classList.add("active"); };
    const up = () => { inp.setTouchBrakes(false); brake.classList.remove("active"); };
    brake.addEventListener("pointerdown", down);
    brake.addEventListener("pointerup", up);
    brake.addEventListener("pointercancel", up);
    brake.addEventListener("pointerleave", up);
  }

  /* Reflect live aircraft state on the controls (called each frame). */
  sync(ac) {
    if (!document.body.classList.contains("touch")) return;
    if (!ac) return;
    if (!this.dragThrottle) this._renderThrottle(ac.throttle);
    this.gearBtn.textContent = ac.gearDown ? "GEAR DN" : "GEAR UP";
    this.gearBtn.classList.toggle("on", ac.gearDown);
    this.flapsChip.textContent = "FLAPS " + ac.flaps;
  }
}
