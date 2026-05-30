const mineflayer = require('mineflayer');

const HOST = '606smp.aternos.me';
const USERNAME = 'Bot';
const PASSWORD = '@.Bot_2012.@';

console.log('Aternos Keeper Bot Starting...');

let bot = null;
let isRunning = false;

function createBot() {
  if (isRunning) return;
  isRunning = true;

  console.log(`[${new Date().toISOString()}] Connecting as ${USERNAME}...`);

  bot = mineflayer.createBot({
    host: HOST,
    username: USERNAME,
    version: false,
    checkTimeoutInterval: 300000,
  });

  // === AUTO LOGIN ===
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;

    const msg = message.toLowerCase();

    if (msg.includes('login') || msg.includes('/l') || msg.includes('password') || 
        msg.includes('log in') || msg.includes('logged out') || msg.includes('authenticate')) {
      console.log(`[${new Date().toISOString()}] 🔑 Sending login...`);
      setTimeout(() => bot.chat(`/login ${PASSWORD}`), 1500);
    }

    if (msg.includes('captcha')) {
      const codeMatch = message.match(/([A-Za-z0-9]{4,8})/);
      if (codeMatch) {
        console.log(`[${new Date().toISOString()}] 🔢 Captcha: ${codeMatch[1]}`);
        setTimeout(() => bot.chat(`/captcha ${codeMatch[1]}`), 1000);
      }
    }
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Bot spawned successfully!`);

    // Try login after spawn
    setTimeout(() => {
      if (bot && !bot.ended) bot.chat(`/login ${PASSWORD}`);
    }, 2500);

    // === ANTI-AFK: Jump every 30 seconds + extra movement ===
    setInterval(() => {
      if (!bot || bot.ended || !bot.entity) return;
      console.log(`[${new Date().toISOString()}] 🦘 Jumping...`);
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 450);
      
      // Random look
      bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.6);
    }, 30000);

    // Extra safety movement every 90 seconds
    setInterval(() => {
      if (bot && bot.entity) {
        bot.setControlState('forward', true);
        setTimeout(() => bot.setControlState('forward', false), 800);
      }
    }, 90000);
  });

  // === IMPROVED DEATH HANDLING ===
  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Bot died (possibly in water). Respawning...`);
    setTimeout(() => {
      if (bot && !bot.ended) {
        bot.respawn();
      }
    }, 1800);
  });

  // Force respawn if health is low
  bot.on('health', () => {
    if (bot.health < 8 && bot.entity) {
      console.log(`[${new Date().toISOString()}] ❤️ Low health detected, jumping to survive...`);
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 600);
    }
  });

  bot.on('end', (reason) => {
    console.log(`[${new Date().toISOString()}] Disconnected: ${reason}. Reconnecting in 8 seconds...`);
    isRunning = false;
    setTimeout(createBot, 8000);
  });

  bot.on('kicked', (reason) => {
    console.log(`[${new Date().toISOString()}] Kicked: ${reason}`);
    isRunning = false;
    setTimeout(createBot, 12000);
  });

  bot.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    isRunning = false;
    setTimeout(createBot, 10000);
  });
}

// Start
createBot();

process.on('SIGINT', () => process.exit(0));
