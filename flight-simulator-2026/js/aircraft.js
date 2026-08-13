/* ============================================================
 * Aircraft — state + 2D point-mass flight dynamics.
 *
 * Side-view model. State:
 *   x, y      : world position (m). y is altitude above sea level.
 *   vx, vy    : velocity (m/s).
 *   pitch     : nose attitude angle (rad), measured from horizontal.
 *
 * Forces each step: thrust (along pitch), lift (perp. to velocity),
 * drag (opposite velocity), gravity (down). Angle of attack is the
 * difference between where the nose points and where the plane moves.
 * ============================================================ */

class Aircraft {
  constructor(spec, airline, groundElevation) {
    this.spec = spec;
    this.airline = airline;

    this.x = 0;
    this.y = groundElevation;      // sitting on the runway
    this.vx = 0;
    this.vy = 0;
    this.pitch = 0;

    this.throttle = 0;             // 0..1
    this.flaps = 0;                // 0..flapNotches
    this.gearDown = true;
    this.brakes = false;

    this.onGround = true;
    this.groundElevation = groundElevation;
    this.crashed = false;

    // Derived / telemetry (updated each step).
    this.airspeed = 0;
    this.alpha = 0;                // angle of attack (rad)
    this.gForce = 1;
    this.stalled = false;
    this.verticalSpeed = 0;
  }

  get flapCl() { return this.flaps * this.spec.flapCl; }

  setThrottle(t) { this.throttle = clamp(t, 0, 1); }

  update(dt, input) {
    if (this.crashed) return;
    const spec = this.spec;

    // --- Pitch control (elevator) ---
    // Elevator authority scales with airspeed (dynamic pressure feel).
    const speedFactor = clamp(this.airspeed / 60, 0.15, 1.4);
    const pitchInput = input.pitch; // -1 (nose down) .. +1 (nose up)
    if (this.onGround && this.airspeed < 3) {
      // Can't rotate until rolling.
    } else {
      this.pitch += pitchInput * spec.pitchAuthority * speedFactor * dt;
    }
    this.pitch = clamp(this.pitch, rad(-35), rad(35));

    // --- Aerodynamic state ---
    const v = Math.hypot(this.vx, this.vy);
    this.airspeed = v;
    const rho = airDensity(this.y);
    const q = 0.5 * rho * v * v;                 // dynamic pressure
    const S = spec.wingArea;

    const gamma = v > 0.1 ? Math.atan2(this.vy, this.vx) : this.pitch; // flight path angle
    let alpha = this.pitch - gamma;
    // Normalize alpha to [-pi, pi]
    alpha = Math.atan2(Math.sin(alpha), Math.cos(alpha));
    this.alpha = alpha;

    const cl = liftCoefficient(alpha, spec, this.flapCl);
    const cd = dragCoefficient(alpha, cl, spec);
    this.stalled = Math.abs(alpha) > spec.alphaStall && v > 5;

    const lift = q * S * cl;
    const drag = q * S * cd;

    // Force directions.
    // Lift is perpendicular to velocity (rotate velocity +90°).
    // Drag is opposite velocity.
    const cosG = Math.cos(gamma), sinG = Math.sin(gamma);
    const liftX = -sinG * lift;
    const liftY = cosG * lift;
    const dragX = -cosG * drag;
    const dragY = -sinG * drag;

    // Thrust acts along the nose direction.
    const thrust = this.throttle * spec.maxThrust;
    const thrustX = Math.cos(this.pitch) * thrust;
    const thrustY = Math.sin(this.pitch) * thrust;

    // Gravity.
    const weight = spec.mass * G;

    let fx = liftX + dragX + thrustX;
    let fy = liftY + dragY + thrustY - weight;

    // --- Ground interaction ---
    const agl = this.y - this.groundElevation;
    const nearGround = agl <= 0.5;

    // The aircraft only leaves the runway once the pilot has rotated the
    // nose up. Without this, building lift (esp. with flaps) would float the
    // plane off the ground on its own — an unwanted "automatic" takeoff.
    const rotated = this.pitch > rad(3);

    if (nearGround && (this.vy <= 0.05 || !rotated)) {
      this.y = this.groundElevation;
      this.onGround = true;

      // Landing / rolling: no sinking through the runway.
      if (fy < 0) fy = 0;
      this.vy = Math.max(this.vy, 0);

      // Stay glued to the runway until the nose is rotated for takeoff.
      if (!rotated) this.vy = 0;

      // Rolling resistance + optional wheel braking.
      const rollMu = this.brakes ? 0.35 : 0.02;
      const normal = weight; // simplified
      const friction = rollMu * normal;
      const rollDir = Math.sign(this.vx) || 1;
      fx -= rollDir * friction;

      // Only settle the nose to level while taxiing/stationary — allow
      // the pilot to rotate for takeoff once rolling at speed.
      if (this.airspeed < 15) {
        this.pitch = lerp(this.pitch, 0, 1 - Math.exp(-dt * 3));
      }
    } else {
      this.onGround = false;
    }

    // --- Integrate ---
    const ax = fx / spec.mass;
    const ay = fy / spec.mass;
    this.vx += ax * dt;
    this.vy += ay * dt;

    // Prevent reverse taxi from thrust-off drag.
    if (this.onGround && this.vx < 0) this.vx = 0;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.y < this.groundElevation) {
      this.y = this.groundElevation;
      this.vy = 0;
    }

    this.verticalSpeed = this.vy;

    // Load factor (perceived g) from lift vs weight.
    this.gForce = lift / weight;

    // --- Crash / hard-landing detection handled by game via checkTouchdown ---
  }

  /* Returns landing quality when transitioning onto the ground:
   * 'smooth' | 'firm' | 'hard' based on vertical speed and gear. */
  touchdownQuality() {
    const vs = Math.abs(this.verticalSpeed);
    if (!this.gearDown) return "gearup";
    if (vs < 1.5) return "smooth";
    if (vs < 3.0) return "firm";
    return "hard";
  }
}
