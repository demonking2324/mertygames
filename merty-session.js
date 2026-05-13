const MERTY_STORAGE_KEY = "mertygames-accounts-v1";
const MERTY_SESSION_DISPLAY = "mertygames-session-user";
const MERTY_SESSION_USERKEY = "mertygames-session-userkey";

function mertyRandomPrivateChatCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function mertyGetStore() {
  try {
    const raw = localStorage.getItem(MERTY_STORAGE_KEY);
    if (!raw) return { users: {} };
    const data = JSON.parse(raw);
    if (!data.users || typeof data.users !== "object") return { users: {} };
    return data;
  } catch {
    return { users: {} };
  }
}

function mertySaveStore(store) {
  localStorage.setItem(MERTY_STORAGE_KEY, JSON.stringify(store));
}

function mertyGetSessionDisplay() {
  return sessionStorage.getItem(MERTY_SESSION_DISPLAY) || "";
}

function mertySetSession(displayName, userKey) {
  if (displayName) {
    sessionStorage.setItem(MERTY_SESSION_DISPLAY, displayName);
    if (userKey) sessionStorage.setItem(MERTY_SESSION_USERKEY, userKey);
  } else {
    sessionStorage.removeItem(MERTY_SESSION_DISPLAY);
    sessionStorage.removeItem(MERTY_SESSION_USERKEY);
  }
}

function mertyResolveSessionUserKey() {
  const existing = sessionStorage.getItem(MERTY_SESSION_USERKEY);
  if (existing) return existing;
  const display = sessionStorage.getItem(MERTY_SESSION_DISPLAY);
  if (!display) return "";
  const store = mertyGetStore();
  for (const [k, u] of Object.entries(store.users)) {
    if (u.display === display) {
      sessionStorage.setItem(MERTY_SESSION_USERKEY, k);
      return k;
    }
  }
  return "";
}

function mertyEnsurePrivateChatCodeForUser(userKey) {
  const store = mertyGetStore();
  const u = store.users[userKey];
  if (!u) return;
  if (!u.privateChatCode || String(u.privateChatCode).length !== 8) {
    u.privateChatCode = mertyRandomPrivateChatCode();
    mertySaveStore(store);
  }
}

function mertyGetPrivateChatCodeForSession() {
  const key = mertyResolveSessionUserKey();
  if (!key) return "";
  mertyEnsurePrivateChatCodeForUser(key);
  return mertyGetStore().users[key]?.privateChatCode || "";
}

function mertyPrivatePeerId(code) {
  return `merty-pv-${String(code).toLowerCase()}`;
}

function mertyCleanCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}
