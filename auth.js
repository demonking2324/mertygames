const STORAGE_KEY = "mertygames-accounts-v1";
const SESSION_KEY = "mertygames-session-user";

const tabCreate = document.getElementById("tabCreate");
const tabSignIn = document.getElementById("tabSignIn");
const panelCreate = document.getElementById("panelCreate");
const panelSignIn = document.getElementById("panelSignIn");
const regUser = document.getElementById("regUser");
const regPass = document.getElementById("regPass");
const regPass2 = document.getElementById("regPass2");
const loginUser = document.getElementById("loginUser");
const loginPass = document.getElementById("loginPass");
const createAccountBtn = document.getElementById("createAccountBtn");
const signInBtn = document.getElementById("signInBtn");
const accountMessage = document.getElementById("accountMessage");
const accountSignedIn = document.getElementById("accountSignedIn");
const accountForms = document.getElementById("accountForms");
const signedInName = document.getElementById("signedInName");
const signOutBtn = document.getElementById("signOutBtn");

function getStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { users: {} };
    const data = JSON.parse(raw);
    if (!data.users || typeof data.users !== "object") return { users: {} };
    return data;
  } catch {
    return { users: {} };
  }
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function normalizeUsername(name) {
  return name.trim().toLowerCase();
}

function validateUsername(name) {
  const t = name.trim();
  if (t.length < 2 || t.length > 24) return "Username must be 2–24 characters.";
  if (!/^[a-zA-Z0-9_]+$/.test(t)) return "Username can only use letters, numbers, and underscores.";
  return null;
}

function validatePassword(pass) {
  if (pass.length < 4) return "Password must be at least 4 characters.";
  if (pass.length > 128) return "Password is too long.";
  return null;
}

function bytesToB64(bytes) {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hashPassword(password, saltB64) {
  const enc = new TextEncoder();
  const salt = b64ToBytes(saltB64);
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bytesToB64(new Uint8Array(bits));
}

function randomSaltB64() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bytesToB64(salt);
}

function setMessage(text, isError) {
  accountMessage.textContent = text;
  accountMessage.classList.toggle("account-message-error", Boolean(isError));
}

function getSessionUser() {
  return sessionStorage.getItem(SESSION_KEY) || "";
}

function setSessionUser(username) {
  if (username) sessionStorage.setItem(SESSION_KEY, username);
  else sessionStorage.removeItem(SESSION_KEY);
}

function refreshSignedInUI() {
  const u = getSessionUser();
  if (u) {
    signedInName.textContent = u;
    accountSignedIn.classList.remove("hidden");
    accountForms.classList.add("hidden");
  } else {
    accountSignedIn.classList.add("hidden");
    accountForms.classList.remove("hidden");
  }
}

function showCreate() {
  tabCreate.classList.add("is-active");
  tabSignIn.classList.remove("is-active");
  tabCreate.setAttribute("aria-selected", "true");
  tabSignIn.setAttribute("aria-selected", "false");
  panelCreate.classList.remove("hidden");
  panelCreate.removeAttribute("hidden");
  panelSignIn.classList.add("hidden");
  panelSignIn.setAttribute("hidden", "true");
  setMessage("");
}

function showSignIn() {
  tabSignIn.classList.add("is-active");
  tabCreate.classList.remove("is-active");
  tabSignIn.setAttribute("aria-selected", "true");
  tabCreate.setAttribute("aria-selected", "false");
  panelSignIn.classList.remove("hidden");
  panelSignIn.removeAttribute("hidden");
  panelCreate.classList.add("hidden");
  panelCreate.setAttribute("hidden", "true");
  setMessage("");
}

tabCreate.addEventListener("click", showCreate);
tabSignIn.addEventListener("click", showSignIn);

createAccountBtn.addEventListener("click", async () => {
  setMessage("");
  const name = regUser.value;
  const pass = regPass.value;
  const pass2 = regPass2.value;
  const uErr = validateUsername(name);
  if (uErr) {
    setMessage(uErr, true);
    return;
  }
  const pErr = validatePassword(pass);
  if (pErr) {
    setMessage(pErr, true);
    return;
  }
  if (pass !== pass2) {
    setMessage("Passwords do not match.", true);
    return;
  }
  const key = normalizeUsername(name);
  const store = getStore();
  if (store.users[key]) {
    setMessage("That username is already taken on this browser.", true);
    return;
  }
  const salt = randomSaltB64();
  const hash = await hashPassword(pass, salt);
  store.users[key] = {
    display: name.trim(),
    salt,
    hash,
    createdAt: Date.now(),
  };
  saveStore(store);
  setSessionUser(store.users[key].display);
  setMessage("Account created. You are signed in.");
  regUser.value = "";
  regPass.value = "";
  regPass2.value = "";
  refreshSignedInUI();
});

signInBtn.addEventListener("click", async () => {
  setMessage("");
  const name = loginUser.value;
  const pass = loginPass.value;
  const uErr = validateUsername(name);
  if (uErr) {
    setMessage(uErr, true);
    return;
  }
  if (!pass) {
    setMessage("Enter your password.", true);
    return;
  }
  const key = normalizeUsername(name);
  const store = getStore();
  const user = store.users[key];
  if (!user) {
    setMessage("No account with that username on this browser.", true);
    return;
  }
  const hash = await hashPassword(pass, user.salt);
  if (hash !== user.hash) {
    setMessage("Wrong password.", true);
    return;
  }
  setSessionUser(user.display);
  setMessage("Signed in successfully.");
  loginPass.value = "";
  refreshSignedInUI();
});

signOutBtn.addEventListener("click", () => {
  setSessionUser("");
  setMessage("");
  refreshSignedInUI();
});

refreshSignedInUI();
