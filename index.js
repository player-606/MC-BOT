const mineflayer = require('mineflayer');
const http = require('http');
const https = require('https');

const HOST = '606smp.aternos.me';
const PORT_MC = 47593;
const USERNAME = 'Bot';
const PASSWORD = '@.Bot_2012.@';
const HTTP_PORT = process.env.PORT || 3000;

console.log('🚀 Aternos Keeper Bot starting...');

// HTTP Server for Render.com
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end(`alive:${bot ? !bot.ended : false}\n`);
});
server.listen(HTTP_PORT, () => console.log(`[HTTP] Port ${HTTP_PORT}`));

// Keep Render awake
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || '';
if (RENDER_URL) {
  setInterval(() => {
    const lib = RENDER_URL.startsWith('https') ? https : http;
    lib.get(RENDER_URL).on('error', () => {});
  }, 120000);
}

// State
let bot = null;
let reconnectTimer = null;
let intervals = [];

function clearAllIntervals() {
  intervals.forEach(clearInterval);
  intervals = [];
}

function scheduleReconnect(ms = 400) {
  if (reconnectTimer) return;
  clearAllIntervals();
  console.log(`[${new Date().toISOString()}] ⏳ Reconnecting in ${ms}ms...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createBot();
  }, ms);
}

function createBot() {
  console.log(`[${new Date().toISOString()}] 🔌 Connecting to server...`);

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT_MC,
    username: USERNAME,
    version: '1.21.11',
    checkTimeoutInterval: 300000,
    hideErrors: false,
  });

  // Force reconnect if no spawn
  const spawnTimeout = setTimeout(() => {
    console.log(`[${new Date().toISOString()}] ⚠️ No spawn, forcing reconnect`);
    try { bot.end(); } catch {}
  }, 18000);

  // Manual keepalive
  bot._client?.on('keep_alive', (packet) => {
    try {
      bot._client.write('keep_alive', { keepAliveId: packet.keepAliveId });
    } catch {}
  });

  bot.on('spawn', () => {
    clearTimeout(spawnTimeout);
    console.log(`[${new Date().toISOString()}] ✅ Spawned! Keeping server alive.`);

    // Quick login
    setTimeout(() => {
      if (bot && !bot.ended) {
        bot.chat(`/login ${PASSWORD}`);
      }
    }, 700);

    // Aggressive position + activity packets (best for Aternos)
    intervals.push(setInterval(() => {
      if (!bot?.entity || bot.ended) return;
      try {
        bot._client.write('position', {
          x: bot.entity.position.x,
          y: bot.entity.position.y,
          z: bot.entity.position.z,
          onGround: true
        });
      } catch {}
    }, 650));

    // Swing arm regularly
    intervals.push(setInterval(() => {
      if (bot && !bot.ended) bot.swingArm();
    }, 1900));

    // Light movement + look around
    intervals.push(setInterval(() => {
      if (!bot || bot.ended) return;
      const r = Math.random();
      if (r < 0.5) {
        bot.look(Math.random() * Math.PI * 2, 0);
      } else if (r < 0.7) {
        bot.setControlState('forward', true);
        setTimeout(() => bot.setControlState('forward', false), 350);
      }
    }, 7500));

    // Occasional chat (helps server think player is active)
    intervals.push(setInterval(() => {
      if (bot && !bot.ended) {
        bot.chat([".", "z", "gg", "o/"][Math.floor(Math.random()*4)]);
      }
    }, 210000)); // every \~3.5 minutes
  });

  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Respawning instantly`);
    setTimeout(() => bot?.respawn(), 80);
  });

  bot.on('kicked', (reason) => {
    console.log(`[${new Date().toISOString()}] 👢 Kicked: ${reason}`);
    scheduleReconnect(600);
  });

  bot.on('end', (reason) => {
    console.log(`[${new Date().toISOString()}] 🔴 Disconnected: ${reason}`);
    scheduleReconnect(400);
  });

  bot.on('error', (err) => {
    console.log(`[${new Date().toISOString()}] ❌ Error: ${err.message}`);
    scheduleReconnect(600);
  });
}

createBot();

// Status report
setInterval(() => {
  console.log(`[${new Date().toISOString()}] 💓 Bot Status: ${bot && !bot.ended ? 'Connected' : 'Disconnected'}`);
}, 45000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
