const mineflayer = require('mineflayer');

const HOST = '606smp.aternos.me';
const USERNAME = 'Bot';
const PASSWORD = '@.Bot_2012.@';

console.log('🚀 Aternos Keeper Bot Starting... (Ultra Stable Mode)');

let bot = null;
let isRunning = false;

function createBot() {
  if (isRunning) return;
  isRunning = true;

  console.log(`[${new Date().toISOString()}] Connecting...`);

  bot = mineflayer.createBot({
    host: HOST,
    username: USERNAME,
    version: false,
    checkTimeoutInterval: 600000,     // 10 minutes
    connectTimeout: 60000,
    keepAlive: true,
  });

  // Auto Login
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const msg = message.toLowerCase();

    if (msg.includes('login') || msg.includes('password') || msg.includes('log in') || msg.includes('logged out')) {
      console.log(`[${new Date().toISOString()}] 🔑 Sending login`);
      setTimeout(() => bot.chat(`/login ${PASSWORD}`), 2000);
    }
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Bot spawned and running!`);

    setTimeout(() => {
      if (bot && !bot.ended) bot.chat(`/login ${PASSWORD}`);
    }, 3000);

    // Jump every 30 seconds
    setInterval(() => {
      if (!bot || bot.ended || !bot.entity) return;
      console.log(`[${new Date().toISOString()}] 🦘 Jumping...`);
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }, 30000);
  });

  // Keep alive packets
  setInterval(() => {
    if (bot && bot.entity) {
      bot.look(Math.random() * Math.PI * 2, 0);
    }
  }, 45000);

  // Death handling
  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Died - Respawning...`);
    setTimeout(() => bot.respawn(), 2500);
  });

  bot.on('end', (reason) => {
    console.log(`[${new Date().toISOString()}] Disconnected: ${reason}`);
    isRunning = false;
    setTimeout(createBot, 10000);
  });

  bot.on('kicked', (reason) => {
    console.log(`[${new Date().toISOString()}] Kicked: ${reason}`);
    isRunning = false;
    setTimeout(createBot, 15000);
  });

  bot.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    isRunning = false;
    setTimeout(createBot, 10000);
  });
}

// Start bot
createBot();

// Extra process keep-alive
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Bot is still alive...`);
}, 60000);

process.on('SIGINT', () => process.exit(0));
