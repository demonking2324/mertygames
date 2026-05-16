const PLAYS_STORAGE_KEY = "mertygames-plays-v1";

function getPlayStore() {
  try {
    const raw = localStorage.getItem(PLAYS_STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function savePlayStore(store) {
  localStorage.setItem(PLAYS_STORAGE_KEY, JSON.stringify(store));
}

function getPlayCount(gameId) {
  const store = getPlayStore();
  const n = Number(store[gameId]);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function incrementPlayCount(gameId) {
  const store = getPlayStore();
  const next = getPlayCount(gameId) + 1;
  store[gameId] = next;
  savePlayStore(store);
  return next;
}

function formatPlayCount(n) {
  return new Intl.NumberFormat().format(n);
}

function updateCardPlayDisplay(card, count) {
  const el = card.querySelector("[data-play-count]");
  if (el) el.textContent = formatPlayCount(count);
}

document.querySelectorAll(".game-card[data-game-id]").forEach((card) => {
  const gameId = card.dataset.gameId;
  if (!gameId) return;

  updateCardPlayDisplay(card, getPlayCount(gameId));

  card.addEventListener("click", () => {
    const count = incrementPlayCount(gameId);
    updateCardPlayDisplay(card, count);
  });
});
