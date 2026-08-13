/* ============================================================
 * Camera — maps world coordinates (meters) to screen (pixels).
 * World: +x east, +y up. Screen: +x right, +y down.
 * ============================================================ */

class Camera {
  constructor() {
    this.x = 0;          // world x at screen center (m)
    this.y = 0;          // world y at screen center (m)
    this.scale = 0.55;   // pixels per meter
    this.w = 0;
    this.h = 0;
  }

  resize(w, h) { this.w = w; this.h = h; }

  worldToScreenX(wx) { return this.w / 2 + (wx - this.x) * this.scale; }
  worldToScreenY(wy) { return this.h / 2 - (wy - this.y) * this.scale; }
  toScreenLen(m) { return m * this.scale; }

  /* Smoothly follow a target world point, keeping the ground visible when low. */
  follow(tx, ty, dt) {
    // Keep the aircraft a bit above center so there's room to see ahead/below.
    const desiredX = tx + 40; // lead the nose slightly
    const desiredY = Math.max(ty, 60); // don't dip the view below the ground band

    const k = 1 - Math.exp(-dt * 3.5);
    this.x = lerp(this.x, desiredX, k);
    this.y = lerp(this.y, desiredY, k);
  }
}
