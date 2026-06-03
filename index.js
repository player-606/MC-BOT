const mineflayer = require('mineflayer');
const http = require('http');
const https = require('https');

const HOST = '606smp.aternos.me';
const PORT_MC = 47593;
const USERNAME = 'Bot';
const PASSWORD = '@.Bot_2012.@';
const HTTP_PORT = process.env.PORT || 3000;

console.log('🚀 Bot starting...');

// ── HTTP server ────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end(`alive:${bot ? !bot.ended : false}\n`);
});
server.listen(HTTP_PORT, () => console.log(`[HTTP] Port ${HTTP_PORT}`));

// ── Self-ping every 2 min ─────────────────────────────────────────────────
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || '';
if (RENDER_URL) {
  setInterval(() => {
    const lib = RENDER_URL.startsWith('https') ? https : http;
    lib.get(RENDER_URL, () => {}).on('error', () => {});
  }, 2 * 60 * 1000);
}

// ── State ──────────────────────────────────────────────────────────────────
let bot = null;
let reconnectTimer = null;
let antiAfkInterval = null;
let keepaliveInterval = null;
let positionInterval = null;
let packetKeepaliveAttached = false;
let loggedIn = false;
let connecting = false;
let alreadyOnlineRetries = 0;
let waitingForAlready = false;
let loginSent = false; // guard: only send /login once per session

// ── Cleanup all intervals ──────────────────────────────────────────────────
function clearAllIntervals() {
  if (antiAfkInterval)  { clearInterval(antiAfkInterval);  antiAfkInterval  = null; }
  if (keepaliveInterval){ clearInterval(keepaliveInterval); keepaliveInterval = null; }
  if (positionInterval) { clearInterval(positionInterval);  positionInterval  = null; }
  packetKeepaliveAttached = false;
}

// ── Reconnect ─────────────────────────────────────────────────────────────
function scheduleReconnect(ms) {
  if (reconnectTimer) return;
  connecting = false;
  loggedIn = false;
  loginSent = false;
  clearAllIntervals();
  console.log(`[${new Date().toISOString()}] ⏳ Reconnecting in ${ms / 1000}s...`);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; createBot(); }, ms);
}

// ── Attach packet-level keepalive (call once per client) ──────────────────
// This is the #1 fix for "Timed out" kicks. We intercept the raw keep_alive
// packet and reply instantly, before mineflayer's own (sometimes delayed) handler.
function attachPacketKeepalive() {
  if (!bot || !bot._client || packetKeepaliveAttached) return;
  packetKeepaliveAttached = true;
  bot._client.on('keep_alive', (packet) => {
    try {
      bot._client.write('keep_alive', { keepAliveId: packet.keepAliveId });
    } catch (e) {}
  });
}

// ── Anti-AFK ──────────────────────────────────────────────────────────────
function doAntiAfk() {
  if (!bot || bot.ended || !bot.entity || !loggedIn) return;
  const rand = Math.random();

  if (rand < 0.20) {
    // Walk forward then back
    bot.setControlState('forward', true);
    setTimeout(() => {
      if (!bot || bot.ended) return;
      bot.setControlState('forward', false);
      setTimeout(() => {
        if (!bot || bot.ended) return;
        bot.setControlState('back', true);
        setTimeout(() => bot && bot.setControlState('back', false), 400);
      }, 500);
    }, 500);

  } else if (rand < 0.40) {
    // Jump
    bot.setControlState('jump', true);
    setTimeout(() => bot && bot.setControlState('jump', false), 300);

  } else if (rand < 0.55) {
    // Full 360 spin with slight pitch variation
    let angle = 0;
    const spin = setInterval(() => {
      if (!bot || bot.ended) { clearInterval(spin); return; }
      angle += 0.25;
      bot.look(angle, (Math.random() - 0.5) * 0.15, false);
      if (angle >= Math.PI * 2) clearInterval(spin);
    }, 60);

  } else if (rand < 0.65) {
    // Sneak + stand
    bot.setControlState('sneak', true);
    setTimeout(() => bot && bot.setControlState('sneak', false), 700);

  } else if (rand < 0.80) {
    // Swing arm (shows activity in server logs)
    try { bot.swingArm(); } catch (e) {}

  } else if (rand < 0.90) {
    // Open and close inventory
    try {
      bot.openInventory();
      setTimeout(() => {
        try { if (bot && bot.currentWindow) bot.closeWindow(bot.currentWindow); } catch (e) {}
      }, 1200);
    } catch (e) {}

  } else {
    // Random look direction
    const yaw   = (Math.random() * Math.PI * 2) - Math.PI;
    const pitch = (Math.random() - 0.5) * 0.6;
    try { bot.look(yaw, pitch, true); } catch (e) {}
  }
}

// ── Bot ───────────────────────────────────────────────────────────────────
function createBot() {
  if (connecting) return;
  connecting = true;
  loggedIn = false;
  loginSent = false;
  console.log(`[${new Date().toISOString()}] 🔌 Connecting...`);

  try {
    bot = mineflayer.createBot({
      host: HOST,
      port: PORT_MC,
      username: USERNAME,
      version: '1.21.11',             // DO NOT CHANGE
      checkTimeoutInterval: 600000,   // 10 min — we handle keepalive ourselves
      hideErrors: false,
    });
  } catch (e) {
    console.log(`[${new Date().toISOString()}] ❌ Failed to create bot: ${e.message}`);
    connecting = false;
    scheduleReconnect(3000);
    return;
  }

  // Attach keepalive handler as early as possible (before spawn)
  attachPacketKeepalive();

  // Bail out if no spawn within 40s (Aternos can be slow)
  const spawnTimeout = setTimeout(() => {
    console.log(`[${new Date().toISOString()}] ⚠️ No spawn in 40s — reconnecting...`);
    try { bot.end(); } catch (e) {}
  }, 40000);

  // ── Spawn ─────────────────────────────────────────────────────────────
  bot.on('spawn', () => {
    clearTimeout(spawnTimeout);
    connecting = false;
    alreadyOnlineRetries = 0;
    waitingForAlready = false;
    console.log(`[${new Date().toISOString()}] ✅ Spawned!`);

    // Re-attach keepalive now that client is fully live
    packetKeepaliveAttached = false;
    attachPacketKeepalive();

    // ── /login (once only) ──────────────────────────────────────────────
    if (!loginSent) {
      setTimeout(() => {
        if (bot && !bot.ended && !loginSent) {
          bot.chat(`/login ${PASSWORD}`);
          loginSent = true;
          loggedIn = true;
          console.log(`[${new Date().toISOString()}] 🔑 Login sent`);
        }
      }, 1500);
    }

    // ── Position packets every 500ms ───────────────────────────────────
    // Keeps the server satisfied that the client is alive and moving
    if (positionInterval) clearInterval(positionInterval);
    positionInterval = setInterval(() => {
      if (!bot || bot.ended || !bot.entity) return;
      try {
        bot._client.write('position', {
          x: bot.entity.position.x,
          y: bot.entity.position.y,
          z: bot.entity.position.z,
          flags: 0,
          teleportId: 0,
        });
      } catch (e) {}
    }, 500);

    // ── Arm swing every 4s ─────────────────────────────────────────────
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    keepaliveInterval = setInterval(() => {
      if (!bot || bot.ended || !bot.entity || !loggedIn) return;
      try { bot.swingArm(); } catch (e) {}
    }, 4000);

    // ── Anti-AFK every 8s ──────────────────────────────────────────────
    if (antiAfkInterval) clearInterval(antiAfkInterval);
    antiAfkInterval = setInterval(doAntiAfk, 8000);
  });

  // ── Re-login only if the server actually asks ──────────────────────────
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const msg = message.toLowerCase();
    const needsLogin =
      msg.includes('please login') ||
      msg.includes('please log in') ||
      msg.includes('/login') ||
      msg.includes('you have been logged out') ||
      (msg.includes('login') && msg.includes('password'));

    if (needsLogin && loggedIn) {
      loggedIn = false;
      loginSent = false;
      setTimeout(() => {
        if (bot && !bot.ended && !loginSent) {
          bot.chat(`/login ${PASSWORD}`);
          loginSent = true;
          loggedIn = true;
          console.log(`[${new Date().toISOString()}] 🔑 Re-logged in (server requested)`);
        }
      }, 800);
    }
  });

  // ── Death → respawn instantly ──────────────────────────────────────────
  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Died — respawning...`);
    setTimeout(() => { try { bot && bot.respawn(); } catch (e) {} }, 300);
  });

  // ── Kicked ─────────────────────────────────────────────────────────────
  bot.on('kicked', (reason) => {
    clearTimeout(spawnTimeout);
    const raw = typeof reason === 'string' ? reason : JSON.stringify(reason) || '';
    const r = raw.toLowerCase();
    console.log(`[${new Date().toISOString()}] 👢 Kicked: ${raw}`);

    if (r.includes('already')) {
      // Username still live on server — back off exponentially so we don't
      // spam-reconnect into an infinite kick loop
      alreadyOnlineRetries++;
      waitingForAlready = true;
      const delay = Math.min(15000 * Math.pow(2, alreadyOnlineRetries - 1), 5 * 60 * 1000);
      console.log(`[${new Date().toISOString()}] ⚠️ Username already online — waiting ${delay / 1000}s (attempt ${alreadyOnlineRetries})`);
      scheduleReconnect(delay);
      return;
    }

    // Throttle / rate-limit kick
    if (r.includes('throttl') || r.includes('too many') || r.includes('slow down')) {
      scheduleReconnect(10000);
      return;
    }

    // Server restarting / not ready
    if (r.includes('restart') || r.includes('starting') || r.includes('maintenance')) {
      scheduleReconnect(20000);
      return;
    }

    alreadyOnlineRetries = 0;
    waitingForAlready = false;
    scheduleReconnect(3000);
  });

  // ── End ────────────────────────────────────────────────────────────────
  bot.on('end', (reason) => {
    clearTimeout(spawnTimeout);
    console.log(`[${new Date().toISOString()}] 🔴 End: ${reason}`);
    if (waitingForAlready) return; // backoff timer already set
    scheduleReconnect(3000);
  });

  // ── Error ──────────────────────────────────────────────────────────────
  bot.on('error', (err) => {
    clearTimeout(spawnTimeout);
    console.log(`[${new Date().toISOString()}] ❌ Error: ${err.message}`);
    if (waitingForAlready) return;
    scheduleReconnect(3000);
  });
}

createBot();

// ── Heartbeat log every minute ────────────────────────────────────────────
setInterval(() => {
  console.log(`[${new Date().toISOString()}] 💓 Connected:${bot ? !bot.ended : false} LoggedIn:${loggedIn}`);
}, 60000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
