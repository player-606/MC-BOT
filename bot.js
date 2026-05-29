const mineflayer = require('mineflayer');

const HOST = '606smp.aternos.me';
const USERNAME = 'Bot'; // Change this!

let bot;
let cycleInterval;

function createBot() {
  console.log(`[${new Date().toISOString()}] Creating bot...`);

  bot = mineflayer.createBot({
    host: HOST,
    // No port needed — Aternos uses SRV records
    username: USERNAME,
    version: false,        // auto-detect
    checkTimeoutInterval: 30000,
  });

  bot.on('spawn', () => {
    console.log(`[${new Date().toISOString()}] Bot spawned on ${HOST}`);
    // Stay for 30 seconds then quit
    setTimeout(() => {
      if (bot && !bot.ended) {
        console.log(`[${new Date().toISOString()}] Leaving server (30s stay)...`);
        bot.quit();
      }
    }, 30000);
  });

  bot.on('end', (reason) => {
    console.log(`[${new Date().toISOString()}] Bot disconnected: ${reason}`);
    
    // Wait 30 seconds before rejoining
    setTimeout(() => {
      if (!bot || bot.ended) {
        createBot();
      }
    }, 30000);
  });

  bot.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Error:`, err.message);
  });

  bot.on('kicked', (reason) => {
    console.log(`[${new Date().toISOString()}] Kicked:`, reason);
  });
}

// Start the cycle
console.log('Starting Aternos cycler bot...');
createBot();

// Keep the process alive
process.on('SIGINT', () => process.exit(0));
