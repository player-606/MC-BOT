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
    checkTimeoutInterval: 300000,
  });

  // Auto login & captcha handler
  bot.on('chat', (username, message) => {
    if (username === bot.username) return;

    const msg = message.toLowerCase();

    // Auto login
    if (msg.includes('/login') || msg.includes('please login') || msg.includes('log in')) {
      console.log(`[${new Date().toISOString()}] Sending login...`);
      setTimeout(() => bot.chat(`/login ${PASSWORD}`), 800);
    }

    // Auto captcha
    if (msg.includes('/captcha') || msg.includes('captcha code') || /[A-Za-z0-9]{4,8}/.test(message)) {
      const codeMatch = message.match(/([A-Za-z0-9]{4,8})/);
      if (codeMatch) {
        const code = codeMatch[1];
        console.log(`[${new Date().toISOString()}] Captcha detected: ${code}`);
        setTimeout(() => bot.chat(`/captcha ${code}`), 600);
      }
    }
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Bot spawned and logged in! Staying forever...`);

    // Very strong anti-AFK (keeps server alive)
    const afkInterval = setInterval(() => {
      if (bot.entity) {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 350);

        // Random look around
        bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.6);
      }
    }, 5500);

    // Optional: send a message every few minutes to keep activity
    setInterval(() => {
      if (bot.entity) bot.chat('👀');
    }, 180000); // every 3 minutes
  });

  bot.on('end', (reason) => {
    console.log(`[${new Date().toISOString()}] Disconnected: ${reason}. Reconnecting in 8s...`);
    setTimeout(createBot, 8000);
  });

  bot.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
  });

  bot.on('kicked', (reason) => {
    console.log(`[${new Date().toISOString()}] Kicked:`, reason);
  });
}

createBot();

process.on('SIGINT', () => process.exit(0));
