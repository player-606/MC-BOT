const mineflayer = require('mineflayer');

const HOST = '606smp.aternos.me';
const USERNAME = 'Bot';
let PORT = 47593;   // Default, change only if needed

console.log('Aternos Cycler Bot Starting...');

function createBot() {
  console.log(`[${new Date().toISOString()}] Connecting as ${USERNAME} to \( {HOST}: \){PORT}...`);

  const bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: false,
    checkTimeoutInterval: 60000,
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Bot spawned! Staying for 30 seconds...`);

    // Simple anti-AFK movement
    const moveInterval = setInterval(() => {
      if (bot.entity) {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 500);
      }
    }, 8000);

    setTimeout(() => {
      clearInterval(moveInterval);
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

// Start
createBot();

// Keep alive
process.on('SIGINT', () => process.exit(0));
