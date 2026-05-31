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
    lib.get(RENDER_URL, () => {}).on('error', () => {});
  }, 2 * 60 * 1000); // every 2 min
}

let bot = null;
let isRunning = false;
let antiAfkInterval = null;
let loggedIn = false;
let connectTimeout = null;

function scheduleReconnect(ms, reason) {
  console.log(`[${new Date().toISOString()}] ⏳ Reconnecting in ${ms / 1000}s... (${reason})`);
  cleanup();
  setTimeout(createBot, ms);
}

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

function createBot() {
  if (isRunning) return;
  isRunning = true;
  loggedIn = false;
  console.log(`[${new Date().toISOString()}] 🔌 Connecting...`);

  connectTimeout = setTimeout(() => {
    console.log(`[${new Date().toISOString()}] ⚠️ Spawn timeout, forcing reconnect...`);
    try { bot && bot.end(); } catch(e) {}
    scheduleReconnect(2000, 'spawn-timeout');
  }, 20000);

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT_MC,
    username: USERNAME,
    version: '1.21.11',
    checkTimeoutInterval: 10000, // detect dead connections in 10s
    hideErrors: false,
  });

  let disconnected = false;
  function onDisconnect(label, reason, delay) {
    if (disconnected) return;
    disconnected = true;
    loggedIn = false;
    if (connectTimeout) { clearTimeout(connectTimeout); connectTimeout = null; }
    console.log(`[${new Date().toISOString()}] [${label}] ${reason}`);
    scheduleReconnect(delay, label);
  }

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const msg = message.toLowerCase();
    if (msg.includes('login') || msg.includes('password') || msg.includes('log in') || msg.includes('logged out')) {
      loggedIn = false;
      setTimeout(() => {
        if (bot && !bot.ended) {
          bot.chat(`/login ${PASSWORD}`);
          loggedIn = true;
        }
      }, 1000);
    }
  });

  bot.on('spawn', () => {
    if (connectTimeout) { clearTimeout(connectTimeout); connectTimeout = null; }
    console.log(`[${new Date().toISOString()}] ✅ Spawned!`);
    setTimeout(() => {
      if (bot && !bot.ended) {
        bot.chat(`/login ${PASSWORD}`);
        loggedIn = true;
      }
    }, 1500);

    if (antiAfkInterval) clearInterval(antiAfkInterval);
    antiAfkInterval = setInterval(doAntiAfk, 10000); // every 10s
  });

  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Respawning...`);
    setTimeout(() => bot && bot.respawn(), 500);
  });

  bot.on('kicked', (reason) => {
    const r = (reason || '').toLowerCase();
    const delay =
      r.includes('throttl')   ? 8000
      : r.includes('already') ? 6000
      : 2000;
    onDisconnect('kicked', reason, delay);
  });

  bot.on('end', (reason) => {
    onDisconnect('end', reason, 2000);
  });

  bot.on('error', (err) => {
    onDisconnect('error', err.message, 2000);
  });
}

function cleanup() {
  isRunning = false;
  loggedIn = false;
  if (antiAfkInterval) { clearInterval(antiAfkInterval); antiAfkInterval = null; }
  if (connectTimeout) { clearTimeout(connectTimeout); connectTimeout = null; }
}

createBot();

setInterval(() => {
  console.log(`[${new Date().toISOString()}] 💓 Connected: ${bot ? !bot.ended : false} | LoggedIn: ${loggedIn}`);
}, 60000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
