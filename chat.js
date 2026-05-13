const chatSetup = document.getElementById("chatSetup");
const chatRoom = document.getElementById("chatRoom");
const createChatBtn = document.getElementById("createChat");
const joinChatBtn = document.getElementById("joinChat");
const joinPublicBtn = document.getElementById("joinPublicChat");
const leaveChatBtn = document.getElementById("leaveChat");
const chatNameInput = document.getElementById("chatName");
const chatCodeInput = document.getElementById("chatCode");
const chatStatus = document.getElementById("chatStatus");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const chatMessages = document.getElementById("chatMessages");
const chatSendForm = document.getElementById("chatSendForm");
const chatInput = document.getElementById("chatInput");

const PUBLIC_HOST_PEER_ID = "merty-pub-main";
const PUBLIC_CODES = new Set(["12345678", "ABCDEFGH"]);

let peer = null;
let isHost = false;
let isPublicLobby = false;
let roomCode = "";
let username = "";
let hostConnection = null;
let clientConnections = [];
let publicJoinTimer = null;

function setStatus(text) {
  chatStatus.textContent = text;
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function cleanCode(input) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function clearPublicJoinTimer() {
  if (publicJoinTimer) {
    clearTimeout(publicJoinTimer);
    publicJoinTimer = null;
  }
}

function destroyPeerOnly() {
  clearPublicJoinTimer();
  clientConnections.forEach((c) => c.close());
  clientConnections = [];
  if (hostConnection) {
    hostConnection.close();
    hostConnection = null;
  }
  if (peer) {
    peer.destroy();
    peer = null;
  }
  isHost = false;
}

function updateOnlineCountUI(n) {
  const line = document.getElementById("onlineCountLine");
  const val = document.getElementById("onlineCountValue");
  if (!line || !val) return;
  if (!isPublicLobby) {
    line.classList.add("hidden");
    return;
  }
  line.classList.remove("hidden");
  val.textContent = String(n);
}

function broadcastOnlineCount() {
  if (!isPublicLobby || !isHost) return;
  const n = clientConnections.filter((c) => c.open).length + 1;
  const payload = { type: "meta", meta: "online", count: n };
  broadcastToClients(payload);
  updateOnlineCountUI(n);
}

function addMessage(name, text) {
  const item = document.createElement("div");
  item.className = "chat-message";
  const nameNode = document.createElement("b");
  nameNode.textContent = `${name}:`;
  item.appendChild(nameNode);
  item.appendChild(document.createTextNode(` ${text}`));
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function leaveRoom(customStatus) {
  destroyPeerOnly();
  isPublicLobby = false;
  roomCode = "";
  username = "";
  chatMessages.innerHTML = "";
  chatRoom.classList.add("hidden");
  chatSetup.classList.remove("hidden");
  roomCodeLabel.textContent = "";
  updateOnlineCountUI(0);
  const line = document.getElementById("onlineCountLine");
  if (line) line.classList.add("hidden");
  setStatus(customStatus || "You left the chat room.");
}

function showRoom(code, titleOpt) {
  roomCode = code;
  roomCodeLabel.textContent = titleOpt != null ? titleOpt : code;
  chatSetup.classList.add("hidden");
  chatRoom.classList.remove("hidden");
  setStatus("");
  const line = document.getElementById("onlineCountLine");
  if (line) {
    if (!isPublicLobby || !isHost) line.classList.add("hidden");
  }
  addMessage("System", isPublicLobby ? "Welcome to Public chat." : `Joined room ${titleOpt || code}`);
  if (isPublicLobby && isHost) broadcastOnlineCount();
}

function broadcastToClients(payload) {
  clientConnections.forEach((conn) => {
    if (conn.open) conn.send(payload);
  });
}

function handleGuestData(payload) {
  if (payload?.type === "meta" && payload.meta === "online") {
    updateOnlineCountUI(payload.count);
    return;
  }
  if (!payload || payload.type !== "message") return;
  addMessage(payload.name, payload.text);
}

function attachHostConnection(conn) {
  clientConnections.push(conn);
  conn.on("data", (payload) => {
    if (!payload || payload.type !== "message") return;
    addMessage(payload.name, payload.text);
    broadcastToClients(payload);
  });
  conn.on("close", () => {
    clientConnections = clientConnections.filter((c) => c !== conn);
    if (isPublicLobby && isHost) broadcastOnlineCount();
  });
  if (isPublicLobby && isHost) broadcastOnlineCount();
}

function createRoom(code, name) {
  isPublicLobby = false;
  username = name;
  roomCode = code;
  isHost = true;
  chatMessages.innerHTML = "";

  peer = new Peer(`merty-${code.toLowerCase()}`);
  peer.on("open", () => {
    showRoom(code);
  });
  peer.on("connection", (conn) => {
    conn.on("open", () => {
      attachHostConnection(conn);
      conn.send({ type: "message", name: "System", text: `${username} opened room ${code}` });
    });
  });
  peer.on("error", () => {
    setStatus("Could not create room. Try another code.");
    leaveRoom();
  });
}

function joinRoom(code, name) {
  isPublicLobby = false;
  username = name;
  roomCode = code;
  isHost = false;
  chatMessages.innerHTML = "";

  peer = new Peer();
  peer.on("open", () => {
    hostConnection = peer.connect(`merty-${code.toLowerCase()}`);
    hostConnection.on("open", () => {
      hostConnection.on("data", handleGuestData);
      showRoom(code);
    });
    hostConnection.on("error", () => {
      setStatus("Connection lost.");
    });
  });
  peer.on("error", () => {
    setStatus("Could not join room. Check code and try again.");
    leaveRoom();
  });
}

function joinPublicAsGuestOnly(name, afterHostFail) {
  destroyPeerOnly();
  isPublicLobby = true;
  username = name;
  isHost = false;
  roomCode = "PUBLIC";
  chatMessages.innerHTML = "";

  peer = new Peer();
  peer.on("open", () => {
    hostConnection = peer.connect(PUBLIC_HOST_PEER_ID);
    hostConnection.on("open", () => {
      hostConnection.on("data", handleGuestData);
      showRoom("PUBLIC", "Public chat");
    });
    hostConnection.on("error", () => {
      leaveRoom(
        afterHostFail ? "Public chat is busy. Try again in a moment." : "Could not join Public chat."
      );
    });
  });
  peer.on("error", () => {
    leaveRoom("Could not join Public chat.");
  });
}

function becomePublicHost(name) {
  destroyPeerOnly();
  isPublicLobby = true;
  username = name;
  isHost = true;
  roomCode = "PUBLIC";
  chatMessages.innerHTML = "";

  peer = new Peer(PUBLIC_HOST_PEER_ID);
  peer.on("connection", (conn) => {
    conn.on("open", () => {
      attachHostConnection(conn);
      conn.send({ type: "message", name: "System", text: "Someone joined Public chat" });
    });
  });
  peer.on("open", () => {
    showRoom("PUBLIC", "Public chat");
    broadcastOnlineCount();
  });
  peer.on("error", () => {
    peer.destroy();
    peer = null;
    joinPublicAsGuestOnly(name, true);
  });
}

function joinPublicLobby(name) {
  destroyPeerOnly();
  isPublicLobby = true;
  username = name;
  isHost = false;
  roomCode = "PUBLIC";
  chatMessages.innerHTML = "";

  let settled = false;

  peer = new Peer();
  peer.on("open", () => {
    hostConnection = peer.connect(PUBLIC_HOST_PEER_ID);
    publicJoinTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearPublicJoinTimer();
      try {
        hostConnection.close();
      } catch {
        /* ignore */
      }
      hostConnection = null;
      peer.destroy();
      peer = null;
      becomePublicHost(name);
    }, 4200);

    hostConnection.on("open", () => {
      if (settled) return;
      settled = true;
      clearPublicJoinTimer();
      isHost = false;
      hostConnection.on("data", handleGuestData);
      showRoom("PUBLIC", "Public chat");
    });

    hostConnection.on("error", () => {
      if (settled) return;
      settled = true;
      clearPublicJoinTimer();
      try {
        hostConnection.close();
      } catch {
        /* ignore */
      }
      hostConnection = null;
      peer.destroy();
      peer = null;
      becomePublicHost(name);
    });
  });

  peer.on("error", () => {
    if (settled) return;
    settled = true;
    clearPublicJoinTimer();
    becomePublicHost(name);
  });
}

function sendMessage(text) {
  const payload = { type: "message", name: username, text: text.slice(0, 200), ts: Date.now() };
  if (isHost) {
    addMessage(payload.name, payload.text);
    broadcastToClients(payload);
    return;
  }
  if (hostConnection && hostConnection.open) {
    hostConnection.send(payload);
  } else {
    setStatus("You are disconnected from host.");
  }
}

function validateName() {
  const raw = chatNameInput.value.trim();
  if (!raw) {
    setStatus("Enter your name first.");
    return null;
  }
  return raw.slice(0, 18);
}

createChatBtn.addEventListener("click", () => {
  const name = validateName();
  if (!name) return;
  createRoom(randomCode(), name);
});

joinChatBtn.addEventListener("click", () => {
  const name = validateName();
  if (!name) return;
  const code = cleanCode(chatCodeInput.value);
  if (code.length !== 8) {
    setStatus("Room code must be exactly 8 letters/numbers.");
    return;
  }
  if (PUBLIC_CODES.has(code)) {
    joinPublicLobby(name);
    return;
  }
  joinRoom(code, name);
});

joinPublicBtn.addEventListener("click", () => {
  const name = validateName();
  if (!name) return;
  joinPublicLobby(name);
});

chatCodeInput.addEventListener("input", () => {
  chatCodeInput.value = cleanCode(chatCodeInput.value);
});

chatSendForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  sendMessage(text);
  chatInput.value = "";
});

leaveChatBtn.addEventListener("click", leaveRoom);
