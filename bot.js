const mineflayer = require('mineflayer');

const HOST = '606smp.aternos.me';
const USERNAME = 'Bot';
const PASSWORD = '@.Bot_2012.@';

console.log('🚀 Aternos Keeper Bot (Stealth Mode)...');

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
    checkTimeoutInterval: 600000,
  });

  bot.on('chat', (username, message) => {
    if (username === bot.username) return;
    const msg = message.toLowerCase();

    if (msg.includes('login') || msg.includes('password') || msg.includes('log in') || msg.includes('logged out')) {
      console.log(`[${new Date().toISOString()}] 🔑 Sending login...`);
      setTimeout(() => bot.chat(`/login ${PASSWORD}`), 3000);
    }
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Bot spawned! Stealth anti-AFK active.`);

    setTimeout(() => {
      if (bot && !bot.ended) bot.chat(`/login ${PASSWORD}`);
    }, 4000);

    // === VERY STEALTHY ANTI-AFK ===
    setInterval(() => {
      if (!bot || bot.ended || !bot.entity) return;

      const rand = Math.random();

      if (rand < 0.35) {
        // Rare jump
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 280);
        console.log(`[${new Date().toISOString()}] 🦘 Soft jump`);
      } 
      else if (rand < 0.65) {
        // Natural head movement
        bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.3);
      } 
      else {
        // Very short walk
        bot.setControlState('forward', true);
        setTimeout(() => bot.setControlState('forward', false), 350);
      }
    }, 35000); // Every 35 seconds - much less suspicious
  });

  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Died, respawning...`);
    setTimeout(() => bot.respawn(), 4000);
  });

  bot.on('end', (reason) => {
    console.log(`[${new Date().toISOString()}] Disconnected: ${reason}`);
    isRunning = false;
    
    const delay = reason.toLowerCase().includes('username') || reason.toLowerCase().includes('already playing') 
      ? 35000 
      : 12000;
    
    setTimeout(createBot, delay);
  });

  bot.on('kicked', (reason) => {
    console.log(`[${new Date().toISOString()}] Kicked by server: ${reason}`);
    isRunning = false;
    setTimeout(createBot, 25000); // Wait longer after kick
  });

  bot.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
    isRunning = false;
    setTimeout(createBot, 15000);
  });
}

createBot();

// Keep Render alive
setInterval(() => {
  console.log(`[${new Date().toISOString()}] ✅ Bot still running...`);
}, 60000);

process.on('SIGINT', () => process.exit(0));
