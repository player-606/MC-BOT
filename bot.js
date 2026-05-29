const mineflayer = require('mineflayer');

const HOST = '606smp.aternos.me';
const USERNAME = 'Bot';

console.log('Aternos Cycler Bot Starting...');

function createBot() {
  console.log(`[${new Date().toISOString()}] Connecting as ${USERNAME} to ${HOST}...`);

  const bot = mineflayer.createBot({
    host: HOST,
    username: USERNAME,
    version: false,
    checkTimeoutInterval: 60000,
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] ✅ Bot spawned! Staying for 30 seconds...`);
    
    setTimeout(() => {
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

// Start the cycle
createBot();

// Keep process alive
process.on('SIGINT', () => process.exit(0));
