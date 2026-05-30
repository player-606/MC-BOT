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

  // === IMPROVED AUTO LOGIN ===
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;

    const msg = message.toLowerCase().trim();

    if (msg.includes('login') || msg.includes('/l') || msg.includes('password') || 
        msg.includes('log in') || msg.includes('logged out') || msg.includes('authenticate')) {
      
      console.log(`[${new Date().toISOString()}] 🔑 Login prompt detected → Sending /login`);
      setTimeout(() => {
        bot.chat(`/login ${PASSWORD}`);
      }, 1800);
    }

    // Captcha fallback
    if (msg.includes('captcha')) {
      const codeMatch = message.match(/([A-Za-z0-9]{4,8})/);
      if (codeMatch) {
        console.log(`[${new Date().toISOString()}] 🔢 Captcha: ${codeMatch[1]}`);
        setTimeout(() => bot.chat(`/captcha ${codeMatch[1]}`), 1200);
      }
    }
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Bot spawned! Login + Anti-AFK active`);

    // Try login again after spawn (in case it missed the prompt)
    setTimeout(() => {
      if (bot && !bot.ended) bot.chat(`/login ${PASSWORD}`);
    }, 3000);

    // === Jump every 30 seconds ===
    const jumpInterval = setInterval(() => {
      if (bot && bot.entity && !bot.ended) {
        console.log(`[${new Date().toISOString()}] 🦘 Jumping...`);
        bot.setControlState('jump', true);
        setTimeout(() => {
          if (bot && bot.entity) bot.setControlState('jump', false);
        }, 400);
      }
    }, 30000);

    // Extra movement every 2 minutes to be safe
    setInterval(() => {
      if (bot && bot.entity) {
        bot.look(Math.random() * Math.PI * 2, 0);
      }
    }, 120000);
  });

  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] Bot died, respawning...`);
    setTimeout(() => bot.respawn(), 2000);
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
  });
}

// Start the bot
createBot();

process.on('SIGINT', () => process.exit(0));
