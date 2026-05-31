const mineflayer = require('mineflayer');
const http = require('http');
const https = require('https');

const HOST = '606smp.aternos.me';
const PORT_MC = 47593;
const USERNAME = 'Bot';
const PASSWORD = '@.Bot_2012.@';
const HTTP_PORT = process.env.PORT || 3000;

console.log('🚀 Bot starting...');

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end(`alive:${bot ? !bot.ended : false}\n`);
});
server.listen(HTTP_PORT, () => console.log(`[HTTP] Port ${HTTP_PORT}`));

const RENDER_URL = process.env.RENDER_EXTERNAL_URL || '';
if (RENDER_URL) {
  setInterval(() => {
    const lib = RENDER_URL.startsWith('https') ? https : http;
    lib.get(RENDER_URL, () => {}).on('error', () => {});
  }, 2 * 60 * 1000);
}

let bot = null;
let reconnectTimer = null;
let antiAfkInterval = null;
let loggedIn = false;
let connecting = false;

function scheduleReconnect(ms) {
  if (reconnectTimer) return; // already scheduled
  connecting = false;
  loggedIn = false;
  if (antiAfkInterval) { clearInterval(antiAfkInterval); antiAfkInterval = null; }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, ms);
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
      checkTimeoutInterval: 10000,
      hideErrors: false,
    });
  } catch(e) {
    console.log(`[${new Date().toISOString()}] ❌ Failed to create bot: ${e.message}`);
    connecting = false;
    scheduleReconnect(3000);
    return;
  }

  // If no spawn in 20s, force reconnect
  const spawnTimeout = setTimeout(() => {
    console.log(`[${new Date().toISOString()}] ⚠️ No spawn, reconnecting...`);
    try { bot.end(); } catch(e) {}
  }, 20000);

  bot.on('spawn', () => {
    clearTimeout(spawnTimeout);
    connecting = false;
    console.log(`[${new Date().toISOString()}] ✅ Spawned!`);
    setTimeout(() => {
      if (bot && !bot.ended) {
        bot.chat(`/login ${PASSWORD}`);
        loggedIn = true;
      }
    }, 1500);
    if (antiAfkInterval) clearInterval(antiAfkInterval);
    antiAfkInterval = setInterval(doAntiAfk, 10000);
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const msg = message.toLowerCase();
    if (msg.includes('login') || msg.includes('password') || msg.includes('logged out')) {
      loggedIn = false;
      setTimeout(() => {
        if (bot && !bot.ended) {
          bot.chat(`/login ${PASSWORD}`);
          loggedIn = true;
        }
      }, 1000);
    }
  });

  bot.on('death', () => {
    setTimeout(() => bot && bot.respawn(), 500);
  });

  bot.on('kicked', (reason) => {
    clearTimeout(spawnTimeout);
    const r = (reason || '').toLowerCase();
    const delay = r.includes('throttl') ? 8000 : r.includes('already') ? 5000 : 2000;
    console.log(`[${new Date().toISOString()}] 👢 Kicked: ${reason}`);
    scheduleReconnect(delay);
  });

  bot.on('end', (reason) => {
    clearTimeout(spawnTimeout);
    console.log(`[${new Date().toISOString()}] 🔴 End: ${reason}`);
    scheduleReconnect(2000);
  });

  bot.on('error', (err) => {
    clearTimeout(spawnTimeout);
    console.log(`[${new Date().toISOString()}] ❌ Error: ${err.message}`);
    scheduleReconnect(2000);
  });
}

createBot();

setInterval(() => {
  console.log(`[${new Date().toISOString()}] 💓 Connected:${bot ? !bot.ended : false} LoggedIn:${loggedIn}`);
}, 60000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
