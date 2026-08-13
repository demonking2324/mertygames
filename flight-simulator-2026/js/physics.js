/* ============================================================
 * Physics & atmosphere helpers.
 * (rad/deg/clamp/lerp are defined in data.js and reused here.)
 * ============================================================ */

const G = 9.80665;          // gravity, m/s^2
const RHO0 = 1.225;         // sea-level air density, kg/m^3
const SCALE_HEIGHT = 8500;  // atmospheric scale height, m

/* Air density falls off exponentially with altitude. */
function airDensity(altitude) {
  return RHO0 * Math.exp(-Math.max(0, altitude) / SCALE_HEIGHT);
}

/* Lift coefficient vs angle of attack, with a soft stall past alphaStall. */
function liftCoefficient(alpha, spec, flapCl) {
  const aStall = spec.alphaStall;
  const clLinear = spec.clSlope * alpha + flapCl;
  const clPeak = spec.clMax + flapCl;

  if (Math.abs(alpha) <= aStall) {
    return clamp(clLinear, -clPeak, clPeak);
  }
  // Post-stall: lift collapses smoothly as AoA increases past the stall angle.
  const over = Math.abs(alpha) - aStall;
  const decay = Math.exp(-over * 3.2);           // rapid loss of lift
  const stalledCl = clPeak * decay * 0.75;
  return Math.sign(alpha) * stalledCl;
}

/* Drag coefficient: parasite + induced, with a stall penalty. */
function dragCoefficient(alpha, cl, spec) {
  let cd = spec.cd0 + spec.induced * cl * cl;
  const over = Math.abs(alpha) - spec.alphaStall;
  if (over > 0) cd += 0.9 * over;                // separated-flow drag when stalled
  return cd;
}

/* Unit conversions. */
const MS_TO_KT = 1.943844;
const MS_TO_FPM = 196.850394;   // m/s -> feet per minute
const M_TO_FT = 3.280839895;
const KMH_PER_MS = 3.6;

function msToKnots(v) { return v * MS_TO_KT; }
function msToFpm(v) { return v * MS_TO_FPM; }
function mToFeet(m) { return m * M_TO_FT; }
