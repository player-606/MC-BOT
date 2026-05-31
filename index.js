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
let loggedIn = false;
let connecting = false;
let alreadyOnlineRetries = 0;
let waitingForAlready = false; // true while backing off for "already online"

// ── Reconnect ─────────────────────────────────────────────────────────────
function scheduleReconnect(ms) {
  if (reconnectTimer) return;
  connecting = false;
  loggedIn = false;
  if (antiAfkInterval)  { clearInterval(antiAfkInterval);  antiAfkInterval  = null; }
  if (keepaliveInterval){ clearInterval(keepaliveInterval); keepaliveInterval = null; }
  if (positionInterval) { clearInterval(positionInterval);  positionInterval  = null; }
  console.log(`[${new Date().toISOString()}] ⏳ Reconnecting in ${ms/1000}s...`);
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
  } else if (rand < 0.5) {
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
  loggedIn = false;
  console.log(`[${new Date().toISOString()}] 🔌 Connecting...`);

  try {
    bot = mineflayer.createBot({
      host: HOST,
      port: PORT_MC,
      username: USERNAME,
      version: '1.21.11',
      checkTimeoutInterval: 300000, // 5 min — let OUR code handle keepalive
      hideErrors: false,
    });
  } catch (e) {
    console.log(`[${new Date().toISOString()}] ❌ Failed: ${e.message}`);
    connecting = false;
    scheduleReconnect(3000);
    return;
  }

  // Force reconnect if no spawn in 25s
  const spawnTimeout = setTimeout(() => {
    console.log(`[${new Date().toISOString()}] ⚠️ No spawn, reconnecting...`);
    try { bot.end(); } catch (e) {}
  }, 25000);

  // ── Manually respond to keepalive packets immediately ──────────────────
  // This is the key fix — mineflayer sometimes delays keepalive responses
  // which causes "Timed out" on the server side
  bot._client && bot._client.on('keep_alive', (packet) => {
    try {
      bot._client.write('keep_alive', { keepAliveId: packet.keepAliveId });
    } catch (e) {}
  });

  bot.on('spawn', () => {
    clearTimeout(spawnTimeout);
    connecting = false;
    alreadyOnlineRetries = 0; // reset on successful spawn
    waitingForAlready = false;
    console.log(`[${new Date().toISOString()}] ✅ Spawned!`);

    // Hook keepalive after spawn too (client exists for sure now)
    try {
      bot._client.removeAllListeners('keep_alive');
      bot._client.on('keep_alive', (packet) => {
        try {
          bot._client.write('keep_alive', { keepAliveId: packet.keepAliveId });
        } catch (e) {}
      });
    } catch(e) {}

    // Login
    setTimeout(() => {
      if (bot && !bot.ended) {
        bot.chat(`/login ${PASSWORD}`);
        loggedIn = true;
        console.log(`[${new Date().toISOString()}] 🔑 Login sent`);
      }
    }, 1500);

    // Send position packet every 1s so server never thinks we're gone
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
    }, 1000);

    // Swing arm every 3s as extra activity signal
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    keepaliveInterval = setInterval(() => {
      if (!bot || bot.ended || !bot.entity || !loggedIn) return;
      try { bot.swingArm(); } catch (e) {}
    }, 3000);

    // Anti-AFK every 10s
    if (antiAfkInterval) clearInterval(antiAfkInterval);
    antiAfkInterval = setInterval(doAntiAfk, 10000);
  });

  // Re-login if asked
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const msg = message.toLowerCase();
    if (msg.includes('login') || msg.includes('password') || msg.includes('logged out')) {
      loggedIn = false;
      setTimeout(() => {
        if (bot && !bot.ended) {
          bot.chat(`/login ${PASSWORD}`);
          loggedIn = true;
          console.log(`[${new Date().toISOString()}] 🔑 Re-logged in`);
        }
      }, 1000);
    }
  });

  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Respawning...`);
    setTimeout(() => bot && bot.respawn(), 500);
  });

  bot.on('kicked', (reason) => {
    clearTimeout(spawnTimeout);
    const r = (typeof reason === 'string' ? reason : JSON.stringify(reason) || '').toLowerCase();
    console.log(`[${new Date().toISOString()}] 👢 Kicked: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`);

    // If the username is already online, back off exponentially so we don't
    // spam-reconnect while the previous session is still alive on the server.
    if (r.includes('already')) {
      alreadyOnlineRetries++;
      waitingForAlready = true;
      // Backoff: 15s, 30s, 60s, 120s … capped at 5 minutes
      const delay = Math.min(15000 * Math.pow(2, alreadyOnlineRetries - 1), 5 * 60 * 1000);
      console.log(`[${new Date().toISOString()}] ⚠️ Username already online — waiting ${delay/1000}s before retry (attempt ${alreadyOnlineRetries})`);
      scheduleReconnect(delay);
      return;
    }

    alreadyOnlineRetries = 0;
    waitingForAlready = false;
    const delay = r.includes('throttl') ? 8000 : 2000;
    scheduleReconnect(delay);
  });

  bot.on('end', (reason) => {
    clearTimeout(spawnTimeout);
    console.log(`[${new Date().toISOString()}] 🔴 End: ${reason}`);
    if (waitingForAlready) return; // backoff timer already set by 'kicked'
    scheduleReconnect(2000);
  });

  bot.on('error', (err) => {
    clearTimeout(spawnTimeout);
    console.log(`[${new Date().toISOString()}] ❌ Error: ${err.message}`);
    if (waitingForAlready) return;
    scheduleReconnect(2000);
  });
}

createBot();

setInterval(() => {
  console.log(`[${new Date().toISOString()}] 💓 Connected:${bot ? !bot.ended : false} LoggedIn:${loggedIn}`);
}, 60000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
         
