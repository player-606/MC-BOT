import mineflayer from 'mineflayer';
import http from 'http';

const HOST = '606smp.aternos.me';
const USERNAME = 'KeepAliveBot';

// Keep Render alive
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running');
}).listen(process.env.PORT || 3000);

let bot = null;

function createBot() {
  bot = mineflayer.createBot({
    host: HOST,
    username: USERNAME,
    version: '1.21',
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

async function startCycle() {
  while (true) {
    console.log(`[${new Date().toLocaleTimeString()}] Starting new cycle...`);

    createBot();

    await new Promise(resolve => setTimeout(resolve, 30000));

    if (bot) {
      bot.quit();
      bot = null;
      console.log(`[${new Date().toLocaleTimeString()}] Bot left the server`);
    }

    await new Promise(resolve => setTimeout(resolve, 30000));
  }
}

startCycle();
