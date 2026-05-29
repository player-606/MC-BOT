const mineflayer = require('mineflayer');

const HOST = '606smp.aternos.me';
const USERNAME = 'Bot';

console.log('Aternos Cycler Bot Starting...');

function createBot() {
  console.log(`[${new Date().toISOString()}] Connecting as ${USERNAME} to ${HOST}...`);

  const bot = mineflayer.createBot({
    host: HOST,
    // NO PORT - Aternos uses SRV record
    username: USERNAME,
    version: false,
    checkTimeoutInterval: 120000,
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Bot joined! Staying 30s...`);

    const afkInterval = setInterval(() => {
      if (bot.entity) bot.setControlState('jump', true);
      setTimeout(() => { if (bot.entity) bot.setControlState('jump', false); }, 300);
    }, 7000);

    setTimeout(() => {
      clearInterval(afkInterval);
      if (!bot.ended) {
        console.log(`[${new Date().toISOString()}] Leaving server...`);
        bot.quit();
      }
    }, 30000);
  });

  bot.on('end', (reason) => {
    console.log(`[${new Date().toISOString()}] Disconnected: ${reason}`);
    setTimeout(createBot, 30000);
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
