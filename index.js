const mineflayer = require('mineflayer');
const http = require('http');

const HOST = '606smp.aternos.me';
const USERNAME = 'Bot';
const PASSWORD = '@.Bot_2012.@';
const PORT = process.env.PORT || 3000;

console.log('🚀 Aternos Keeper Bot (Stealth Mode)...');

// ── HTTP server so Render keeps the process alive ──────────────────────────
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Bot is running. Connected: ${bot ? !bot.ended : false}\n`);
});
server.listen(PORT, () => console.log(`[HTTP] Keepalive server on port ${PORT}`));

// ── Self-ping every 4 minutes to prevent Render free-tier sleep ────────────
// Replace <your-app-name> with your actual Render service URL
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || '';
if (RENDER_URL) {
  setInterval(() => {
    http.get(RENDER_URL, (res) => {
      console.log(`[${new Date().toISOString()}] 🏓 Self-ping OK (${res.statusCode})`);
    }).on('error', (e) => {
      console.error(`[${new Date().toISOString()}] Self-ping failed:`, e.message);
    });
  }, 4 * 60 * 1000); // every 4 minutes
}

// ── Bot logic ──────────────────────────────────────────────────────────────
let bot = null;
let isRunning = false;
let antiAfkInterval = null;

function createBot() {
  if (isRunning) return;
  isRunning = true;
  console.log(`[${new Date().toISOString()}] Connecting as ${USERNAME}...`);

  bot = mineflayer.createBot({
    host: HOST,
    username: USERNAME,
    version: '1.21.1',           // ← pinned to your server version
    checkTimeoutInterval: 600000,
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const msg = message.toLowerCase();
    if (
      msg.includes('login') ||
      msg.includes('password') ||
      msg.includes('log in') ||
      msg.includes('logged out')
    ) {
      console.log(`[${new Date().toISOString()}] 🔑 Sending login...`);
      setTimeout(() => bot && !bot.ended && bot.chat(`/login ${PASSWORD}`), 3000);
    }
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Bot spawned! Stealth anti-AFK active.`);

    // Login on spawn
    setTimeout(() => {
      if (bot && !bot.ended) bot.chat(`/login ${PASSWORD}`);
    }, 4000);

    // Clear any old interval before creating a new one
    if (antiAfkInterval) clearInterval(antiAfkInterval);

    antiAfkInterval = setInterval(() => {
      if (!bot || bot.ended || !bot.entity) return;
      const rand = Math.random();
      if (rand < 0.35) {
        bot.setControlState('jump', true);
        setTimeout(() => bot && bot.setControlState('jump', false), 280);
        console.log(`[${new Date().toISOString()}] 🦘 Soft jump`);
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

  bot.on('end', (reason) => {
    console.log(`[${new Date().toISOString()}] Disconnected: ${reason}`);
    cleanup();
    const lower = (reason || '').toLowerCase();
    const delay =
      lower.includes('username') || lower.includes('already playing')
        ? 35000
        : 12000;
    setTimeout(createBot, delay);
  });

  bot.on('kicked', (reason) => {
    console.log(`[${new Date().toISOString()}] Kicked: ${reason}`);
    cleanup();
    setTimeout(createBot, 25000);
  });

  bot.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    cleanup();
    setTimeout(createBot, 15000);
  });
}

function cleanup() {
  isRunning = false;
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
    antiAfkInterval = null;
  }
}

createBot();

// Heartbeat log
setInterval(() => {
  console.log(`[${new Date().toISOString()}] ✅ Process alive. Bot connected: ${bot ? !bot.ended : false}`);
}, 60000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
