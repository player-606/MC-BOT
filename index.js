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

// ── Self-ping every 1 min to prevent Render sleep ─────────────────────────
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || '';
if (RENDER_URL) {
  setInterval(() => {
    const lib = RENDER_URL.startsWith('https') ? https : http;
    lib.get(RENDER_URL, () => {}).on('error', () => {});
  }, 60 * 1000);
}

// ── State ──────────────────────────────────────────────────────────────────
let bot = null;
let reconnectTimer = null;
let antiAfkInterval = null;
let armSwingInterval = null;
let loggedIn = false;
let loginSent = false;
let connecting = false;
let alreadyOnlineRetries = 0;
let waitingForAlready = false;

// ── Cleanup ────────────────────────────────────────────────────────────────
function clearAllIntervals() {
  if (antiAfkInterval)  { clearInterval(antiAfkInterval);  antiAfkInterval  = null; }
  if (armSwingInterval) { clearInterval(armSwingInterval); armSwingInterval = null; }
}

// ── Reconnect ─────────────────────────────────────────────────────────────
function scheduleReconnect(ms) {
  if (reconnectTimer) return;
  connecting = false;
  loggedIn   = false;
  loginSent  = false;
  clearAllIntervals();
  console.log(`[${new Date().toISOString()}] ⏳ Reconnecting in ${ms / 1000}s...`);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; createBot(); }, ms);
}

// ── Anti-AFK ──────────────────────────────────────────────────────────────
function doAntiAfk() {
  if (!bot || bot.ended || !bot.entity || !loggedIn) return;
  const rand = Math.random();
  if (rand < 0.25) {
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
  } else if (rand < 0.50) {
    bot.setControlState('jump', true);
    setTimeout(() => bot && bot.setControlState('jump', false), 300);
  } else if (rand < 0.75) {
    let angle = 0;
    const spin = setInterval(() => {
      if (!bot || bot.ended) { clearInterval(spin); return; }
      angle += 0.3;
      bot.look(angle, (Math.random() - 0.5) * 0.2, false);
      if (angle >= Math.PI * 2) clearInterval(spin);
    }, 80);
  } else {
    bot.setControlState('sneak', true);
    setTimeout(() => bot && bot.setControlState('sneak', false), 700);
  }
}

// ── Bot ───────────────────────────────────────────────────────────────────
function createBot() {
  if (connecting) return;
  connecting = true;
  loggedIn   = false;
  loginSent  = false;
  console.log(`[${new Date().toISOString()}] 🔌 Connecting...`);

  try {
    bot = mineflayer.createBot({
      host: HOST,
      port: PORT_MC,
      username: USERNAME,
      version: '1.21.11',
      checkTimeoutInterval: 30000,
      hideErrors: false,
    });
  } catch (e) {
    console.log(`[${new Date().toISOString()}] ❌ Failed: ${e.message}`);
    connecting = false;
    scheduleReconnect(500);
    return;
  }

  // Bail if no spawn in 40s (Aternos can be slow to load)
  const spawnTimeout = setTimeout(() => {
    console.log(`[${new Date().toISOString()}] ⚠️ No spawn in 40s — reconnecting...`);
    try { bot.end(); } catch (e) {}
  }, 40000);

  // ── Spawn ──────────────────────────────────────────────────────────────
  bot.on('spawn', () => {
    clearTimeout(spawnTimeout);
    connecting = false;
    alreadyOnlineRetries = 0;
    waitingForAlready = false;
    console.log(`[${new Date().toISOString()}] ✅ Spawned!`);

    // Send /login once, 1.5s after spawn
    if (!loginSent) {
      setTimeout(() => {
        if (bot && !bot.ended && !loginSent) {
          bot.chat(`/login ${PASSWORD}`);
          loginSent = true;
          loggedIn  = true;
          console.log(`[${new Date().toISOString()}] 🔑 Login sent`);
        }
      }, 1500);
    }

    // Arm swing every 3s
    if (armSwingInterval) clearInterval(armSwingInterval);
    armSwingInterval = setInterval(() => {
      if (!bot || bot.ended || !bot.entity || !loggedIn) return;
      try { bot.swingArm(); } catch (e) {}
    }, 3000);

    // Anti-AFK every 8s
    if (antiAfkInterval) clearInterval(antiAfkInterval);
    antiAfkInterval = setInterval(doAntiAfk, 8000);
  });

  // ── Death → respawn in 500ms ───────────────────────────────────────────
  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Died — respawning in 500ms`);
    setTimeout(() => {
      try { if (bot && !bot.ended) bot.respawn(); } catch (e) {}
    }, 500);
  });

  // ── Re-login only if server asks ───────────────────────────────────────
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const msg = message.toLowerCase();
    if (
      msg.includes('please login') ||
      msg.includes('please log in') ||
      msg.includes('you have been logged out') ||
      (msg.includes('login') && msg.includes('password'))
    ) {
      loggedIn  = false;
      loginSent = false;
      setTimeout(() => {
        if (bot && !bot.ended && !loginSent) {
          bot.chat(`/login ${PASSWORD}`);
          loginSent = true;
          loggedIn  = true;
          console.log(`[${new Date().toISOString()}] 🔑 Re-logged in`);
        }
      }, 800);
    }
  });

  // ── Kicked ─────────────────────────────────────────────────────────────
  bot.on('kicked', (reason) => {
    clearTimeout(spawnTimeout);
    const raw = typeof reason === 'string' ? reason : JSON.stringify(reason) || '';
    const r   = raw.toLowerCase();
    console.log(`[${new Date().toISOString()}] 👢 Kicked: ${raw}`);

    // Username still alive on server — back off so we don't loop-kick
    if (r.includes('already')) {
      alreadyOnlineRetries++;
      waitingForAlready = true;
      const delay = Math.min(15000 * Math.pow(2, alreadyOnlineRetries - 1), 5 * 60 * 1000);
      console.log(`[${new Date().toISOString()}] ⚠️ Already online — waiting ${delay / 1000}s`);
      scheduleReconnect(delay);
      return;
    }

    // Throttled — wait longer
    if (r.includes('throttl') || r.includes('too many') || r.includes('slow down')) {
      scheduleReconnect(10000);
      return;
    }

    // Server restarting
    if (r.includes('restart') || r.includes('starting') || r.includes('maintenance')) {
      scheduleReconnect(15000);
      return;
    }

    alreadyOnlineRetries = 0;
    waitingForAlready    = false;
    scheduleReconnect(500); // reconnect in 0.5s
  });

  // ── End ────────────────────────────────────────────────────────────────
  bot.on('end', (reason) => {
    clearTimeout(spawnTimeout);
    console.log(`[${new Date().toISOString()}] 🔴 End: ${reason}`);
    if (waitingForAlready) return;
    scheduleReconnect(500); // reconnect in 0.5s
  });

  // ── Error ──────────────────────────────────────────────────────────────
  bot.on('error', (err) => {
    clearTimeout(spawnTimeout);
    console.log(`[${new Date().toISOString()}] ❌ Error: ${err.message}`);
    if (waitingForAlready) return;
    scheduleReconnect(500); // reconnect in 0.5s
  });
}

createBot();

// Heartbeat log every minute
setInterval(() => {
  console.log(`[${new Date().toISOString()}] 💓 Connected:${bot ? !bot.ended : false} LoggedIn:${loggedIn}`);
}, 60000);

process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
