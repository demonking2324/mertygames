const chatLaunch = document.getElementById("chatLaunch");
const chatPanel = document.getElementById("chatPanel");
const chatClose = document.getElementById("chatClose");
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

const gun = Gun(["https://gun-manhattan.herokuapp.com/gun"]);

let roomNode = null;
let roomCode = "";
let username = "";
let seenMessageIds = new Set();
let activeMap = null;

function openChat() {
  chatPanel.classList.remove("hidden");
}

function closeChat() {
  chatPanel.classList.add("hidden");
}

function setStatus(text) {
  chatStatus.textContent = text;
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function cleanCode(input) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function addMessage(name, text, localId) {
  const item = document.createElement("div");
  item.className = "chat-message";
  item.innerHTML = `<b>${name}:</b> ${text}`;
  if (localId) {
    item.dataset.id = localId;
  }
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function leaveRoom() {
  if (activeMap && roomNode) {
    roomNode.get("messages").map().off();
  }
  roomNode = null;
  activeMap = null;
  roomCode = "";
  seenMessageIds = new Set();
  chatMessages.innerHTML = "";
  chatRoom.classList.add("hidden");
  chatSetup.classList.remove("hidden");
  roomCodeLabel.textContent = "";
  setStatus("You left the chat room.");
}

function joinRoom(code, name) {
  roomCode = code;
  username = name;
  roomNode = gun.get(`mertygames-chat-${roomCode}`);
  seenMessageIds = new Set();
  chatMessages.innerHTML = "";

  roomCodeLabel.textContent = roomCode;
  chatSetup.classList.add("hidden");
  chatRoom.classList.remove("hidden");
  setStatus("");

  activeMap = roomNode.get("messages").map();
  activeMap.on((data, id) => {
    if (!data || !data.text || !data.name) return;
    if (seenMessageIds.has(id)) return;
    seenMessageIds.add(id);
    addMessage(data.name, data.text, id);
  });

  addMessage("System", `Joined room ${roomCode}`);
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
  const code = randomCode();
  joinRoom(code, name);
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
  if (!roomNode) return;
  const text = chatInput.value.trim();
  if (!text) return;
  roomNode.get("messages").set({
    name: username,
    text: text.slice(0, 200),
    ts: Date.now(),
  });
  chatInput.value = "";
});

leaveChatBtn.addEventListener("click", leaveRoom);
chatLaunch.addEventListener("click", openChat);
chatClose.addEventListener("click", closeChat);
