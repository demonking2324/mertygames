/* ============================================================
 * Premium — £2.99 unlock via PayPal, 4-digit sign-in codes.
 * Unlock only after PayPal returns a completed transaction id.
 * ============================================================ */

const PREMIUM_PRICE = "£2.99";
const PREMIUM_LS_PIN = "fs2026_premium_pin_v3";
const PREMIUM_LS_PAID = "fs2026_premium_paid_v3";
const PREMIUM_LS_ISSUED = "fs2026_premium_issued_v3";
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
  const here = gamePageUrl();
  if (!user || !here || !token) return "";
  const q = new URLSearchParams();
  q.set("cmd", "_xclick");
  q.set("business", user);
  q.set("item_name", "Flight Simulator 2026 Premium");
  q.set("amount", PAYPAL_AMOUNT);
  q.set("currency_code", PAYPAL_CURRENCY);
  q.set("no_shipping", "1");
  q.set("no_note", "1");
  q.set("rm", "1");
  q.set("invoice", "FS2026-" + token);
  q.set("return", here);
  q.set("cancel_return", here + "?fs_cancel=1");
  return "https://www.paypal.com/cgi-bin/webscr?" + q.toString();
}

function _clearPayPalQuery() {
  try { history.replaceState({}, "", location.pathname + location.hash); } catch (e) {}
}

/* PayPal only appends tx / payment_status after a completed payment.
 * Our old fs_paid token was in the checkout URL, so anyone could open
 * it without paying. Returning to the game tab is not enough. */
function takePayPalReturn() {
  try {
    const q = new URLSearchParams(location.search);
    const tx = (q.get("tx") || q.get("txn_id") || "").replace(/\s/g, "");
    const st = (q.get("st") || q.get("payment_status") || "").toLowerCase();
    const amt = parseFloat(q.get("amt") || q.get("mc_gross") || "NaN");
    const cc = (q.get("cc") || q.get("mc_currency") || "").toUpperCase();
    if (tx.length < 12) return false;
    if (st && st !== "completed" && st !== "processed") return false;
    if (Number.isFinite(amt) && amt + 0.001 < Number(PAYPAL_AMOUNT)) return false;
    if (cc && cc !== PAYPAL_CURRENCY) return false;
    if (!sessionStorage.getItem(PAYPAL_LS_TOKEN)) return false;
    sessionStorage.removeItem(PAYPAL_LS_TOKEN);
    _clearPayPalQuery();
    return true;
  } catch (e) {
    return false;
  }
}

function takePayPalCancel() {
  try {
    if (new URLSearchParams(location.search).get("fs_cancel") !== "1") return false;
    try { sessionStorage.removeItem(PAYPAL_LS_TOKEN); } catch (e) {}
    _clearPayPalQuery();
    return true;
  } catch (e) {
    return false;
  }
}

function normalizePremiumPin(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 4);
}

function issuePremiumPin() {
  return String(1000 + Math.floor(Math.random() * 9000));
}

function hasPremium() {
  try {
    return localStorage.getItem(PREMIUM_LS_PAID) === "1";
  } catch (e) {
    return false;
  }
}

function currentPremiumPin() {
  try {
    return normalizePremiumPin(localStorage.getItem(PREMIUM_LS_ISSUED) || "");
  } catch (e) {
    return "";
  }
}

function signInPremium(pin) {
  pin = normalizePremiumPin(pin);
  const issued = currentPremiumPin();
  if (!pin || pin !== issued) return false;
  try {
    localStorage.setItem(PREMIUM_LS_PAID, "1");
    localStorage.setItem(PREMIUM_LS_PIN, pin);
  } catch (e) {}
  return true;
}

function signOutPremium() {
  try { localStorage.removeItem(PREMIUM_LS_PAID); } catch (e) {}
}

function purchasePremium() {
  const pin = issuePremiumPin();
  try {
    localStorage.setItem(PREMIUM_LS_ISSUED, pin);
    localStorage.setItem(PREMIUM_LS_PIN, pin);
    localStorage.setItem(PREMIUM_LS_PAID, "1");
  } catch (e) {}
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
