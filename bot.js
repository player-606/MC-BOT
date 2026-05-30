const mineflayer = require('mineflayer');

const HOST = '606smp.aternos.me';
const USERNAME = 'Bot';
const PASSWORD = '@.Bot_2012.@';

console.log('Aternos Keeper Bot Starting...');

function createBot() {
  console.log(`[${new Date().toISOString()}] Connecting as ${USERNAME}...`);

  const bot = mineflayer.createBot({
    host: HOST,
    username: USERNAME,
    version: false,
    checkTimeoutInterval: 300000, // 5 minutes
  });

  // Auto Login
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;

    const msg = message.toLowerCase();

    if (msg.includes('login') || msg.includes('/l') || msg.includes('password') || msg.includes('log in')) {
      console.log(`[${new Date().toISOString()}] 🔑 Sending login...`);
      setTimeout(() => bot.chat(`/login ${PASSWORD}`), 1200);
    }

    // Light captcha support
    if (msg.includes('captcha')) {
      const codeMatch = message.match(/([A-Za-z0-9]{4,8})/);
      if (codeMatch) {
        console.log(`[${new Date().toISOString()}] 🔢 Captcha: ${codeMatch[1]}`);
        setTimeout(() => bot.chat(`/captcha ${codeMatch[1]}`), 800);
      }
    }
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Bot spawned! Staying forever with anti-kick...`);

    // === STRONG ANTI-AFK / ANTI-KICK ===
    let afkInterval = setInterval(() => {
      if (!bot.entity) return;

      // Jump
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 350);

      // Random look around
      bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.8);

      // Occasional small movement
      if (Math.random() > 0.7) {
        bot.setControlState('forward', true);
        setTimeout(() => bot.setControlState('forward', false), 600);
      }

      // Sprint sometimes
      if (Math.random() > 0.85) {
        bot.setControlState('sprint', true);
        setTimeout(() => bot.setControlState('sprint', false), 800);
      }
    }, 5200);

    // Chat activity every 4-5 minutes
    setInterval(() => {
      if (bot.entity) bot.chat('👍');
    }, 270000);
  });

  // Auto Respawn if died
  bot.on('death', () => {
    console.log(`[${new Date().toISOString()}] 💀 Bot died, respawning...`);
    setTimeout(() => {
      if (bot && !bot.ended) bot.respawn();
    }, 1500);
  });

  bot.on('end', (reason) => {
    console.log(`[\( {new Date().toISOString()}] Disconnected ( \){reason}). Reconnecting in 6s...`);
    setTimeout(createBot, 6000);
  });

  bot.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
  });

  bot.on('kicked', (reason) => {
    console.log(`[${new Date().toISOString()}] Kicked:`, reason);
    setTimeout(createBot, 8000);
  });
}

createBot();

process.on('SIGINT', () => process.exit(0));
