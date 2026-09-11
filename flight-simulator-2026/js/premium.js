/* ============================================================
 * Premium — £2.99 unlock via PayPal, 4-digit sign-in codes.
 * Codes are issued after checkout and can be re-entered on another device.
 * ============================================================ */

const PREMIUM_PRICE = "£2.99";
const PREMIUM_LS_PIN = "fs2026_premium_pin_v2";
const PAYPAL_LS_TOKEN = "fs2026_pay_token";

/* PayPal.Me username (the part after paypal.me/). Payments of £2.99 GBP
 * go to https://www.paypal.com/paypalme/<this>/2.99GBP
 * Change this if your PayPal.Me handle is different. */
const PAYPAL_ME = "MertIlter";
const PAYPAL_AMOUNT = "2.99";
const PAYPAL_CURRENCY = "GBP";

/* Optional: PayPal REST Client ID from developer.paypal.com (Dashboard → Apps).
 * When set, checkout uses in-page PayPal buttons instead of PayPal.Me. */
const PAYPAL_CLIENT_ID = "";

function paypalMeUser() {
  return String(PAYPAL_ME || "")
    .replace(/^https?:\/\/(www\.)?paypal\.me\//i, "")
    .replace(/\/.*$/, "")
    .trim();
}

function gamePageUrl() {
  if (location.protocol !== "http:" && location.protocol !== "https:") return "";
  return location.origin + location.pathname;
}

function newPayPalToken() {
  const token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  try { sessionStorage.setItem(PAYPAL_LS_TOKEN, token); } catch (e) {}
  return token;
}

function paypalCheckoutUrl(token) {
  const user = paypalMeUser();
  if (!user) return "";
  const here = gamePageUrl();
  if (here && token) {
    const q = new URLSearchParams();
    q.set("cmd", "_xclick");
    q.set("business", user);
    q.set("item_name", "Flight Simulator 2026 Premium");
    q.set("amount", PAYPAL_AMOUNT);
    q.set("currency_code", PAYPAL_CURRENCY);
    q.set("no_shipping", "1");
    q.set("no_note", "1");
    q.set("rm", "1");
    q.set("return", here + "?fs_paid=" + encodeURIComponent(token));
    q.set("cancel_return", here);
    return "https://www.paypal.com/cgi-bin/webscr?" + q.toString();
  }
  return "https://www.paypal.com/paypalme/" + encodeURIComponent(user) +
    "/" + PAYPAL_AMOUNT + PAYPAL_CURRENCY;
}

function takePayPalReturn() {
  try {
    const paid = new URLSearchParams(location.search).get("fs_paid");
    const expected = sessionStorage.getItem(PAYPAL_LS_TOKEN) || "";
    if (!paid || !expected || paid !== expected) return false;
    sessionStorage.removeItem(PAYPAL_LS_TOKEN);
    history.replaceState({}, "", location.pathname + location.hash);
    return true;
  } catch (e) {
    return false;
  }
}

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
  return (a * 5 + b * 2 + c * 8 + d * 3) % 10 === 7;
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
  return "1036";
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

function loadPayPalSdk() {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (!PAYPAL_CLIENT_ID) return Promise.reject(new Error("no-client-id"));
  if (loadPayPalSdk._pending) return loadPayPalSdk._pending;
  loadPayPalSdk._pending = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.paypal.com/sdk/js?client-id=" +
      encodeURIComponent(PAYPAL_CLIENT_ID) + "&currency=" + PAYPAL_CURRENCY;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => {
      loadPayPalSdk._pending = null;
      reject(new Error("sdk-load"));
    };
    document.head.appendChild(script);
  });
  return loadPayPalSdk._pending;
}
