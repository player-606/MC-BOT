const mineflayer = require('mineflayer');
const http = require('http');
const https = require('https');

const HOST = '606smp.aternos.me';
const PORT_MC = 47593;
const USERNAME = 'Bot';
const PASSWORD = '@.Bot_2012.@';
const HTTP_PORT = process.env.PORT || 3000;

console.log('🚀 Bot starting...');

// HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end(`alive:${bot ? !bot.ended : false}\n`);
});
server.listen(HTTP_PORT, () => console.log(`[HTTP] Port ${HTTP_PORT}`));

// Self-ping
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || '';
if (RENDER_URL) {
  setInterval(() => {
    const lib = RENDER_URL.startsWith('https') ? https : http;
    lib.get(RENDER_URL, () => {}).on('error', () => {});
  }, 2 * 60 * 1000);
}

// State
let bot = null;
let reconnectTimer = null;
let antiAfkInterval = null;
let keepaliveInterval = null;
let positionInterval = null;
let loggedIn = false;
let connecting = false;

// Fast reconnect
function scheduleReconnect(ms = 600) {
  if (reconnectTimer) return;
  connecting = false;
  loggedIn = false;
  if (antiAfkInterval) { clearInterval(antiAfkInterval); antiAfkInterval = null; }
  if (keepaliveInterval) { clearInterval(keepaliveInterval); keepaliveInterval = null; }
  if (positionInterval) { clearInterval(positionInterval); positionInterval = null; }

  console.log(`[${new Date().toISOString()}] ⏳ Reconnecting in ${ms}ms...`);
  reconnectTimer = setTimeout(() => { 
    reconnectTimer = null; 
    createBot(); 
  }, ms);
}

// Anti-AFK (your original style)
function doAntiAfk() {
  if (!bot || bot.ended || !bot.entity || !loggedIn) return;
  const rand = Math.random();
  if (rand < 0.25) {
    bot.setControlState('forward', true);
    setTimeout(() => { if (bot && !bot.ended) bot.setControlState('forward', false); }, 500);
  } else if (rand < 0.5) {
    bot.setControlState('jump', true);
    setTimeout(() => { if (bot && !bot.ended) bot.setControlState('jump', false); }, 300);
  } else if (rand < 0.75) {
    bot.look(Math.random() * Math.PI * 2, 0);
  } else {
    bot.setControlState('sneak', true);
    setTimeout(() => { if (bot && !bot.ended) bot.setControlState('sneak', false); }, 700);
  }
}

function createBot() {
  if (connecting) return;
  connecting = true;
  loggedIn = false;
  console.log(`[${new Date().toISOString()}] 🔌 Connecting...`);

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT_MC,
    username: USERNAME,
    version: '1.21.11',
    checkTimeoutInterval: 300000,
    hideErrors: false,
  });

  const spawnTimeout = setTimeout(() => {
    console.log(`[${new Date().toISOString()}] ⚠️ No spawn, reconnecting...`);
    try { bot.end(); } catch (e) {}
  }, 22000);

  // Manual keepalive
  bot._client?.on('keep_alive', (packet) => {
    try {
      bot._client.write('keep_alive', { keepAliveId: packet.keepAliveId });
    } catch (e) {}
  });

  bot.on('spawn', () => {
    clearTimeout(spawnTimeout);
    connecting = false;
    console.log(`[${new Date().toISOString()}] ✅ Spawned!`);

    setTimeout(() => {
      if (bot && !bot.ended) {
        bot.chat(`/login ${PASSWORD}`);
        loggedIn = true;
        console.log(`[${new Date().toISOString()}] 🔑 Login sent`);
      }
    }, 1000);

    // Position every 800ms
    positionInterval = setInterval(() => {
      if (!bot || bot.ended || !bot.entity) return;
      try {
        bot._client.write('position', {
          x: bot.entity.position.x,
          y: bot.entity.position.y,
          z: bot.entity.position.z,
          onGround: true,
        });
      } catch (e) {}
    }, 800);

    // Swing arm
    keepaliveInterval = setInterval(() => {
      if (!bot || bot.ended || !loggedIn) return;
      try { bot.swingArm(); } catch (e) {}
    }, 2500);

    antiAfkInterval = setInterval(doAntiAfk, 9000);
  });

  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Respawning...`);
    setTimeout(() => { if (bot && !bot.ended) bot.respawn(); }, 100);
  });

  bot.on('kicked', (reason) => {
    console.log(`[${new Date().toISOString()}] 👢 Kicked: ${reason}`);
    scheduleReconnect(800);
  });

  bot.on('end', (reason) => {
    console.log(`[${new Date().toISOString()}] 🔴 End: ${reason}`);
    scheduleReconnect(600);
  });

  bot.on('error', (err) => {
    console.log(`[${new Date().toISOString()}] ❌ Error: ${err.message}`);
    scheduleReconnect(800);
  });
}

createBot();

setInterval(() => {
  console.log(`[${new Date().toISOString()}] 💓 Status - Connected: ${bot && !bot.ended}`);
}, 60000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
