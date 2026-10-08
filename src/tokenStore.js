import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const tokenFile = path.join(config.dataDir, 'twitch-token.json');

// Twitch hands out a new refresh token on every refresh. We save it to disk so
// restarts pick up the newest one, and fall back to the env var when the disk
// was wiped (e.g. free hosts with ephemeral storage). If you paste a new
// TWITCH_REFRESH_TOKEN, the saved file is ignored in favour of it.
export async function loadToken() {
  try {
    const saved = JSON.parse(await fs.readFile(tokenFile, 'utf8'));
    if (saved.refreshToken && saved.sourceRefreshToken === config.twitch.refreshToken) return saved;
  } catch {
    // no saved token yet
  }
  return { refreshToken: config.twitch.refreshToken, accessToken: undefined, expiresIn: 0, obtainmentTimestamp: 0 };
}

export async function saveToken(token) {
  try {
    await fs.mkdir(config.dataDir, { recursive: true });
    await fs.writeFile(tokenFile, JSON.stringify({ ...token, sourceRefreshToken: config.twitch.refreshToken }, null, 2));
  } catch (err) {
    console.warn('[twitch] Could not persist refreshed token:', err.message);
  }
}
