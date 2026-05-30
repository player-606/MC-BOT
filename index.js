const mineflayer = require('mineflayer');
const http = require('http');

const HOST = '606smp.aternos.me';
const PORT_MC = 47593;
const USERNAME = 'Bot';
const PASSWORD = '@.Bot_2012.@';
const HTTP_PORT = process.env.PORT || 3000;

console.log('🚀 Aternos Keeper Bot starting...');

// ── HTTP server (required for Render to keep process alive) ───────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Bot alive. Connected: ${bot ? !bot.ended : false}\n`);
});
server.listen(HTTP_PORT, () => console.log(`[HTTP] Listening on port ${HTTP_PORT}`));

// ── Self-ping every 4 min so Render free tier doesn't sleep ───────────────
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || '';
if (RENDER_URL) {
  setInterval(() => {
    http.get(RENDER_URL, (res) => {
      console.log(`[${new Date().toISOString()}] 🏓 Self-ping ${res.statusCode}`);
    }).on('error', (e) => {
      console.error(`[${new Date().toISOString()}] Self-ping failed: ${e.message}`);
    });
  }, 4 * 60 * 1000);
}

// ── Bot ───────────────────────────────────────────────────────────────────
let bot = null;
let isRunning = false;
let antiAfkInterval = null;

function scheduleReconnect(ms, reason) {
  console.log(`[${new Date().toISOString()}] ⏳ Reconnecting in ${ms / 1000}s... (${reason})`);
  cleanup();
  setTimeout(createBot, ms);
}

function createBot() {
  if (isRunning) return;
  isRunning = true;
  console.log(`[${new Date().toISOString()}] 🔌 Connecting to ${HOST}:${PORT_MC}...`);

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT_MC,
    username: USERNAME,
    version: '1.21.1',
    checkTimeoutInterval: 600000,
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const msg = message.toLowerCase();
    if (msg.includes('login') || msg.includes('password') || msg.includes('log in') || msg.includes('logged out')) {
      console.log(`[${new Date().toISOString()}] 🔑 Login prompt detected, logging in...`);
      setTimeout(() => bot && !bot.ended && bot.chat(`/login ${PASSWORD}`), 3000);
    }
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Spawned! Sending login...`);
    setTimeout(() => bot && !bot.ended && bot.chat(`/login ${PASSWORD}`), 4000);

    if (antiAfkInterval) clearInterval(antiAfkInterval);
    antiAfkInterval = setInterval(() => {
      if (!bot || bot.ended || !bot.entity) return;
      const rand = Math.random();
      if (rand < 0.35) {
        bot.setControlState('jump', true);
        setTimeout(() => bot && bot.setControlState('jump', false), 280);
      } else if (rand < 0.65) {
        bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3);
      } else {
        bot.setControlState('forward', true);
        setTimeout(() => bot && bot.setControlState('forward', false), 350);
      }
    }, 35000);
  });

  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Died, respawning...`);
    setTimeout(() => bot && bot.respawn(), 4000);
  });

  bot.on('kicked', (reason) => {
    const r = (reason || '').toLowerCase();
    console.log(`[${new Date().toISOString()}] 👢 Kicked: ${reason}`);
    const delay =
      r.includes('throttl')       ? 90000  // throttled = wait 90s
      : r.includes('already')     ? 40000  // already playing = wait 40s
      : r.includes('maintenance') ? 60000
      : 25000;
    scheduleReconnect(delay, 'kicked');
  });

  bot.on('end', (reason) => {
    const r = (reason || '').toLowerCase();
    console.log(`[${new Date().toISOString()}] 🔴 Ended: ${reason}`);
    const delay =
      r.includes('throttl')   ? 90000
      : r.includes('already') ? 40000
      : 15000;
    scheduleReconnect(delay, 'end');
  });

  bot.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] ❌ Error: ${err.message}`);
    scheduleReconnect(15000, 'error');
  });
}

function cleanup() {
  isRunning = false;
  if (antiAfkInterval) { clearInterval(antiAfkInterval); antiAfkInterval = null; }
}

// Wait 60s on first start to clear any Aternos throttle from previous session
console.log(`[${new Date().toISOString()}] ⏳ Waiting 60s before first connect...`);
setTimeout(createBot, 60000);

// Heartbeat
setInterval(() => {
  console.log(`[${new Date().toISOString()}] 💓 Alive. Bot connected: ${bot ? !bot.ended : false}`);
}, 60000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
