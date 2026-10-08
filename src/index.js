import http from 'node:http';
import { config } from './config.js';
import { DiscordQueue } from './discordQueue.js';
import { createTwitch } from './twitch.js';
import { createDiscord, formatForDiscord } from './discord.js';

const queue = new DiscordQueue();
const relayState = { autoRelay: config.relay.autoRelay };

const twitch = await createTwitch({
  onChatMessage: (msg) => queue.push(formatForDiscord(msg)),
});
const discord = await createDiscord({ twitch, queue, relayState });

// Tiny HTTP endpoint so free hosts (Render, Koyeb, ...) see a running web
// service and an uptime pinger can keep it awake.
const server = http
  .createServer((_req, res) => {
    // Always 200 while the process is alive: both clients reconnect on their
    // own, and a failing check would make some hosts restart us in a loop.
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ twitch: twitch.state.connected, discord: discord.isReady(), uptime: process.uptime() }));
  })
  .listen(config.port, () => console.log(`[http] Health check on port ${config.port}`));

async function shutdown(signal) {
  console.log(`[bot] ${signal} received, shutting down`);
  await queue.flush();
  queue.stop();
  twitch.quit();
  await discord.destroy();
  server.close();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => console.error('[bot] Unhandled rejection:', err));
