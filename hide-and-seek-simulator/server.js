const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_PLAYERS = 8;
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const rooms = new Map();

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

function safeFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const relative = clean === "/" ? "/index.html" : clean;
  const full = path.normalize(path.join(ROOT, relative));
  if (!full.startsWith(ROOT)) return null;
  return full;
}

function createCode() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let code = "";
    for (let i = 0; i < 5; i += 1) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return null;
}

function makeId() {
  return `p_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function lobbyPlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    isHost: p.id === room.hostId,
  }));
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, exceptWs = null) {
  for (const player of room.players.values()) {
    if (player.ws !== exceptWs) send(player.ws, msg);
  }
}

function destroyRoom(code, message) {
  const room = rooms.get(code);
  if (!room) return;
  broadcast(room, { type: "roomClosed", message: message || "The host left the round." });
  rooms.delete(code);
}

function leaveRoom(ws) {
  const room = ws.room;
  if (!room) return;
  const player = room.players.get(ws.playerId);
  room.players.delete(ws.playerId);
  ws.room = null;
  ws.playerId = null;

  if (player && player.id === room.hostId) {
    destroyRoom(room.code, "The host left the round.");
    return;
  }

  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }

  broadcast(room, { type: "peerLeft", playerId: player?.id, name: player?.name });
  broadcast(room, { type: "lobby", players: lobbyPlayers(room) });
}

function encodeFrame(data, opcode = 1) {
  const payload = Buffer.from(data);
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function attachWebSocket(socket, req) {
  const key = req.headers["sec-websocket-key"];
  const accept = crypto.createHash("sha1").update(key + WS_GUID).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      "\r\n"
  );

  const ws = {
    socket,
    readyState: 1,
    buf: Buffer.alloc(0),
    room: null,
    playerId: null,
    send(data) {
      if (ws.readyState !== 1) return;
      socket.write(encodeFrame(typeof data === "string" ? data : JSON.stringify(data), 1));
    },
    close() {
      if (ws.readyState !== 1) return;
      ws.readyState = 3;
      try {
        socket.write(encodeFrame("", 8));
      } catch (err) {
        // ignore
      }
      socket.end();
    },
  };

  socket.on("data", (chunk) => {
    ws.buf = Buffer.concat([ws.buf, chunk]);
    parseFrames(ws);
  });
  socket.on("close", () => {
    ws.readyState = 3;
    if (ws.onClose) ws.onClose();
  });
  socket.on("error", () => {
    ws.readyState = 3;
    if (ws.onClose) ws.onClose();
  });
  return ws;
}

function parseFrames(ws) {
  while (ws.buf.length >= 2) {
    const opcode = ws.buf[0] & 0x0f;
    const masked = (ws.buf[1] & 0x80) !== 0;
    let len = ws.buf[1] & 0x7f;
    let offset = 2;
    if (len === 126) {
      if (ws.buf.length < 4) return;
      len = ws.buf.readUInt16BE(2);
      offset = 4;
    } else if (len === 127) {
      if (ws.buf.length < 10) return;
      len = Number(ws.buf.readBigUInt64BE(2));
      offset = 10;
    }
    const maskLen = masked ? 4 : 0;
    if (ws.buf.length < offset + maskLen + len) return;
    const mask = masked ? ws.buf.slice(offset, offset + 4) : null;
    offset += maskLen;
    const encoded = ws.buf.slice(offset, offset + len);
    const payload = Buffer.alloc(len);
    for (let i = 0; i < len; i += 1) {
      payload[i] = encoded[i] ^ (mask ? mask[i % 4] : 0);
    }
    ws.buf = ws.buf.slice(offset + len);

    if (opcode === 8) {
      ws.readyState = 3;
      if (ws.onClose) ws.onClose();
      try {
        ws.socket.end();
      } catch (err) {
        // ignore
      }
      return;
    }
    if (opcode === 9) {
      ws.socket.write(encodeFrame(payload, 10));
      continue;
    }
    if (opcode === 1 && ws.onMessage) {
      ws.onMessage(payload.toString("utf8"));
    }
  }
}

function handleSocketMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(String(raw));
  } catch (err) {
    send(ws, { type: "error", message: "Invalid message." });
    return;
  }

  if (msg.type === "host") {
    if (ws.room) leaveRoom(ws);
    const code = createCode();
    if (!code) {
      send(ws, { type: "error", message: "Could not create a join code. Try again." });
      return;
    }
    const playerId = makeId();
    const role = msg.role === "seeker" ? "seeker" : "hider";
    const name = String(msg.name || "Host").slice(0, 16);
    const room = {
      code,
      hostId: playerId,
      started: false,
      players: new Map(),
    };
    room.players.set(playerId, { id: playerId, name, role, ws });
    rooms.set(code, room);
    ws.room = room;
    ws.playerId = playerId;
    send(ws, { type: "hosted", code, playerId });
    send(ws, { type: "lobby", players: lobbyPlayers(room) });
    return;
  }

  if (msg.type === "join") {
    if (ws.room) leaveRoom(ws);
    const code = String(msg.code || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    const room = rooms.get(code);
    if (!room) {
      send(ws, { type: "error", message: "No round found for that join code." });
      return;
    }
    if (room.started) {
      send(ws, { type: "error", message: "That round already started." });
      return;
    }
    if (room.players.size >= MAX_PLAYERS) {
      send(ws, { type: "error", message: "That round is full." });
      return;
    }
    const seekerTaken = [...room.players.values()].some((p) => p.role === "seeker");
    let role = msg.role === "seeker" ? "seeker" : "hider";
    let roleNote = null;
    if (role === "seeker" && seekerTaken) {
      role = "hider";
      roleNote = "The seeker seat was taken, so you joined as a hider.";
    }
    const playerId = makeId();
    const name = String(msg.name || "Player").slice(0, 16);
    room.players.set(playerId, { id: playerId, name, role, ws });
    ws.room = room;
    ws.playerId = playerId;
    send(ws, { type: "joined", code: room.code, playerId, role, roleNote });
    broadcast(room, { type: "lobby", players: lobbyPlayers(room) });
    return;
  }

  const room = ws.room;
  if (!room) {
    send(ws, { type: "error", message: "You are not in a round." });
    return;
  }

  if (msg.type === "leave") {
    leaveRoom(ws);
    return;
  }

  if (msg.type === "start") {
    if (ws.playerId !== room.hostId) {
      send(ws, { type: "error", message: "Only the host can start the round." });
      return;
    }
    if (room.players.size < 2) {
      send(ws, { type: "error", message: "Need at least 2 players to start." });
      return;
    }
    room.started = true;
    broadcast(room, { type: "starting", players: lobbyPlayers(room) });
    return;
  }

  if (msg.type === "input") {
    const host = room.players.get(room.hostId);
    if (host) send(host.ws, { type: "input", playerId: ws.playerId, keys: msg.keys || {} });
    return;
  }

  if (["boot", "state", "fx", "roundOver"].includes(msg.type)) {
    if (ws.playerId !== room.hostId) return;
    broadcast(room, msg, ws);
  }
}

const server = http.createServer((req, res) => {
  const url = req.url || "/";

  if (url.startsWith("/api/health")) {
    sendJson(res, 200, { ok: true, rooms: rooms.size });
    return;
  }

  const filePath = safeFile(url);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    const target = !err && stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    fs.readFile(target, (readErr, data) => {
      if (readErr) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(target);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  });
});

server.on("upgrade", (req, socket) => {
  if ((req.headers.upgrade || "").toLowerCase() !== "websocket") {
    socket.destroy();
    return;
  }
  const ws = attachWebSocket(socket, req);
  ws.onMessage = (raw) => handleSocketMessage(ws, raw);
  ws.onClose = () => leaveRoom(ws);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Hide & Seek server running on http://localhost:${PORT}`);
});
