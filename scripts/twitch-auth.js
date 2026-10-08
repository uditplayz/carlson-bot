// One-time helper: run on your own computer to get a Twitch refresh token.
//   npm run twitch-auth
// Needs TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env, and
// http://localhost:3000 registered as an OAuth Redirect URL on your Twitch app.
import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import { exchangeCode } from '@twurple/auth';

const clientId = process.env.TWITCH_CLIENT_ID?.trim();
const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();
if (!clientId || !clientSecret) {
  console.error('Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env first.');
  process.exit(1);
}

const port = 3000;
const redirectUri = `http://localhost:${port}`;
const state = crypto.randomBytes(16).toString('hex');
const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: 'chat:read chat:edit',
  state,
  force_verify: 'true',
}).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);
  if (url.pathname !== '/') return res.writeHead(404).end();
  const code = url.searchParams.get('code');
  if (url.searchParams.get('state') !== state || !code) {
    res.writeHead(400).end(`Authorization failed: ${url.searchParams.get('error_description') ?? 'bad state'}`);
    return;
  }
  try {
    const token = await exchangeCode(clientId, clientSecret, code, redirectUri);
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Done! Go back to your terminal. You can close this tab.');
    console.log('\nSuccess! Put this in your .env / hosting environment variables:\n');
    console.log(`TWITCH_REFRESH_TOKEN=${token.refreshToken}\n`);
  } catch (err) {
    res.writeHead(500).end(`Token exchange failed: ${err.message}`);
    console.error(err);
  } finally {
    server.close();
  }
});

server.listen(port, () => {
  console.log('Log in with the Twitch account the bot should chat as, using this link:\n');
  console.log(authUrl.toString());
});
