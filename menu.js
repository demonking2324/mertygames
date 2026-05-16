const PLAYS_NAMESPACE = "mertygames";
const PLAYS_API = "https://abacus.jasoncameron.dev";

function formatPlayCount(n) {
  return new Intl.NumberFormat().format(n);
}

function updateCardPlayDisplay(card, count) {
  const el = card.querySelector("[data-play-count]");
  if (el) el.textContent = formatPlayCount(count);
}

async function fetchPlayCount(gameId) {
  try {
    const res = await fetch(`${PLAYS_API}/get/${PLAYS_NAMESPACE}/${gameId}`);
    const data = await res.json();
    if (typeof data.value === "number" && data.value >= 0) return data.value;
    return 0;
  } catch {
    return null;
  }
}

function hitPlayCount(gameId) {
  return fetch(`${PLAYS_API}/hit/${PLAYS_NAMESPACE}/${gameId}`, { keepalive: true })
    .then((res) => res.json())
    .then((data) => (typeof data.value === "number" ? data.value : null))
    .catch(() => null);
}

document.querySelectorAll(".game-card[data-game-id]").forEach((card) => {
  const gameId = card.dataset.gameId;
  if (!gameId) return;

  fetchPlayCount(gameId).then((count) => {
    if (count !== null) updateCardPlayDisplay(card, count);
  });

  card.addEventListener("click", () => {
    hitPlayCount(gameId).then((count) => {
      if (count !== null) updateCardPlayDisplay(card, count);
    });
  });
});
