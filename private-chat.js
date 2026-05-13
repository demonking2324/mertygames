const privateSetup = document.getElementById("privateSetup");
const privateJoinBlock = document.getElementById("privateJoinBlock");
const privateMineHint = document.getElementById("privateMineHint");
const privateGuestName = document.getElementById("privateGuestName");
const privateCodeInput = document.getElementById("privateCodeInput");
const privateJoinBtn = document.getElementById("privateJoinBtn");
const privateStatus = document.getElementById("privateStatus");
const privateRoom = document.getElementById("privateRoom");
const privateRoomLabel = document.getElementById("privateRoomLabel");
const privateMessages = document.getElementById("privateMessages");
const privateSendForm = document.getElementById("privateSendForm");
const privateInput = document.getElementById("privateInput");
const privateLeaveBtn = document.getElementById("privateLeaveBtn");

let peer = null;
let isHost = false;
let roomCode = "";
let username = "";
let hostConnection = null;
let clientConnections = [];

function setStatus(text, isError) {
  privateStatus.textContent = text;
  privateStatus.classList.toggle("chat-status-error", Boolean(isError));
}

function addMessage(name, text) {
  const item = document.createElement("div");
  item.className = "chat-message";
  const nameNode = document.createElement("b");
  nameNode.textContent = `${name}:`;
  item.appendChild(nameNode);
  item.appendChild(document.createTextNode(` ${text}`));
  privateMessages.appendChild(item);
  privateMessages.scrollTop = privateMessages.scrollHeight;
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

function showRoom(code) {
  roomCode = code;
  privateRoomLabel.textContent = code;
  privateSetup.classList.add("hidden");
  privateRoom.classList.remove("hidden");
  setStatus("");
  addMessage("System", `Connected (private ${code})`);
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
  username = "";
  privateMessages.innerHTML = "";
  privateRoom.classList.add("hidden");
  privateSetup.classList.remove("hidden");
  privateJoinBlock.classList.remove("hidden");
  privateMineHint.classList.add("hidden");
  setStatus("Left private chat.");
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
    setStatus("Disconnected from host.");
  }
}

function startHost(code, name) {
  username = name;
  isHost = true;
  roomCode = code;
  privateMessages.innerHTML = "";
  const peerId = mertyPrivatePeerId(code);
  peer = new Peer(peerId);
  peer.on("open", () => {
    showRoom(code);
  });
  peer.on("connection", (conn) => {
    conn.on("open", () => {
      attachHostConnection(conn);
      conn.send({ type: "message", name: "System", text: `${username} is hosting this private chat` });
    });
  });
  peer.on("error", () => {
    setStatus("Could not open private chat. Try again in a moment.");
    leaveRoom();
  });
}

function startGuest(code, name) {
  username = name;
  isHost = false;
  roomCode = code;
  privateMessages.innerHTML = "";
  const peerId = mertyPrivatePeerId(code);
  peer = new Peer();
  peer.on("open", () => {
    hostConnection = peer.connect(peerId);
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
    setStatus("Could not join. Check the code — the host may need to open their private chat first.");
    leaveRoom();
  });
}

privateJoinBtn.addEventListener("click", () => {
  setStatus("");
  const name = privateGuestName.value.trim().slice(0, 18);
  if (!name) {
    setStatus("Enter your name.", true);
    return;
  }
  const code = mertyCleanCode(privateCodeInput.value);
  if (code.length !== 8) {
    setStatus("Code must be exactly 8 letters or numbers.", true);
    return;
  }
  privateJoinBlock.classList.add("hidden");
  startGuest(code, name);
});

privateCodeInput.addEventListener("input", () => {
  privateCodeInput.value = mertyCleanCode(privateCodeInput.value);
});

privateSendForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = privateInput.value.trim();
  if (!text) return;
  sendMessage(text);
  privateInput.value = "";
});

privateLeaveBtn.addEventListener("click", leaveRoom);

function boot() {
  const params = new URLSearchParams(window.location.search);
  const mine = params.get("mine") === "1";
  const preCode = mertyCleanCode(params.get("code") || "");

  if (preCode.length === 8) {
    privateCodeInput.value = preCode;
  }

  if (mine) {
    privateJoinBlock.classList.add("hidden");
    privateMineHint.classList.remove("hidden");
    const display = mertyGetSessionDisplay();
    if (!display) {
      privateMineHint.classList.add("hidden");
      setStatus("Sign in on the Account page first.", true);
      privateJoinBlock.classList.remove("hidden");
      return;
    }
    const code = mertyGetPrivateChatCodeForSession();
    if (!code) {
      privateMineHint.classList.add("hidden");
      setStatus("Could not load your private code. Open Account and sign in again.", true);
      privateJoinBlock.classList.remove("hidden");
      return;
    }
    privateMineHint.textContent = `Your code is ${code}. Friends can join while this tab stays open.`;
    startHost(code, display);
    return;
  }

  privateMineHint.classList.add("hidden");
}

boot();
