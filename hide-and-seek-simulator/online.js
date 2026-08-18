function generateJoinCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function makeLocalId() {
  return `p_${Math.random().toString(36).slice(2, 8)}`;
}

function createOnlineClient() {
  const handlers = new Set();
  const state = {
    transport: null,
    isHost: false,
    localId: null,
    code: null,
    players: [],
    ws: null,
    peer: null,
    connections: new Map(),
    hostConn: null,
  };

  function emit(msg) {
    handlers.forEach((fn) => fn(msg));
  }

  function reset() {
    if (state.ws) {
      try {
        state.ws.close();
      } catch (err) {
        // ignore
      }
    }
    state.connections.forEach((conn) => {
      try {
        conn.close();
      } catch (err) {
        // ignore
      }
    });
    if (state.hostConn) {
      try {
        state.hostConn.close();
      } catch (err) {
        // ignore
      }
    }
    if (state.peer) {
      try {
        state.peer.destroy();
      } catch (err) {
        // ignore
      }
    }
    state.transport = null;
    state.isHost = false;
    state.localId = null;
    state.code = null;
    state.players = [];
    state.ws = null;
    state.peer = null;
    state.connections = new Map();
    state.hostConn = null;
  }

  async function hasLocalServer() {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data.ok;
    } catch (err) {
      return false;
    }
  }

  function sendJson(target, msg) {
    if (!target) return;
    if (typeof target.send === "function") {
      if (target.readyState === 1 || target.open) {
        target.send(typeof msg === "string" ? msg : JSON.stringify(msg));
      }
    }
  }

  function handleIncoming(msg, fromId) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "input" && !msg.playerId && fromId) {
      msg.playerId = fromId;
    }
    if (msg.type === "lobby") {
      state.players = msg.players || [];
    }
    if (msg.type === "hosted" || msg.type === "joined") {
      state.localId = msg.playerId;
      state.code = msg.code;
    }
    emit(msg);
  }

  function attachWs(ws) {
    state.ws = ws;
    state.transport = "ws";
    ws.addEventListener("message", (event) => {
      try {
        handleIncoming(JSON.parse(event.data));
      } catch (err) {
        emit({ type: "error", message: "Bad network message." });
      }
    });
    ws.addEventListener("close", () => {
      emit({ type: "roomClosed", message: "Disconnected from the round." });
    });
  }

  function connectWs() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}`);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("Timed out connecting to the game server."));
      }, 6000);
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        attachWs(ws);
        resolve(ws);
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Could not reach the game server. Run npm start."));
      });
    });
  }

  function waitFor(wsOrConn, types, timeoutMs = 8000) {
    const wanted = new Set(Array.isArray(types) ? types : [types]);
    return new Promise((resolve, reject) => {
      const unsub = subscribe((msg) => {
        if (wanted.has(msg.type)) {
          cleanup();
          resolve(msg);
        } else if (msg.type === "error") {
          cleanup();
          reject(new Error(msg.message || "Network error."));
        }
      });
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("No response from the round."));
      }, timeoutMs);
      function cleanup() {
        clearTimeout(timer);
        unsub();
      }
    });
  }

  function peerIdFor(code) {
    return `hnsround-${String(code).toLowerCase()}`;
  }

  function ensurePeerJs() {
    if (typeof Peer !== "function") {
      throw new Error("Online play needs a network. Run npm start, or check your connection.");
    }
  }

  function bindPeerConn(conn, remoteId, isHostSide) {
    conn.on("data", (data) => {
      const msg = typeof data === "string" ? JSON.parse(data) : data;
      handleIncoming(msg, remoteId);
      if (isHostSide && msg.type === "hello") {
        admitPeer(conn, msg);
      }
    });
    conn.on("close", () => {
      state.connections.delete(conn.peer);
      if (state.isHost) {
        state.players = state.players.filter((p) => p.id !== conn.peer);
        broadcastPeer({ type: "lobby", players: state.players });
        emit({ type: "peerLeft", playerId: conn.peer });
        emit({ type: "lobby", players: state.players });
      } else {
        emit({ type: "roomClosed", message: "The host left the round." });
      }
    });
  }

  function broadcastPeer(msg, exceptConn = null) {
    state.connections.forEach((conn) => {
      if (conn !== exceptConn && conn.open) conn.send(msg);
    });
  }

  function admitPeer(conn, hello) {
    const seekerTaken = state.players.some((p) => p.role === "seeker");
    let role = hello.role === "seeker" ? "seeker" : "hider";
    let roleNote = null;
    if (role === "seeker" && seekerTaken) {
      role = "hider";
      roleNote = "The seeker seat was taken, so you joined as a hider.";
    }
    if (state.players.length >= 8) {
      conn.send({ type: "error", message: "That round is full." });
      conn.close();
      return;
    }
    const player = {
      id: conn.peer,
      name: String(hello.name || "Player").slice(0, 16),
      role,
      isHost: false,
    };
    state.players.push(player);
    conn.send({ type: "joined", code: state.code, playerId: player.id, role, roleNote });
    const lobby = { type: "lobby", players: state.players };
    broadcastPeer(lobby);
    emit(lobby);
  }

  async function hostWithPeer({ name, role }) {
    ensurePeerJs();
    let lastError = null;
    for (let i = 0; i < 6; i += 1) {
      const code = generateJoinCode();
      try {
        await new Promise((resolve, reject) => {
          const peer = new Peer(peerIdFor(code));
          const timer = setTimeout(() => {
            peer.destroy();
            reject(new Error("Could not create a join code. Try again."));
          }, 7000);
          peer.on("open", () => {
            clearTimeout(timer);
            state.peer = peer;
            state.transport = "peer";
            state.isHost = true;
            state.code = code;
            state.localId = peer.id;
            state.players = [
              {
                id: peer.id,
                name: String(name || "Host").slice(0, 16),
                role: role === "seeker" ? "seeker" : "hider",
                isHost: true,
              },
            ];
            peer.on("connection", (conn) => {
              state.connections.set(conn.peer, conn);
              conn.on("open", () => bindPeerConn(conn, conn.peer, true));
            });
            resolve();
          });
          peer.on("error", (err) => {
            clearTimeout(timer);
            peer.destroy();
            reject(err);
          });
        });
        emit({ type: "hosted", code, playerId: state.localId });
        emit({ type: "lobby", players: state.players });
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("Could not host a round.");
  }

  async function joinWithPeer({ code, name, role }) {
    ensurePeerJs();
    const clean = String(code || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      const timer = setTimeout(() => {
        peer.destroy();
        reject(new Error("Timed out joining that round."));
      }, 9000);

      function fail(err) {
        clearTimeout(timer);
        try {
          peer.destroy();
        } catch (e) {
          // ignore
        }
        reject(err instanceof Error ? err : new Error("Could not join that round."));
      }

      peer.on("open", () => {
        const conn = peer.connect(peerIdFor(clean), { reliable: true });
        conn.on("open", () => {
          state.peer = peer;
          state.hostConn = conn;
          state.transport = "peer";
          state.isHost = false;
          state.code = clean;
          bindPeerConn(conn, conn.peer, false);
          const unsub = subscribe((msg) => {
            if (msg.type === "joined") {
              clearTimeout(timer);
              unsub();
              resolve(msg);
            } else if (msg.type === "error") {
              unsub();
              fail(new Error(msg.message));
            }
          });
          conn.send({ type: "hello", name, role });
        });
        conn.on("error", fail);
      });
      peer.on("error", fail);
    });
  }

  async function host({ name, role }) {
    reset();
    if (await hasLocalServer()) {
      state.isHost = true;
      const ws = await connectWs();
      const pending = waitFor(ws, ["hosted", "error"]);
      sendJson(ws, { type: "host", name, role });
      const result = await pending;
      if (result.type === "error") throw new Error(result.message);
      return result;
    }
    return hostWithPeer({ name, role });
  }

  async function join({ code, name, role }) {
    reset();
    const clean = String(code || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!clean) throw new Error("Enter a join code.");
    if (await hasLocalServer()) {
      state.isHost = false;
      const ws = await connectWs();
      const pending = waitFor(ws, ["joined", "error"]);
      sendJson(ws, { type: "join", code: clean, name, role });
      const result = await pending;
      if (result.type === "error") throw new Error(result.message);
      if (result.role) {
        const self = state.players.find((p) => p.id === result.playerId);
        if (self) self.role = result.role;
      }
      return result;
    }
    return joinWithPeer({ code: clean, name, role });
  }

  function start() {
    if (!state.isHost) return;
    if (state.transport === "ws") {
      sendJson(state.ws, { type: "start" });
      return;
    }
    emit({ type: "starting", players: state.players });
    broadcastPeer({ type: "starting", players: state.players });
  }

  function send(msg) {
    if (state.transport === "ws") {
      sendJson(state.ws, msg);
      return;
    }
    if (state.isHost) {
      broadcastPeer(msg);
      return;
    }
    if (state.hostConn && state.hostConn.open) {
      state.hostConn.send(msg);
    }
  }

  function subscribe(fn) {
    handlers.add(fn);
    return () => handlers.delete(fn);
  }

  function leave() {
    if (state.transport === "ws" && state.ws) {
      sendJson(state.ws, { type: "leave" });
    }
    reset();
  }

  return {
    host,
    join,
    start,
    send,
    subscribe,
    leave,
    get isHost() {
      return state.isHost;
    },
    get localId() {
      return state.localId;
    },
    get code() {
      return state.code;
    },
    get players() {
      return state.players;
    },
    get transport() {
      return state.transport;
    },
  };
}
