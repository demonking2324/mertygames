const scoreValue = document.getElementById("scoreValue");
const comboValue = document.getElementById("comboValue");
const timeValue = document.getElementById("timeValue");
const dummyTarget = document.getElementById("dummyTarget");
const dummyMessage = document.getElementById("dummyMessage");
const restartDummy = document.getElementById("restartDummy");

let score = 0;
let combo = 1;
let timeLeft = 30;
let gameStarted = false;
let gameOver = false;
let timer = null;
let lastHitAt = 0;
let bestScore = Number(localStorage.getItem("merty-dummy-best") || 0);

function updateUI() {
  scoreValue.textContent = String(score);
  comboValue.textContent = `x${combo}`;
  timeValue.textContent = String(timeLeft);
}

function finishGame() {
  gameOver = true;
  gameStarted = false;
  dummyTarget.disabled = true;
  restartDummy.classList.remove("hidden");
  clearInterval(timer);
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("merty-dummy-best", String(bestScore));
    dummyMessage.textContent = `New best score: ${bestScore}!`;
  } else {
    dummyMessage.textContent = `Time up! Score ${score}. Best score: ${bestScore}.`;
  }
}

function startGame() {
  if (gameStarted || gameOver) return;
  gameStarted = true;
  dummyMessage.textContent = "Go go go!";
  timer = setInterval(() => {
    timeLeft -= 1;
    updateUI();
    if (timeLeft <= 0) finishGame();
  }, 1000);
}

function resetGame() {
  score = 0;
  combo = 1;
  timeLeft = 30;
  gameStarted = false;
  gameOver = false;
  lastHitAt = 0;
  dummyTarget.disabled = false;
  restartDummy.classList.add("hidden");
  dummyMessage.textContent = "Click the dummy to start.";
  updateUI();
}

dummyTarget.addEventListener("click", () => {
  if (!gameStarted) startGame();
  if (gameOver) return;

  const now = Date.now();
  if (now - lastHitAt < 550) {
    combo = Math.min(combo + 1, 10);
  } else {
    combo = 1;
  }
  lastHitAt = now;
  score += combo;
  updateUI();

  dummyTarget.classList.remove("dummy-hit");
  void dummyTarget.offsetWidth;
  dummyTarget.classList.add("dummy-hit");
});

restartDummy.addEventListener("click", () => {
  clearInterval(timer);
  resetGame();
});

dummyMessage.textContent = `Click the dummy to start. Best score: ${bestScore}.`;
updateUI();
