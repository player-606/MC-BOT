import mineflayer from 'mineflayer';

const HOST = '606smp.aternos.me';
const PORT = 25565;
const USERNAME = 'KeepAliveBot';   // You can change this

let bot = null;

function createBot() {
  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: '1.21',           // Change if your server is different
    checkTimeoutInterval: 30000
  });

  bot.on('login', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Bot joined the server`);
  });

  bot.on('kicked', (reason) => {
    console.log(`[${new Date().toLocaleTimeString()}] Kicked:`, reason);
  });

  bot.on('error', (err) => {
    console.log(`[${new Date().toLocaleTimeString()}] Error:`, err.message);
  });

  bot.on('end', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Bot disconnected`);
  });
}

// Main cycle: Join 30s → Leave 30s
async function startCycle() {
  while (true) {
    console.log(`[${new Date().toLocaleTimeString()}] Starting new cycle...`);

    // Join
    createBot();

    // Stay for 30 seconds
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Quit if bot still exists
    if (bot) {
      bot.quit();
      bot = null;
      console.log(`[${new Date().toLocaleTimeString()}] Bot left the server`);
    }

    // Wait 30 seconds before rejoining
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
}

startCycle();
