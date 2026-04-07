const chatSetup = document.getElementById("chatSetup");
const chatRoom = document.getElementById("chatRoom");
const createChatBtn = document.getElementById("createChat");
const joinChatBtn = document.getElementById("joinChat");
const leaveChatBtn = document.getElementById("leaveChat");
const chatNameInput = document.getElementById("chatName");
const chatCodeInput = document.getElementById("chatCode");
const chatStatus = document.getElementById("chatStatus");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const chatMessages = document.getElementById("chatMessages");
const chatSendForm = document.getElementById("chatSendForm");
const chatInput = document.getElementById("chatInput");

let peer = null;
let isHost = false;
let roomCode = "";
let username = "";
let hostConnection = null;
let clientConnections = [];

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

function leaveRoom() {
  clientConnections.forEach((conn) => conn.close());
  clientConnections = [];
  if (hostConnection) hostConnection.close();
  hostConnection = null;
  if (peer) peer.destroy();
  peer = null;
  isHost = false;
  roomCode = "";
  chatMessages.innerHTML = "";
  chatRoom.classList.add("hidden");
  chatSetup.classList.remove("hidden");
  roomCodeLabel.textContent = "";
  setStatus("You left the chat room.");
}

function showRoom(code) {
  roomCodeLabel.textContent = code;
  chatSetup.classList.add("hidden");
  chatRoom.classList.remove("hidden");
  setStatus("");
  addMessage("System", `Joined room ${code}`);
}

function broadcastToClients(payload) {
  clientConnections.forEach((conn) => {
    if (conn.open) conn.send(payload);
  });
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
  });
}

function createRoom(code, name) {
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
  username = name;
  roomCode = code;
  isHost = false;
  chatMessages.innerHTML = "";

  peer = new Peer();
  peer.on("open", () => {
    hostConnection = peer.connect(`merty-${code.toLowerCase()}`);
    hostConnection.on("open", () => {
      showRoom(code);
    });
    hostConnection.on("data", (payload) => {
      if (!payload || payload.type !== "message") return;
      addMessage(payload.name, payload.text);
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
  joinRoom(code, name);
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
