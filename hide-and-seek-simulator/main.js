document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".screen");
  const buttons = document.querySelectorAll(".menu-button");

  const offlineConfirm = document.getElementById("offline-confirm");
  const offlineNameInput = document.getElementById("player-name");
  const offlineError = document.getElementById("offline-error");

  const hostConfirm = document.getElementById("host-confirm");
  const hostNameInput = document.getElementById("host-name");
  const hostError = document.getElementById("host-error");
  const joinConfirm = document.getElementById("join-confirm");
  const joinNameInput = document.getElementById("join-name");
  const joinCodeInput = document.getElementById("join-code");
  const joinError = document.getElementById("join-error");

  const lobbyCode = document.getElementById("lobby-code");
  const lobbyLink = document.getElementById("lobby-link");
  const lobbyList = document.getElementById("lobby-player-list");
  const lobbyStatus = document.getElementById("lobby-status");
  const lobbyError = document.getElementById("lobby-error");
  const lobbyStart = document.getElementById("lobby-start");
  const lobbyLeave = document.getElementById("lobby-leave");
  const lobbyCopy = document.getElementById("lobby-copy");
  const lobbySubtitle = document.getElementById("lobby-subtitle");

  const gameExitButton = document.getElementById("game-exit");
  const gamePlayerLabel = document.getElementById("game-player-label");
  const gameTitle = document.getElementById("game-title");
  const gameCanvas = document.getElementById("game-canvas");

  let currentScreen = "menu";
  let currentGame = null;
  let net = null;
  let unsubNet = null;
  let gameStarted = false;

  function stopGameIfRunning() {
    if (currentGame && typeof currentGame.stop === "function") {
      currentGame.stop();
      currentGame = null;
    }
  }

  function disconnectNet() {
    if (unsubNet) {
      unsubNet();
      unsubNet = null;
    }
    if (net) {
      net.leave();
      net = null;
    }
    gameStarted = false;
  }

  function showScreen(name) {
    const leavingLobby =
      currentScreen === "online-lobby" &&
      name !== "online-lobby" &&
      name !== "offline-game";
    const leavingGame = currentScreen === "offline-game" && name !== "offline-game";

    if (name !== "offline-game") {
      stopGameIfRunning();
    }
    if (leavingLobby || leavingGame) {
      disconnectNet();
    }

    currentScreen = name;

    cards.forEach((card) => {
      const screen = card.getAttribute("data-screen");
      if (!screen) return;

      if (screen === name) {
        card.classList.remove("hidden");
      } else if (screen !== "menu" || name !== "menu") {
        card.classList.add("hidden");
      }
    });
  }

  function selectedRole(groupName) {
    const roleInput = document.querySelector(`input[name="${groupName}"]:checked`);
    return roleInput ? roleInput.value : null;
  }

  function renderLobby(players, code) {
    if (lobbyCode) lobbyCode.textContent = code || "-----";
    if (lobbyList) {
      lobbyList.innerHTML = "";
      (players || []).forEach((p) => {
        const li = document.createElement("li");
        li.className = "lobby-player";
        const name = document.createElement("span");
        name.className = "lobby-player-name";
        name.textContent = p.isHost ? `${p.name} (Host)` : p.name;
        const role = document.createElement("span");
        role.className = `lobby-player-role ${p.role}`;
        role.textContent = p.role === "seeker" ? "Seeker" : "Hider";
        li.append(name, role);
        lobbyList.appendChild(li);
      });
    }
    const count = (players || []).length;
    const isHost = !!(net && net.isHost);
    if (lobbyStart) {
      lobbyStart.hidden = !isHost;
      lobbyStart.disabled = !isHost || count < 2;
    }
    if (lobbyStatus) {
      if (count < 2) {
        lobbyStatus.textContent = isHost
          ? "Waiting for at least one more player…"
          : "Waiting for the host to start…";
      } else if (isHost) {
        lobbyStatus.textContent = "Ready when you are. Start whenever the lobby looks good.";
      } else {
        lobbyStatus.textContent = "Waiting for the host to start the round…";
      }
    }
    if (lobbySubtitle) {
      lobbySubtitle.textContent = isHost
        ? "Share this code so others can join."
        : "Connected. Hang tight until the host starts.";
    }
    if (lobbyLink) {
      if (net && net.transport === "ws") {
        lobbyLink.textContent = `Friends need this page open: ${location.origin}`;
      } else {
        lobbyLink.textContent = "Friends can join from any browser with this code.";
      }
    }
  }

  function bindNet(session) {
    if (unsubNet) unsubNet();
    net = session;
    unsubNet = session.subscribe((msg) => {
      if (msg.type === "lobby") {
        renderLobby(session.players, session.code);
        if (lobbyError && msg.roleNote) lobbyError.textContent = msg.roleNote;
      }
      if (msg.type === "joined" && msg.roleNote && lobbyError) {
        lobbyError.textContent = msg.roleNote;
      }
      if (msg.type === "error" && currentScreen === "online-lobby" && lobbyError) {
        lobbyError.textContent = msg.message || "Something went wrong.";
      }
      if (msg.type === "roomClosed") {
        if (currentScreen === "offline-game" || currentScreen === "online-lobby") {
          alert(msg.message || "The round ended.");
          showScreen("online");
        }
      }
      if (msg.type === "boot" && !session.isHost && !gameStarted) {
        launchOnlineGame(false, msg);
      }
    });
  }

  function setupGameHud(name, role, online) {
    if (gameTitle) {
      gameTitle.textContent =
        role === "hider" ? "Hider – Maze Run" : "Seeker – Hunt";
    }
    if (gamePlayerLabel) {
      const extra = online && net?.code ? `  ·  Code ${net.code}` : "";
      gamePlayerLabel.textContent =
        role === "hider"
          ? `You are hiding as ${name}${extra}`
          : `You are hunting as ${name} (press E to tag when close)${extra}`;
    }
  }

  function launchOnlineGame(isHost, boot) {
    if (!net || !gameCanvas) return;
    const me = net.players.find((p) => p.id === net.localId);
    const name = me?.name || "Player";
    const role = me?.role || "hider";
    gameStarted = true;
    showScreen("offline-game");
    setupGameHud(name, role, true);
    currentGame = createHiderMazeGame(gameCanvas, name, role, (message) => {
      alert(message || "Round over.");
      showScreen("online");
    }, {
      isHost,
      localId: net.localId,
      roster: net.players.slice(),
      send: (msg) => net.send(msg),
      subscribe: (fn) => net.subscribe(fn),
      boot: boot || null,
    });
    currentGame.start();
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      if (!target) return;
      showScreen(target);
    });
  });

  offlineConfirm?.addEventListener("click", () => {
    if (!offlineError) return;

    offlineError.textContent = "";

    const rawName = (offlineNameInput?.value || "").trim();
    const name = rawName || "Player";
    const role = selectedRole("role");

    if (!role) {
      offlineError.textContent = "Please choose hider or seeker.";
      return;
    }

    if (!gameCanvas) {
      offlineError.textContent = "Game canvas not found.";
      return;
    }

    showScreen("offline-game");
    setupGameHud(name, role, false);

    currentGame = createHiderMazeGame(gameCanvas, name, role, () => {
      alert("Round over.");
      showScreen("menu");
    });
    currentGame.start();
  });

  hostConfirm?.addEventListener("click", async () => {
    if (hostError) hostError.textContent = "";
    const name = (hostNameInput?.value || "").trim() || "Host";
    const role = selectedRole("host-role");
    if (!role) {
      if (hostError) hostError.textContent = "Please choose hider or seeker.";
      return;
    }
    hostConfirm.disabled = true;
    try {
      const session = createOnlineClient();
      bindNet(session);
      await session.host({ name, role });
      if (lobbyError) lobbyError.textContent = "";
      renderLobby(session.players, session.code);
      showScreen("online-lobby");
    } catch (err) {
      disconnectNet();
      if (hostError) hostError.textContent = err.message || "Could not host a round.";
    } finally {
      hostConfirm.disabled = false;
    }
  });

  joinConfirm?.addEventListener("click", async () => {
    if (joinError) joinError.textContent = "";
    const name = (joinNameInput?.value || "").trim() || "Player";
    const role = selectedRole("join-role");
    const code = (joinCodeInput?.value || "").trim();
    if (!role) {
      if (joinError) joinError.textContent = "Please choose hider or seeker.";
      return;
    }
    joinConfirm.disabled = true;
    try {
      const session = createOnlineClient();
      bindNet(session);
      const result = await session.join({ code, name, role });
      if (lobbyError) lobbyError.textContent = result.roleNote || "";
      renderLobby(session.players, session.code);
      showScreen("online-lobby");
    } catch (err) {
      disconnectNet();
      if (joinError) joinError.textContent = err.message || "Could not join that round.";
    } finally {
      joinConfirm.disabled = false;
    }
  });

  lobbyStart?.addEventListener("click", () => {
    if (!net || !net.isHost) return;
    if (lobbyError) lobbyError.textContent = "";
    if (net.players.length < 2) {
      if (lobbyError) lobbyError.textContent = "Need at least 2 players to start.";
      return;
    }
    net.start();
    launchOnlineGame(true, null);
  });

  lobbyLeave?.addEventListener("click", () => {
    showScreen("online");
  });

  lobbyCopy?.addEventListener("click", async () => {
    const code = net?.code || lobbyCode?.textContent || "";
    if (!code || code === "-----") return;
    try {
      await navigator.clipboard.writeText(code);
      lobbyCopy.textContent = "Copied";
      setTimeout(() => {
        lobbyCopy.textContent = "Copy";
      }, 1200);
    } catch (err) {
      if (lobbyError) lobbyError.textContent = `Code is ${code}`;
    }
  });

  joinCodeInput?.addEventListener("input", () => {
    joinCodeInput.value = joinCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  });

  gameExitButton?.addEventListener("click", () => {
    showScreen(net ? "online" : "menu");
  });

  showScreen("menu");
});

function createHiderMazeGame(canvas, playerName, role, onGameOver, network) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const isOnline = !!network;
  const isHost = !!(network && network.isHost);
  const isClient = isOnline && !isHost;
  const boot = network && network.boot;
  const localId = (network && network.localId) || "local";

  const tileSize = 32;
  const cols = 41;
  const rows = 41;
  const viewRadiusTiles = 4; // keep vision very close

  const keys = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    KeyE: false,
  };

  const grid = Array.from({ length: rows }, () => Array(cols).fill(1));

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function carve(x, y) {
    grid[y][x] = 0;
    const dirs = shuffle([
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]);

    for (const [dx, dy] of dirs) {
      const nx = x + dx * 2;
      const ny = y + dy * 2;
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === 1) {
        grid[y + dy][x + dx] = 0;
        carve(nx, ny);
      }
    }
  }

  if (boot && Array.isArray(boot.grid)) {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        grid[y][x] = boot.grid[y][x] ?? 1;
      }
    }
  } else {
    carve(1, 1);

    // Open extra passages so the whole maze is accessible and has loops
    for (let i = 0; i < 100; i += 1) {
      const x = 1 + Math.floor(Math.random() * (cols - 2));
      const y = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[y][x] !== 1) continue;
      const hOpen = grid[y][x - 1] === 0 && grid[y][x + 1] === 0;
      const vOpen = grid[y - 1] && grid[y - 1][x] === 0 && grid[y + 1] && grid[y + 1][x] === 0;
      if (hOpen || vOpen) grid[y][x] = 0;
    }
  }

  function randomOpenCell() {
    while (true) {
      const x = 1 + Math.floor(Math.random() * (cols - 2));
      const y = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[y][x] === 0) {
        return { x, y };
      }
    }
  }

  function worldFromCell(cell) {
    return {
      x: cell.x * tileSize + tileSize / 2,
      y: cell.y * tileSize + tileSize / 2,
    };
  }

  const bootHuman =
    boot && Array.isArray(boot.humans)
      ? boot.humans.find((h) => h.id === localId)
      : null;

  const playerSpawn = bootHuman
    ? { x: bootHuman.x, y: bootHuman.y }
    : worldFromCell(randomOpenCell());

  const player = {
    id: localId,
    name: playerName,
    role,
    alive: true,
    x: playerSpawn.x,
    y: playerSpawn.y,
    radius: role === "seeker" ? 10 : 9,
    speed: role === "seeker" ? 150 : 130,
    facingDx: 1,
    facingDy: 0,
    walkCycle: 0,
    isMoving: false,
    dying: false,
    deathTimer: 0,
    deathDuration: 1.15,
    fallSide: 1,
    knockDx: 0,
    knockDy: 0,
    animOffset: 0,
  };

  const COLORS = {
    hider: { r: 34, g: 197, b: 94 },
    playerHider: { r: 56, g: 189, b: 248 },
    playerSeeker: { r: 250, g: 204, b: 21 },
    mutated: { r: 249, g: 115, b: 22 },
    dead: { r: 148, g: 163, b: 184 },
    white: { r: 255, g: 255, b: 255 },
  };

  const effects = [];
  const DEATH_DURATION = 1.05;

  const aiCount = isOnline ? 8 : 14;

  const aiNames = [
    "Shadow",
    "Whisper",
    "Echo",
    "Drift",
    "Shade",
    "Fog",
    "Blink",
    "Phantom",
    "Sneak",
    "Ghost",
    "Wisp",
    "Murk",
    "Ash",
    "Cinder",
    "Nova",
    "Vex",
    "Rook",
    "Flicker",
    "Haze",
  ];

  function randomName() {
    const first = aiNames[Math.floor(Math.random() * aiNames.length)];
    const second = aiNames[Math.floor(Math.random() * aiNames.length)];
    if (first === second) return first;
    return `${first}-${second}`;
  }

  function randomDirection() {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    return dirs[Math.floor(Math.random() * dirs.length)];
  }

  function chooseSmartDirectionFromCell(cellX, cellY, preferredVec) {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    const openDirs = dirs.filter((d) => {
      const nx = cellX + d.dx;
      const ny = cellY + d.dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return false;
      return grid[ny][nx] === 0;
    });

    if (openDirs.length === 0) {
      return randomDirection();
    }

    if (preferredVec) {
      openDirs.sort((a, b) => {
        const da = preferredVec.dx * a.dx + preferredVec.dy * a.dy;
        const db = preferredVec.dx * b.dx + preferredVec.dy * b.dy;
        return db - da;
      });
    }

    // 70% chance to take the most preferred, otherwise random open direction
    if (Math.random() < 0.7) {
      return openDirs[0];
    }
    return openDirs[Math.floor(Math.random() * openDirs.length)];
  }

  const aiHiders = [];
  if (boot && Array.isArray(boot.ais)) {
    boot.ais.forEach((bot) => {
      aiHiders.push({
        ...bot,
        dir: bot.dir || randomDirection(),
        changeDirTimer: bot.changeDirTimer ?? 0.5,
      });
    });
  } else {
    for (let i = 0; i < aiCount; i += 1) {
      const spawn = worldFromCell(randomOpenCell());
      aiHiders.push({
        x: spawn.x,
        y: spawn.y,
        radius: 8,
        speed: 110,
        name: randomName(),
        dir: randomDirection(),
        changeDirTimer: 0.5 + Math.random() * 1.5,
        alive: true,
        dying: false,
        deathTimer: 0,
        deathDuration: DEATH_DURATION,
        fallSide: Math.random() < 0.5 ? -1 : 1,
        knockDx: 0,
        knockDy: 0,
        facingDx: 1,
        facingDy: 0,
        walkCycle: Math.random() * Math.PI * 2,
        isMoving: false,
        animOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  const remoteKeys = {};
  const otherHumans = [];

  function makeHumanFromRoster(p, spawn) {
    const fromBoot =
      boot && Array.isArray(boot.humans)
        ? boot.humans.find((h) => h.id === p.id)
        : null;
    const pos = fromBoot ? { x: fromBoot.x, y: fromBoot.y } : spawn;
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      alive: fromBoot ? fromBoot.alive !== false : true,
      x: pos.x,
      y: pos.y,
      radius: p.role === "seeker" ? 10 : 9,
      speed: p.role === "seeker" ? 150 : 130,
      facingDx: fromBoot?.facingDx ?? 1,
      facingDy: fromBoot?.facingDy ?? 0,
      walkCycle: fromBoot?.walkCycle ?? 0,
      isMoving: false,
      dying: !!fromBoot?.dying,
      deathTimer: fromBoot?.deathTimer ?? 0,
      deathDuration: fromBoot?.deathDuration ?? DEATH_DURATION,
      fallSide: fromBoot?.fallSide ?? (Math.random() < 0.5 ? -1 : 1),
      knockDx: 0,
      knockDy: 0,
      animOffset: Math.random() * Math.PI * 2,
    };
  }

  const roster = (network && network.roster) || [];
  roster.forEach((p) => {
    if (p.id === localId) return;
    otherHumans.push(makeHumanFromRoster(p, worldFromCell(randomOpenCell())));
    remoteKeys[p.id] = {
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false,
      KeyE: false,
    };
  });

  const hasHumanSeeker =
    role === "seeker" || otherHumans.some((h) => h.role === "seeker");

  // Mutated seeker for hider mode (spawns after countdown)
  let mutatedSeeker = null;
  let mutatedActive = false;
  let playerDead = false;
  let roundOver = false;

  function isWallAt(worldX, worldY) {
    const cx = Math.floor(worldX / tileSize);
    const cy = Math.floor(worldY / tileSize);
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) return true;
    return grid[cy][cx] === 1;
  }

  function moveEntity(entity, inputX, inputY, dt) {
    const len = Math.hypot(inputX, inputY);
    if (len === 0) {
      entity.isMoving = false;
      return false;
    }
    const nx = (inputX / len) * entity.speed * dt;
    const ny = (inputY / len) * entity.speed * dt;
    const prevX = entity.x;
    const prevY = entity.y;

    const nextX = entity.x + nx;
    const nextY = entity.y + ny;

    if (!isWallAt(nextX, entity.y)) {
      entity.x = nextX;
    }
    if (!isWallAt(entity.x, nextY)) {
      entity.y = nextY;
    }

    const movedX = entity.x - prevX;
    const movedY = entity.y - prevY;
    const moved = Math.hypot(movedX, movedY) > 0.04;
    entity.isMoving = moved;
    if (moved) {
      entity.facingDx = movedX;
      entity.facingDy = movedY;
      entity.walkCycle = (entity.walkCycle || 0) + dt * (entity.speed / 11);
    }
    return moved;
  }

  function clamp01(t) {
    return Math.max(0, Math.min(1, t));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function mixRgb(a, b, t) {
    return {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t),
    };
  }

  function rgbStr(c, a = 1) {
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }

  function spawnTagBurst(x, y, color) {
    const count = 14;
    for (let i = 0; i < count; i += 1) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      const spd = 55 + Math.random() * 90;
      effects.push({
        type: "spark",
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 25,
        life: 0.38 + Math.random() * 0.22,
        maxLife: 0.5,
        size: 1.4 + Math.random() * 2.2,
        color,
      });
    }
    effects.push({
      type: "ring",
      x,
      y,
      r: 6,
      vr: 140,
      life: 0.32,
      maxLife: 0.32,
      color,
    });
    effects.push({
      type: "text",
      text: "TAGGED",
      x,
      y: y - 18,
      vy: -46,
      life: 0.7,
      maxLife: 0.7,
      color,
    });
  }

  function beginDeath(entity, fromX, fromY, burstColor) {
    entity.dying = true;
    entity.deathDuration = DEATH_DURATION;
    entity.deathTimer = DEATH_DURATION;
    entity.isMoving = false;
    const dx = entity.x - fromX;
    const dy = entity.y - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    entity.knockDx = dx / dist;
    entity.knockDy = dy / dist;
    entity.fallSide = dx >= 0 ? 1 : -1;
    spawnTagBurst(entity.x, entity.y - 4, burstColor);
    if (entity === player) playerDead = true;
    if (isHost && network) {
      network.send({
        type: "fx",
        x: entity.x,
        y: entity.y - 4,
        color: burstColor,
      });
    }
  }

  function packHuman(h) {
    return {
      id: h.id,
      name: h.name,
      role: h.role,
      x: h.x,
      y: h.y,
      radius: h.radius,
      facingDx: h.facingDx,
      facingDy: h.facingDy,
      walkCycle: h.walkCycle,
      isMoving: !!h.isMoving,
      dying: !!h.dying,
      deathTimer: h.deathTimer || 0,
      deathDuration: h.deathDuration || DEATH_DURATION,
      fallSide: h.fallSide || 1,
      alive: h === player ? !playerDead || !!h.dying : h.alive !== false,
      knockDx: h.knockDx || 0,
      knockDy: h.knockDy || 0,
    };
  }

  function packAi(bot) {
    return {
      x: bot.x,
      y: bot.y,
      radius: bot.radius,
      speed: bot.speed,
      name: bot.name,
      alive: bot.alive,
      dying: bot.dying,
      deathTimer: bot.deathTimer,
      deathDuration: bot.deathDuration,
      fallSide: bot.fallSide,
      facingDx: bot.facingDx,
      facingDy: bot.facingDy,
      walkCycle: bot.walkCycle,
      isMoving: bot.isMoving,
      animOffset: bot.animOffset,
      knockDx: bot.knockDx,
      knockDy: bot.knockDy,
    };
  }

  function copyAnimState(target, src) {
    target.x = src.x;
    target.y = src.y;
    target.radius = src.radius ?? target.radius;
    target.facingDx = src.facingDx;
    target.facingDy = src.facingDy;
    target.walkCycle = src.walkCycle;
    target.isMoving = src.isMoving;
    target.dying = src.dying;
    target.deathTimer = src.deathTimer;
    target.deathDuration = src.deathDuration || DEATH_DURATION;
    target.fallSide = src.fallSide;
    target.alive = src.alive !== false;
    target.knockDx = src.knockDx || 0;
    target.knockDy = src.knockDy || 0;
    if (src.name) target.name = src.name;
    if (src.role) target.role = src.role;
  }

  function applySnapshot(s) {
    if (!s) return;
    if (typeof s.countdown === "number") countdown = s.countdown;
    if (typeof s.gameTime === "number") gameTime = s.gameTime;
    mutatedActive = !!s.mutatedActive;
    if (s.mutatedSeeker) {
      if (!mutatedSeeker) mutatedSeeker = { ...s.mutatedSeeker };
      else Object.assign(mutatedSeeker, s.mutatedSeeker);
    } else {
      mutatedSeeker = null;
    }
    (s.humans || []).forEach((src) => {
      if (src.id === localId) {
        const far = Math.hypot(player.x - src.x, player.y - src.y) > 12;
        if (src.dying || far) {
          player.x = src.x;
          player.y = src.y;
        }
        player.dying = !!src.dying;
        player.deathTimer = src.deathTimer;
        player.deathDuration = src.deathDuration || DEATH_DURATION;
        player.fallSide = src.fallSide || player.fallSide;
        player.alive = src.alive !== false;
        player.facingDx = src.facingDx ?? player.facingDx;
        player.facingDy = src.facingDy ?? player.facingDy;
        player.isMoving = !!src.isMoving;
        if (src.dying || src.alive === false) playerDead = true;
        return;
      }
      let human = otherHumans.find((h) => h.id === src.id);
      if (!human) {
        human = makeHumanFromRoster(
          { id: src.id, name: src.name, role: src.role },
          { x: src.x, y: src.y }
        );
        otherHumans.push(human);
      }
      copyAnimState(human, src);
    });
    (s.ais || []).forEach((src, i) => {
      if (!aiHiders[i]) {
        aiHiders[i] = { ...src, dir: randomDirection(), changeDirTimer: 1 };
      } else {
        copyAnimState(aiHiders[i], src);
        if (src.name) aiHiders[i].name = src.name;
      }
    });
  }

  function updateDyingBody(body, dt) {
    body.deathTimer = Math.max(0, body.deathTimer - dt);
    if (body.deathTimer > body.deathDuration - 0.2) {
      const nx = body.x + body.knockDx * 70 * dt;
      const ny = body.y + body.knockDy * 70 * dt;
      if (!isWallAt(nx, body.y)) body.x = nx;
      if (!isWallAt(body.x, ny)) body.y = ny;
    }
    body.isMoving = false;
    if (body.deathTimer <= 0) {
      body.alive = false;
      body.dying = false;
    }
  }

  function updateOtherHumans(dt) {
    otherHumans.forEach((human) => {
      if (!human.alive) return;
      if (human.dying) {
        updateDyingBody(human, dt);
        return;
      }
      if (human.role === "seeker" && countdown > 0) {
        human.isMoving = false;
        return;
      }
      const k = remoteKeys[human.id] || {};
      let ix = 0;
      let iy = 0;
      if (k.KeyW) iy -= 1;
      if (k.KeyS) iy += 1;
      if (k.KeyA) ix -= 1;
      if (k.KeyD) ix += 1;
      moveEntity(human, ix, iy, dt);
    });
  }

  function getHunter() {
    if (mutatedSeeker && mutatedActive) return mutatedSeeker;
    if (role === "seeker" && countdown <= 0) return player;
    return (
      otherHumans.find(
        (h) => h.role === "seeker" && h.alive !== false && !h.dying
      ) || null
    );
  }

  function livingHumanHiders() {
    const list = [];
    if (role === "hider" && !playerDead && !player.dying) list.push(player);
    otherHumans.forEach((h) => {
      if (h.role === "hider" && h.alive !== false && !h.dying) list.push(h);
    });
    return list;
  }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const p = effects[i];
      p.life -= dt;
      if (p.life <= 0) {
        effects.splice(i, 1);
        continue;
      }
      if (p.type === "spark") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 180 * dt;
        p.vx *= 0.92;
      } else if (p.type === "ring") {
        p.r += p.vr * dt;
      } else if (p.type === "text") {
        p.y += p.vy * dt;
        p.vy *= 0.92;
      }
    }
  }

  function drawEffects() {
    effects.forEach((p) => {
      const t = clamp01(p.life / p.maxLife);
      if (p.type === "spark") {
        ctx.fillStyle = rgbStr(p.color, t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + t), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "ring") {
        ctx.strokeStyle = rgbStr(p.color, t * 0.85);
        ctx.lineWidth = 2 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === "text") {
        ctx.save();
        ctx.globalAlpha = t;
        ctx.font = "bold 9px system-ui";
        ctx.fillStyle = rgbStr(p.color, 1);
        ctx.strokeStyle = "rgba(2,6,23,0.85)";
        ctx.lineWidth = 3;
        ctx.textAlign = "center";
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      }
    });
  }

  function drawGroundShadow(x, y, radius, alpha) {
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 11, radius * 0.95, radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPerson(entity, style) {
    const dying = !!entity.dying;
    const deathDur = entity.deathDuration || DEATH_DURATION;
    const deathT = dying ? clamp01(1 - entity.deathTimer / deathDur) : 0;
    const moving = !!entity.isMoving && !dying;
    const cycle = entity.walkCycle || 0;
    const stride = moving ? Math.sin(cycle) : 0;
    const strideAbs = moving ? Math.abs(Math.sin(cycle)) : 0;
    const breath = Math.sin(gameTime * 2.15 + (entity.animOffset || 0)) * 0.45;
    const bob = dying ? 0 : moving ? -strideAbs * 2.6 : breath;

    let color = style.color;
    let alpha = style.alpha ?? 1;
    if (dying) {
      if (deathT < 0.1) {
        color = mixRgb(style.color, COLORS.white, 0.85);
      } else {
        const ashen = clamp01((deathT - 0.1) / 0.28);
        color = mixRgb(style.color, COLORS.dead, ashen);
      }
      if (deathT > 0.62) {
        alpha *= 1 - (deathT - 0.62) / 0.38;
      }
    }

    let fallRot = 0;
    let squashX = 1;
    let squashY = 1;
    let dropY = 0;
    if (dying) {
      const crumple = clamp01((deathT - 0.06) / 0.36);
      const eased = 1 - Math.pow(1 - crumple, 2.2);
      fallRot = eased * (entity.fallSide || 1) * 1.42;
      dropY = eased * 7;
      if (deathT > 0.38 && deathT < 0.56) {
        const bounce = Math.sin(((deathT - 0.38) / 0.18) * Math.PI);
        squashY = 1 - bounce * 0.32;
        squashX = 1 + bounce * 0.22;
      } else if (deathT >= 0.56) {
        squashY = 0.52;
        squashX = 1.28;
      }
    }

    let hipSwingL = stride * 0.88;
    let hipSwingR = -stride * 0.88;
    let armSwingL = -stride * 0.82;
    let armSwingR = stride * 0.82;

    if (!moving && !dying) {
      hipSwingL = 0.1;
      hipSwingR = -0.1;
      armSwingL = 0.42 + breath * 0.08;
      armSwingR = -0.28 - breath * 0.08;
    }

    if (dying) {
      const fling = clamp01(deathT / 0.16);
      const drop = clamp01((deathT - 0.16) / 0.32);
      armSwingL = lerp(-0.25, -2.55, fling) + drop * 2.05;
      armSwingR = lerp(0.2, -2.15, fling) + drop * 2.35;
      hipSwingL = lerp(0.45, 0.2, clamp01(deathT / 0.45));
      hipSwingR = lerp(-0.35, 1.05, clamp01(deathT / 0.4));
    }

    const s = (entity.radius || 8) / 8;
    const facingLeft = (entity.facingDx ?? 1) < 0;

    drawGroundShadow(
      entity.x,
      entity.y,
      entity.radius,
      (dying ? 0.18 * (1 - deathT) : 0.28) * alpha
    );

    ctx.save();
    ctx.translate(entity.x, entity.y + bob + dropY);
    ctx.scale((facingLeft ? -1 : 1) * squashX, squashY);
    ctx.rotate(fallRot);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = rgbStr(color, 1);
    ctx.fillStyle = rgbStr(color, 1);
    ctx.lineWidth = style.lineWidth || 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const hipY = 3.2 * s;
    const shoulderY = -6.2 * s;
    const headY = -12.2 * s;
    const headR = 4.3 * s + (style.mutated ? 0.8 : 0);
    const lean = moving ? 0.14 + stride * 0.06 : 0;

    ctx.save();
    ctx.rotate(lean);

    ctx.beginPath();
    ctx.moveTo(0, shoulderY);
    ctx.lineTo(0, hipY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.stroke();

    if (style.mutated) {
      ctx.beginPath();
      ctx.moveTo(-headR * 0.35, headY - headR);
      ctx.lineTo(0, headY - headR - 4.4 * s);
      ctx.lineTo(headR * 0.35, headY - headR);
      ctx.moveTo(-headR, headY - 1 * s);
      ctx.lineTo(-headR - 3.4 * s, headY - 5.2 * s);
      ctx.moveTo(headR, headY - 1 * s);
      ctx.lineTo(headR + 3.4 * s, headY - 5.2 * s);
      ctx.stroke();
    }

    ctx.save();
    ctx.lineWidth = 1.35;
    if (dying && deathT > 0.22) {
      const eyeY = headY;
      const gap = 1.7 * s;
      ctx.beginPath();
      ctx.moveTo(-gap - 1.3 * s, eyeY - 1.3 * s);
      ctx.lineTo(-gap + 1.3 * s, eyeY + 1.3 * s);
      ctx.moveTo(-gap + 1.3 * s, eyeY - 1.3 * s);
      ctx.lineTo(-gap - 1.3 * s, eyeY + 1.3 * s);
      ctx.moveTo(gap - 1.3 * s, eyeY - 1.3 * s);
      ctx.lineTo(gap + 1.3 * s, eyeY + 1.3 * s);
      ctx.moveTo(gap + 1.3 * s, eyeY - 1.3 * s);
      ctx.lineTo(gap - 1.3 * s, eyeY + 1.3 * s);
      ctx.stroke();
    } else {
      ctx.fillStyle = rgbStr(color, 1);
      ctx.beginPath();
      ctx.arc(-1.55 * s, headY, 0.72 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(1.55 * s, headY, 0.72 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const thigh = 5.1 * s;
    const shin = 5.0 * s;
    const upperArm = 4.2 * s;
    const foreArm = 3.8 * s;

    function drawLeg(swing, far) {
      const hipAngle = swing;
      const back = Math.max(0, -swing);
      const lift = Math.max(0, swing) * 0.22;
      const kneeBend = 0.18 + back * 0.95 + strideAbs * 0.1;
      const kx = Math.sin(hipAngle) * thigh;
      const ky = hipY + Math.cos(hipAngle) * thigh;
      const footAngle = hipAngle - kneeBend;
      const fx = kx + Math.sin(footAngle) * shin;
      const fy = ky + Math.cos(footAngle) * shin - lift * s;
      ctx.save();
      if (far) ctx.strokeStyle = rgbStr(color, 0.55);
      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(kx, ky);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fx - 1.6 * s, fy);
      ctx.lineTo(fx + 1.8 * s, fy);
      ctx.stroke();
      ctx.restore();
    }

    function drawArm(swing, far) {
      const shAngle = swing - 0.18;
      const elbowBend = 0.4 + Math.max(0, swing) * 0.28;
      const ex = Math.sin(shAngle) * upperArm;
      const ey = shoulderY + 0.6 * s + Math.cos(shAngle) * upperArm;
      const handAngle = shAngle + elbowBend;
      const hx = ex + Math.sin(handAngle) * foreArm;
      const hy = ey + Math.cos(handAngle) * foreArm;
      ctx.save();
      if (far) ctx.strokeStyle = rgbStr(color, 0.55);
      ctx.beginPath();
      ctx.moveTo(0, shoulderY + 0.6 * s);
      ctx.lineTo(ex, ey);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.restore();
    }

    drawLeg(hipSwingL, true);
    drawArm(armSwingL, true);
    drawLeg(hipSwingR, false);
    drawArm(armSwingR, false);

    ctx.restore();
    ctx.restore();

    if (style.name) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "10px system-ui";
      ctx.fillStyle = style.nameColor || "rgba(165,180,252,0.95)";
      ctx.textAlign = "center";
      ctx.fillText(style.name, entity.x, entity.y - entity.radius - 16 + bob);
      ctx.restore();
    }
  }

  function updatePlayer(dt) {
    if (player.dying || playerDead) {
      player.isMoving = false;
      if (isClient) return;
      if (player.dying) {
        player.deathTimer = Math.max(0, player.deathTimer - dt);
        if (player.deathTimer > player.deathDuration - 0.2) {
          const nx = player.x + player.knockDx * 70 * dt;
          const ny = player.y + player.knockDy * 70 * dt;
          if (!isWallAt(nx, player.y)) player.x = nx;
          if (!isWallAt(player.x, ny)) player.y = ny;
        }
      }
      return;
    }
    let ix = 0;
    let iy = 0;
    // For seeker, we might temporarily lock movement during countdown
    if (role === "seeker" && countdown > 0) {
      player.isMoving = false;
      return;
    }
    if (keys.KeyW) iy -= 1;
    if (keys.KeyS) iy += 1;
    if (keys.KeyA) ix -= 1;
    if (keys.KeyD) ix += 1;
    moveEntity(player, ix, iy, dt);
  }

  function updateAI(dt) {
    aiHiders.forEach((bot) => {
      if (!bot.alive) return;

      if (bot.dying) {
        bot.deathTimer = Math.max(0, bot.deathTimer - dt);
        if (bot.deathTimer > bot.deathDuration - 0.2) {
          const nx = bot.x + bot.knockDx * 70 * dt;
          const ny = bot.y + bot.knockDy * 70 * dt;
          if (!isWallAt(nx, bot.y)) bot.x = nx;
          if (!isWallAt(bot.x, ny)) bot.y = ny;
        }
        bot.isMoving = false;
        if (bot.deathTimer <= 0) {
          bot.alive = false;
          bot.dying = false;
        }
        return;
      }

      bot.changeDirTimer -= dt;
      if (bot.changeDirTimer <= 0) {
        const cx = Math.floor(bot.x / tileSize);
        const cy = Math.floor(bot.y / tileSize);

        // If there is a nearby mutated seeker, prefer directions that increase distance
        let preferred = null;
        const hunter = getHunter();
        if (hunter) {
          const dx = bot.x - hunter.x;
          const dy = bot.y - hunter.y;
          const dist = Math.hypot(dx, dy);
          if (dist < tileSize * 8) {
            preferred = { dx: Math.sign(dx), dy: Math.sign(dy) };
          }
        }

        bot.dir = chooseSmartDirectionFromCell(cx, cy, preferred);
        bot.changeDirTimer = 0.6 + Math.random() * 2;
      }

      const intendedX = bot.dir.dx;
      const intendedY = bot.dir.dy;

      const beforeX = bot.x;
      const beforeY = bot.y;

      moveEntity(bot, intendedX, intendedY, dt);

      // If we barely moved (hit a wall), immediately try a smarter new direction
      if (Math.abs(bot.x - beforeX) < 0.5 && Math.abs(bot.y - beforeY) < 0.5) {
        const cx = Math.floor(bot.x / tileSize);
        const cy = Math.floor(bot.y / tileSize);
        bot.dir = chooseSmartDirectionFromCell(cx, cy);
        bot.changeDirTimer = 0.4 + Math.random() * 1.2;
      }
    });
  }

  function ensureMutatedSeekerExists() {
    if (mutatedSeeker) return;
    const spawn = worldFromCell(randomOpenCell());
    mutatedSeeker = {
      x: spawn.x,
      y: spawn.y,
      radius: 11,
      speed: 140,
      dir: { dx: 0, dy: 0 },
      changeDirTimer: 0.4 + Math.random() * 0.8,
      animOffset: Math.random() * Math.PI * 2,
      facingDx: 1,
      facingDy: 0,
      walkCycle: 0,
      isMoving: false,
    };
  }

  function updateMutatedSeeker(dt) {
    if (!mutatedSeeker || !mutatedActive) return;

    mutatedSeeker.changeDirTimer -= dt;
    if (mutatedSeeker.changeDirTimer <= 0) {
      const hiders = livingHumanHiders();
      let target = hiders[0] || player;
      if (hiders.length > 1) {
        let best = Infinity;
        hiders.forEach((h) => {
          const d = Math.hypot(h.x - mutatedSeeker.x, h.y - mutatedSeeker.y);
          if (d < best) {
            best = d;
            target = h;
          }
        });
      }
      const dx = target.x - mutatedSeeker.x;
      const dy = target.y - mutatedSeeker.y;
      const prefer = { dx: Math.sign(dx), dy: Math.sign(dy) };
      const cx = Math.floor(mutatedSeeker.x / tileSize);
      const cy = Math.floor(mutatedSeeker.y / tileSize);
      mutatedSeeker.dir = chooseSmartDirectionFromCell(cx, cy, prefer);
      mutatedSeeker.changeDirTimer = 0.35 + Math.random() * 0.9;
    }

    moveEntity(mutatedSeeker, mutatedSeeker.dir.dx, mutatedSeeker.dir.dy, dt);

    aiHiders.forEach((bot) => {
      if (!bot.alive || bot.dying) return;
      const dist = Math.hypot(bot.x - mutatedSeeker.x, bot.y - mutatedSeeker.y);
      if (dist < bot.radius + mutatedSeeker.radius) {
        beginDeath(bot, mutatedSeeker.x, mutatedSeeker.y, COLORS.mutated);
      }
    });
  }

  function tryTagFrom(seeker) {
    const color = COLORS.playerSeeker;
    const reach = seeker.radius + 4;
    for (let i = 0; i < aiHiders.length; i += 1) {
      const bot = aiHiders[i];
      if (!bot.alive || bot.dying) continue;
      const dist = Math.hypot(bot.x - seeker.x, bot.y - seeker.y);
      if (dist < bot.radius + reach) {
        beginDeath(bot, seeker.x, seeker.y, color);
        return;
      }
    }
    const hiders = [];
    if (role === "hider") hiders.push(player);
    otherHumans.forEach((h) => {
      if (h.role === "hider") hiders.push(h);
    });
    for (let i = 0; i < hiders.length; i += 1) {
      const hider = hiders[i];
      if (hider.dying) continue;
      if (hider === player && playerDead) continue;
      if (hider !== player && !hider.alive) continue;
      const dist = Math.hypot(hider.x - seeker.x, hider.y - seeker.y);
      if (dist < (hider.radius || 9) + reach) {
        beginDeath(hider, seeker.x, seeker.y, color);
        return;
      }
    }
  }

  function handleSeekerTag() {
    if (role === "seeker" && keys.KeyE) {
      tryTagFrom(player);
    }
    otherHumans.forEach((human) => {
      if (human.role !== "seeker" || !human.alive || human.dying) return;
      const k = remoteKeys[human.id];
      if (k && k.KeyE) tryTagFrom(human);
    });
  }

  function checkPlayerDeath() {
    if (!mutatedSeeker || !mutatedActive) return;
    const hiders = [];
    if (role === "hider") hiders.push(player);
    otherHumans.forEach((h) => {
      if (h.role === "hider") hiders.push(h);
    });
    hiders.forEach((hider) => {
      if (hider.dying) return;
      if (hider === player && playerDead) return;
      if (hider !== player && !hider.alive) return;
      const dist = Math.hypot(mutatedSeeker.x - hider.x, mutatedSeeker.y - hider.y);
      if (dist < mutatedSeeker.radius + hider.radius) {
        beginDeath(hider, mutatedSeeker.x, mutatedSeeker.y, COLORS.mutated);
      }
    });
  }

  function checkRoundOver() {
    if (isClient || roundOver || typeof onGameOver !== "function") return;

    if (!isOnline) {
      if (role === "hider") {
        if (playerDead && player.deathTimer <= 0) {
          roundOver = true;
          onGameOver("Round over.");
        }
        return;
      }
      const allGone = aiHiders.every((b) => !b.alive && !b.dying);
      if (allGone) {
        roundOver = true;
        onGameOver("Round over.");
      }
      return;
    }

    const humanHiders = [player, ...otherHumans].filter((h) => h.role === "hider");
    if (humanHiders.length === 0) return;
    const humansDown = humanHiders.every((h) => {
      if (h === player) return playerDead && player.deathTimer <= 0;
      return !h.alive && !h.dying;
    });
    if (humansDown) {
      roundOver = true;
      const message = "Round over. All hiders were tagged.";
      if (network) network.send({ type: "roundOver", message });
      onGameOver(message);
    }
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    const radiusPx = viewRadiusTiles * tileSize + 8;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radiusPx, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(width / 2 - player.x, height / 2 - player.y);

    const playerCellX = Math.floor(player.x / tileSize);
    const playerCellY = Math.floor(player.y / tileSize);

    const minCol = Math.max(0, playerCellX - viewRadiusTiles - 2);
    const maxCol = Math.min(cols - 1, playerCellX + viewRadiusTiles + 2);
    const minRow = Math.max(0, playerCellY - viewRadiusTiles - 2);
    const maxRow = Math.min(rows - 1, playerCellY + viewRadiusTiles + 2);

    // Floor texture: subtle checker pattern
    for (let y = minRow; y <= maxRow; y += 1) {
      for (let x = minCol; x <= maxCol; x += 1) {
        const isDark = (x + y) % 2 === 0;
        ctx.fillStyle = isDark ? "#020617" : "#030712";
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    // Maze walls with simple beveled look
    for (let y = minRow; y <= maxRow; y += 1) {
      for (let x = minCol; x <= maxCol; x += 1) {
        if (grid[y][x] === 1) {
          const wx = x * tileSize;
          const wy = y * tileSize;

          const wallGrad = ctx.createLinearGradient(wx, wy, wx, wy + tileSize);
          wallGrad.addColorStop(0, "#0f172a");
          wallGrad.addColorStop(1, "#020617");
          ctx.fillStyle = wallGrad;
          ctx.fillRect(wx, wy, tileSize, tileSize);

          // Top highlight
          ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(wx, wy + 0.5);
          ctx.lineTo(wx + tileSize, wy + 0.5);
          ctx.stroke();

          // Left shadow edge
          ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
          ctx.beginPath();
          ctx.moveTo(wx + 0.5, wy);
          ctx.lineTo(wx + 0.5, wy + tileSize);
          ctx.stroke();
        }
      }
    }

    aiHiders.forEach((bot) => {
      if (!bot.alive && !bot.dying) return;

      drawPerson(bot, {
        color: COLORS.hider,
        lineWidth: 2,
        name: bot.name,
        nameColor: bot.dying ? "rgba(156,163,175,0.9)" : "rgba(165,180,252,0.95)",
      });
    });

    otherHumans.forEach((human) => {
      if (!human.alive && !human.dying) return;
      drawPerson(human, {
        color: human.role === "seeker" ? COLORS.playerSeeker : COLORS.playerHider,
        lineWidth: 2.1,
        name: human.name,
        nameColor:
          human.role === "seeker"
            ? "rgba(250,204,21,0.95)"
            : "rgba(165,180,252,0.95)",
      });
    });

    if (mutatedSeeker) {
      drawPerson(mutatedSeeker, {
        color: mutatedActive ? COLORS.mutated : COLORS.dead,
        lineWidth: 2.4,
        mutated: true,
      });
    }

    drawPerson(player, {
      color: role === "seeker" ? COLORS.playerSeeker : COLORS.playerHider,
      lineWidth: 2.15,
      name: isOnline ? player.name : null,
    });

    drawEffects();

    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      radiusPx * 0.3,
      width / 2,
      height / 2,
      radiusPx
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Minimap in top-right corner
    const mmSize = 164;
    const mmScale = mmSize / cols;
    const mmX = width - mmSize - 12;
    const mmY = 12;

    ctx.fillStyle = "rgba(2, 6, 23, 0.92)";
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 2;
    ctx.fillRect(mmX, mmY, mmSize, mmSize);
    ctx.strokeRect(mmX, mmY, mmSize, mmSize);

    for (let cy = 0; cy < rows; cy += 1) {
      for (let cx = 0; cx < cols; cx += 1) {
        const px = mmX + cx * mmScale;
        const py = mmY + cy * mmScale;
        if (grid[cy][cx] === 1) {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(px, py, Math.ceil(mmScale) + 1, Math.ceil(mmScale) + 1);
        } else {
          ctx.fillStyle = (cx + cy) % 2 === 0 ? "#0c1222" : "#050a12";
          ctx.fillRect(px, py, Math.ceil(mmScale) + 1, Math.ceil(mmScale) + 1);
        }
      }
    }

    aiHiders.forEach((bot) => {
      if (!bot.alive && !bot.dying) return;
      const mx = mmX + (bot.x / tileSize) * mmScale;
      const my = mmY + (bot.y / tileSize) * mmScale;
      ctx.fillStyle = bot.dying ? "#94a3b8" : "#22c55e";
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    otherHumans.forEach((human) => {
      if (!human.alive && !human.dying) return;
      const mx = mmX + (human.x / tileSize) * mmScale;
      const my = mmY + (human.y / tileSize) * mmScale;
      ctx.fillStyle = human.role === "seeker" ? "#facc15" : "#38bdf8";
      ctx.beginPath();
      ctx.arc(mx, my, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });

    if (mutatedSeeker) {
      const mx = mmX + (mutatedSeeker.x / tileSize) * mmScale;
      const my = mmY + (mutatedSeeker.y / tileSize) * mmScale;
      ctx.fillStyle = mutatedActive ? "#f97316" : "#64748b";
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const ppx = mmX + (player.x / tileSize) * mmScale;
    const ppy = mmY + (player.y / tileSize) * mmScale;
    ctx.fillStyle = role === "seeker" ? "#facc15" : "#38bdf8";
    ctx.beginPath();
    ctx.arc(ppx, ppy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  let running = false;
  let lastTime = 0;
  let frameId = null;
  let countdown =
    boot && typeof boot.countdown === "number" ? boot.countdown : 10;
  let gameTime = boot && typeof boot.gameTime === "number" ? boot.gameTime : 0;
  let netUnsub = null;
  let inputAcc = 0;
  let stateAcc = 0;
  let lastSentKeys = "";

  function currentKeySnapshot() {
    return {
      KeyW: keys.KeyW,
      KeyA: keys.KeyA,
      KeyS: keys.KeyS,
      KeyD: keys.KeyD,
      KeyE: keys.KeyE,
    };
  }

  function sendBoot() {
    if (!isHost || !network) return;
    network.send({
      type: "boot",
      grid,
      countdown,
      gameTime,
      humans: [packHuman(player), ...otherHumans.map(packHuman)],
      ais: aiHiders.map(packAi),
    });
  }

  function sendState() {
    if (!isHost || !network) return;
    network.send({
      type: "state",
      countdown,
      gameTime,
      mutatedActive,
      mutatedSeeker,
      humans: [packHuman(player), ...otherHumans.map(packHuman)],
      ais: aiHiders.map(packAi),
    });
  }

  function handleNetMessage(msg) {
    if (!msg) return;
    if (msg.type === "input" && isHost && msg.playerId && remoteKeys[msg.playerId]) {
      Object.assign(remoteKeys[msg.playerId], msg.keys || {});
    }
    if (msg.type === "state" && isClient) {
      applySnapshot(msg);
    }
    if (msg.type === "fx" && isClient && msg.color) {
      spawnTagBurst(msg.x, msg.y, msg.color);
    }
    if (msg.type === "roundOver" && isClient && !roundOver) {
      roundOver = true;
      if (typeof onGameOver === "function") onGameOver(msg.message || "Round over.");
    }
    if (msg.type === "peerLeft" && isHost) {
      const human = otherHumans.find((h) => h.id === msg.playerId);
      if (human && human.alive && !human.dying) {
        beginDeath(human, human.x, human.y, COLORS.dead);
      }
    }
  }

  function loop(timestamp) {
    if (!running) return;
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (!isClient) {
      countdown = Math.max(0, countdown - dt);
      gameTime += dt;
    }

    const timerEl = document.getElementById("game-timer-label");
    if (timerEl) {
      if (countdown > 0) {
        const roleText =
          role === "seeker"
            ? "You break free in"
            : hasHumanSeeker
              ? "Seeker breaks free in"
              : "Seeker spawns in";
        timerEl.textContent = `${roleText} ${countdown.toFixed(1)}s`;
      } else if (role === "seeker" || hasHumanSeeker) {
        timerEl.textContent =
          role === "seeker" ? "Hunt them! WASD to move, E to tag." : "RUN – the seeker is hunting!";
      } else {
        timerEl.textContent = "RUN – the seeker is hunting!";
      }
    }

    const aliveEl = document.getElementById("game-alive-label");
    if (aliveEl) {
      const aliveAIs = aiHiders.filter((b) => b.alive && !b.dying).length;
      const aliveHumans = [player, ...otherHumans].filter((h) => {
        if (h.role !== "hider") return false;
        if (h === player) return !playerDead;
        return h.alive && !h.dying;
      }).length;
      aliveEl.textContent = `${aliveAIs + aliveHumans} alive`;
    }

    if (isClient) {
      updatePlayer(dt);
      updateEffects(dt);
      inputAcc += dt;
      const packed = JSON.stringify(currentKeySnapshot());
      if (network && (packed !== lastSentKeys || inputAcc > 0.08)) {
        lastSentKeys = packed;
        inputAcc = 0;
        network.send({ type: "input", keys: currentKeySnapshot() });
      }
      render();
      frameId = requestAnimationFrame(loop);
      return;
    }

    if (!hasHumanSeeker && countdown <= 0) {
      ensureMutatedSeekerExists();
      mutatedActive = true;
    }

    updatePlayer(dt);
    updateOtherHumans(dt);
    updateAI(dt);
    updateMutatedSeeker(dt);
    updateEffects(dt);
    handleSeekerTag();
    checkPlayerDeath();
    checkRoundOver();

    if (isHost && network) {
      stateAcc += dt;
      if (stateAcc >= 0.08) {
        stateAcc = 0;
        sendState();
      }
    }

    render();

    frameId = requestAnimationFrame(loop);
  }

  function handleKeyDown(e) {
    if (e.code in keys) {
      keys[e.code] = true;
      // Prevent page scroll for movement keys
      if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyE"].includes(e.code)) {
        e.preventDefault();
      }
    }
  }

  function handleKeyUp(e) {
    if (e.code in keys) {
      keys[e.code] = false;
    }
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = 0;
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    if (network && typeof network.subscribe === "function") {
      netUnsub = network.subscribe(handleNetMessage);
    }
    if (isHost) sendBoot();
    frameId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    if (typeof netUnsub === "function") {
      netUnsub();
      netUnsub = null;
    }
  }

  return { start, stop, playerName };
}

