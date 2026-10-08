import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { config } from './config.js';
import { loadToken, saveToken } from './tokenStore.js';

const TWITCH_MAX_LENGTH = 500;

export async function createTwitch({ onChatMessage }) {
  const authProvider = new RefreshingAuthProvider({
    clientId: config.twitch.clientId,
    clientSecret: config.twitch.clientSecret,
  });
  authProvider.onRefresh((_userId, token) => saveToken(token));
  authProvider.onRefreshFailure((_userId, err) => {
    console.error('[twitch] Token refresh failed. Re-run `npm run twitch-auth` and update TWITCH_REFRESH_TOKEN.', err.message);
  });

  let userId;
  try {
    userId = await authProvider.addUserForToken(await loadToken(), ['chat']);
  } catch (err) {
    console.error('[twitch] Could not log in to Twitch:', err.cause?.message ?? err.message);
    console.error('[twitch] Check TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET, or re-run `npm run twitch-auth` for a fresh TWITCH_REFRESH_TOKEN.');
    process.exit(1);
  }
  console.log(`[twitch] Authenticated as user id ${userId}`);

  const chat = new ChatClient({ authProvider, channels: [config.twitch.channel] });
  const state = { connected: false };

  chat.onConnect(() => {
    state.connected = true;
    console.log(`[twitch] Connected, joining #${config.twitch.channel}`);
  });
  chat.onDisconnect((manually, reason) => {
    state.connected = false;
    console.warn(`[twitch] Disconnected${manually ? ' (manual)' : ''}${reason ? `: ${reason.message}` : ''}`);
  });
  chat.onAuthenticationFailure((text) => console.error('[twitch] Authentication failure:', text));
  chat.onMessageFailed((_channel, reason) => console.warn('[twitch] Message rejected by Twitch:', reason));

  chat.onMessage((_channel, _user, text, msg) => onChatMessage({ text, user: msg.userInfo, isAction: false }));
  chat.onAction((_channel, _user, text, msg) => onChatMessage({ text, user: msg.userInfo, isAction: true }));

  chat.connect();

  return {
    state,
    async say(text) {
      const clean = text.replace(/\s+/g, ' ').trim();
      if (!clean) throw new Error('Message is empty');
      const message = clean.length > TWITCH_MAX_LENGTH ? `${clean.slice(0, TWITCH_MAX_LENGTH - 1)}…` : clean;
      await chat.say(config.twitch.channel, message);
      return message;
    },
    quit() {
      chat.quit();
    },
  };
}
