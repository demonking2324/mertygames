/* ============================================================
 * Input — keyboard state + edge-triggered actions.
 * ============================================================ */

class Input {
  constructor() {
    this.keys = {};
    this.pitch = 0;        // -1..+1 (continuous)
    this._pressed = {};    // edge triggers for this frame

    this.onKeyDownExtra = null; // callback(code) for one-shot actions (menu/pause)

    window.addEventListener("keydown", (e) => {
      if (this._isGameKey(e.code)) e.preventDefault();
      if (!this.keys[e.code]) this._pressed[e.code] = true;
      this.keys[e.code] = true;
      if (this.onKeyDownExtra) this.onKeyDownExtra(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener("blur", () => { this.keys = {}; });
  }

  _isGameKey(code) {
    return [
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      "KeyW", "KeyS", "KeyA", "KeyD", "KeyF", "KeyR", "KeyG",
      "Space", "KeyP",
    ].includes(code);
  }

  /* Call once per frame AFTER reading, to clear edge triggers. */
  endFrame() { this._pressed = {}; }

  pressed(code) { return !!this._pressed[code]; }
  down(code) { return !!this.keys[code]; }

  /* Continuous flight controls, resolved each frame.
   * Yoke-style pitch: pull back (Down / S) = nose UP, push (Up / W) = nose DOWN. */
  sample(dt) {
    const noseUp = this.down("KeyS") || this.down("ArrowDown");
    const noseDown = this.down("KeyW") || this.down("ArrowUp");
    let target = 0;
    if (noseUp) target += 1;
    if (noseDown) target -= 1;
    // Smooth toward target so control feels analog.
    this.pitch = lerp(this.pitch, target, 1 - Math.exp(-dt * 8));
    return {
      pitch: this.pitch,
      throttleUp: this.down("KeyD") || this.down("ArrowRight"),
      throttleDown: this.down("KeyA") || this.down("ArrowLeft"),
      brakes: this.down("Space"),
    };
  }
}
