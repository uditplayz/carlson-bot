import 'dotenv/config';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[config] Missing required environment variable: ${name}`);
    console.error('[config] Copy .env.example to .env and fill it in (see README.md).');
    process.exit(1);
  }
  return value;
}

function optional(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

function list(name) {
  return optional(name)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function bool(name, fallback) {
  const value = optional(name).toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

export const config = {
  discord: {
    token: required('DISCORD_TOKEN'),
    guildId: required('DISCORD_GUILD_ID'),
    // Channel where Twitch chat is mirrored and (optionally) relayed back from.
    channelId: required('DISCORD_CHANNEL_ID'),
    // Who may send messages to Twitch. If both lists are empty, only members
    // with the "Manage Server" permission can.
    allowedRoleIds: list('DISCORD_ALLOWED_ROLE_IDS'),
    allowedUserIds: list('DISCORD_ALLOWED_USER_IDS'),
  },
  twitch: {
    clientId: required('TWITCH_CLIENT_ID'),
    clientSecret: required('TWITCH_CLIENT_SECRET'),
    refreshToken: required('TWITCH_REFRESH_TOKEN'),
    channel: required('TWITCH_CHANNEL').toLowerCase().replace(/^#/, ''),
  },
  relay: {
    // When on, every message typed in the Discord channel by an allowed user
    // is forwarded to Twitch. Can be toggled at runtime with /relay.
    autoRelay: bool('AUTO_RELAY', false),
    // Template for messages sent to Twitch. Placeholders: {user}, {message}
    discordToTwitchFormat: optional('DISCORD_TO_TWITCH_FORMAT', '[Discord] {user}: {message}'),
    // Messages starting with this prefix are never forwarded (talk among yourselves).
    ignorePrefix: optional('RELAY_IGNORE_PREFIX', '//'),
  },
  port: Number(optional('PORT', '3000')),
  dataDir: optional('DATA_DIR', './data'),
};
