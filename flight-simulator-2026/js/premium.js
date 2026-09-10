/* ============================================================
 * Premium — £2.99 unlock, 4-digit sign-in codes.
 * Codes are issued at purchase and can be re-entered on another device.
 * ============================================================ */

const PREMIUM_PRICE = "£2.99";
const PREMIUM_LS_PIN = "fs2026_premium_pin";

function normalizePremiumPin(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

/* Issued PINs are 4 digits with a checksum so a purchased code works
 * after Sign in on another browser. Obvious sequences are rejected. */
function isIssuedPremiumPin(pin) {
  pin = normalizePremiumPin(pin);
  if (pin.length !== 4) return false;
  if (/^(\d)\1{3}$/.test(pin)) return false;
  if (pin === "1234" || pin === "4321" || pin === "0123" || pin === "9876") return false;
  const a = pin.charCodeAt(0) - 48;
  const b = pin.charCodeAt(1) - 48;
  const c = pin.charCodeAt(2) - 48;
  const d = pin.charCodeAt(3) - 48;
  return (a * 3 + b * 7 + c * 1 + d * 9) % 10 === 4;
}

function issuePremiumPin() {
  for (let i = 0; i < 400; i++) {
    const pin = String(1000 + Math.floor(Math.random() * 9000));
    if (isIssuedPremiumPin(pin)) return pin;
  }
  for (let n = 1024; n <= 9999; n++) {
    const pin = String(n);
    if (isIssuedPremiumPin(pin)) return pin;
  }
  return "1009";
}

function hasPremium() {
  try {
    return isIssuedPremiumPin(localStorage.getItem(PREMIUM_LS_PIN) || "");
  } catch (e) {
    return false;
  }
}

function currentPremiumPin() {
  try {
    const pin = normalizePremiumPin(localStorage.getItem(PREMIUM_LS_PIN) || "");
    return isIssuedPremiumPin(pin) ? pin : "";
  } catch (e) {
    return "";
  }
}

function signInPremium(pin) {
  pin = normalizePremiumPin(pin);
  if (!isIssuedPremiumPin(pin)) return false;
  try { localStorage.setItem(PREMIUM_LS_PIN, pin); } catch (e) {}
  return true;
}

function signOutPremium() {
  try { localStorage.removeItem(PREMIUM_LS_PIN); } catch (e) {}
}

function purchasePremium() {
  const pin = issuePremiumPin();
  signInPremium(pin);
  return pin;
}
