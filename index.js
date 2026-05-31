const mineflayer = require('mineflayer');
const http = require('http');
const https = require('https');

const HOST = '606smp.aternos.me';
const PORT_MC = 47593;
const USERNAME = 'Bot';
const PASSWORD = '@.Bot_2012.@';
const HTTP_PORT = process.env.PORT || 3000;

console.log('🚀 Aternos Keeper Bot starting...');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Bot alive. Connected: ${bot ? !bot.ended : false}\n`);
});
server.listen(HTTP_PORT, () => console.log(`[HTTP] Listening on port ${HTTP_PORT}`));

const RENDER_URL = process.env.RENDER_EXTERNAL_URL || '';
if (RENDER_URL) {
  setInterval(() => {
    const lib = RENDER_URL.startsWith('https') ? https : http;
    lib.get(RENDER_URL, (res) => {
      console.log(`[${new Date().toISOString()}] 🏓 Self-ping ${res.statusCode}`);
    }).on('error', (e) => {
      console.error(`[${new Date().toISOString()}] Self-ping failed: ${e.message}`);
    });
  }, 4 * 60 * 1000);
}

let bot = null;
let isRunning = false;
let antiAfkInterval = null;
let loggedIn = false;

function scheduleReconnect(ms, reason) {
  console.log(`[${new Date().toISOString()}] ⏳ Reconnecting in ${ms / 1000}s... (${reason})`);
  cleanup();
  setTimeout(createBot, ms);
}

function doAntiAfk() {
  if (!bot || bot.ended || !bot.entity) return;

  const rand = Math.random();

  if (rand < 0.25) {
    // Walk forward briefly then stop
    bot.setControlState('forward', true);
    setTimeout(() => {
      if (bot && !bot.ended) {
        bot.setControlState('forward', false);
        // Walk back
        setTimeout(() => {
          if (bot && !bot.ended) {
            bot.setControlState('back', true);
            setTimeout(() => bot && bot.setControlState('back', false), 400);
          }
        }, 600);
      }
    }, 500);

  } else if (rand < 0.5) {
    // Jump
    bot.setControlState('jump', true);
    setTimeout(() => bot && bot.setControlState('jump', false), 300);

  } else if (rand < 0.75) {
    // Rotate head slowly in a full circle
    let angle = 0;
    const spin = setInterval(() => {
      if (!bot || bot.ended) { clearInterval(spin); return; }
      angle += 0.3;
      bot.look(angle, (Math.random() - 0.5) * 0.2, false);
      if (angle >= Math.PI * 2) clearInterval(spin);
    }, 100);

  } else {
    // Sneak briefly
    bot.setControlState('sneak', true);
    setTimeout(() => bot && bot.setControlState('sneak', false), 800);
  }
}

function createBot() {
  if (isRunning) return;
  isRunning = true;
  loggedIn = false;
  console.log(`[${new Date().toISOString()}] 🔌 Connecting to ${HOST}:${PORT_MC}...`);

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT_MC,
    username: USERNAME,
    version: '1.21.11',
    checkTimeoutInterval: 600000,
  });

  let disconnected = false;
  function onDisconnect(label, reason, delay) {
    if (disconnected) return;
    disconnected = true;
    loggedIn = false;
    console.log(`[${new Date().toISOString()}] [${label}] ${reason}`);
    scheduleReconnect(delay, label);
  }

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const msg = message.toLowerCase();
    if (msg.includes('login') || msg.includes('password') || msg.includes('log in') || msg.includes('logged out')) {
      loggedIn = false;
      console.log(`[${new Date().toISOString()}] 🔑 Login prompt detected, logging in...`);
      setTimeout(() => {
        if (bot && !bot.ended) {
          bot.chat(`/login ${PASSWORD}`);
          loggedIn = true;
        }
      }, 2000);
    }
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Spawned!`);

    // Login on spawn
    setTimeout(() => {
      if (bot && !bot.ended) {
        bot.chat(`/login ${PASSWORD}`);
        loggedIn = true;
        console.log(`[${new Date().toISOString()}] 🔑 Sent login on spawn`);
      }
    }, 3000);

    // Start anti-AFK
    if (antiAfkInterval) clearInterval(antiAfkInterval);
    antiAfkInterval = setInterval(() => {
      if (!loggedIn) return; // don't move before logged in
      doAntiAfk();
    }, 15000); // every 15 seconds — aggressive enough to beat any AFK timer
  });

  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Died, respawning...`);
    setTimeout(() => bot && bot.respawn(), 3000);
  });

  bot.on('kicked', (reason) => {
    const r = (reason || '').toLowerCase();
    const delay =
      r.includes('throttl')   ? 15000
      : r.includes('already') ? 10000
      : 5000;
    onDisconnect('kicked', reason, delay);
  });

  bot.on('end', (reason) => {
    onDisconnect('end', reason, 5000);
  });

  bot.on('error', (err) => {
    onDisconnect('error', err.message, 5000);
  });
}

function cleanup() {
  isRunning = false;
  loggedIn = false;
  if (antiAfkInterval) { clearInterval(antiAfkInterval); antiAfkInterval = null; }
}

createBot();

setInterval(() => {
  console.log(`[${new Date().toISOString()}] 💓 Alive. Bot connected: ${bot ? !bot.ended : false} | Logged in: ${loggedIn}`);
}, 60000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
