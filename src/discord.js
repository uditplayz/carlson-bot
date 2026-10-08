import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  escapeMarkdown,
} from 'discord.js';
import { config } from './config.js';

const commands = [
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message to Twitch chat')
    .addStringOption((o) => o.setName('message').setDescription('What to send').setRequired(true).setMaxLength(450)),
  new SlashCommandBuilder()
    .setName('relay')
    .setDescription('Turn automatic Discord → Twitch forwarding on or off')
    .addStringOption((o) =>
      o
        .setName('mode')
        .setDescription('on or off')
        .setRequired(true)
        .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }),
    ),
  new SlashCommandBuilder().setName('status').setDescription('Show the Twitch ↔ Discord bridge status'),
].map((c) => c.toJSON());

export function canSendToTwitch(member) {
  if (!member) return false;
  const { allowedRoleIds, allowedUserIds } = config.discord;
  if (allowedUserIds.includes(member.id)) return true;
  if (allowedRoleIds.some((id) => member.roles.cache.has(id))) return true;
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export function formatForTwitch(displayName, text) {
  return config.relay.discordToTwitchFormat.replaceAll('{user}', displayName).replaceAll('{message}', text);
}

export function formatForDiscord({ text, user, isAction }) {
  const badges = [
    user.isBroadcaster && '🎙️',
    user.isMod && '🛡️',
    user.isVip && '💎',
    user.isSubscriber && '⭐',
  ]
    .filter(Boolean)
    .join('');
  const name = `**${escapeMarkdown(user.displayName)}**`;
  const body = escapeMarkdown(text);
  return `${badges ? `${badges} ` : ''}${isAction ? `${name} *${body}*` : `${name}: ${body}`}`;
}

export async function createDiscord({ twitch, queue, relayState }) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  client.once(Events.ClientReady, async (c) => {
    console.log(`[discord] Logged in as ${c.user.tag}`);
    try {
      const guild = await c.guilds.fetch(config.discord.guildId);
      await guild.commands.set(commands);
      const channel = await c.channels.fetch(config.discord.channelId);
      if (!channel?.isTextBased()) throw new Error('DISCORD_CHANNEL_ID is not a text channel');
      queue.setChannel(channel);
      console.log(`[discord] Mirroring Twitch chat into #${channel.name}`);
    } catch (err) {
      console.error('[discord] Setup failed:', err.message);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.guildId !== config.discord.guildId) return;

    if (interaction.commandName === 'status') {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: [
          `Twitch chat: ${twitch.state.connected ? '🟢 connected' : '🔴 disconnected'} (#${config.twitch.channel})`,
          `Auto relay: ${relayState.autoRelay ? 'on' : 'off'}`,
          `Uptime: ${Math.floor(process.uptime() / 60)} min`,
        ].join('\n'),
      });
      return;
    }

    if (!canSendToTwitch(interaction.member)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "You're not allowed to send messages to Twitch." });
      return;
    }

    if (interaction.commandName === 'relay') {
      relayState.autoRelay = interaction.options.getString('mode', true) === 'on';
      await interaction.reply(
        relayState.autoRelay
          ? `Auto relay **on** — messages from allowed users in <#${config.discord.channelId}> go to Twitch. Start a message with \`${config.relay.ignorePrefix}\` to keep it in Discord.`
          : 'Auto relay **off** — use `/say` to send to Twitch.',
      );
      return;
    }

    if (interaction.commandName === 'say') {
      const text = interaction.options.getString('message', true);
      try {
        const sent = await twitch.say(formatForTwitch(interaction.member.displayName, text));
        await interaction.reply({ content: `➡️ Sent to Twitch: ${escapeMarkdown(sent)}`, allowedMentions: { parse: [] } });
      } catch (err) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: `❌ Couldn't send to Twitch: ${err.message}` });
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    if (!relayState.autoRelay) return;
    if (message.author.bot || message.channelId !== config.discord.channelId) return;
    const text = message.cleanContent.trim();
    if (!text || text.startsWith(config.relay.ignorePrefix)) return;
    if (!canSendToTwitch(message.member)) return;

    try {
      await twitch.say(formatForTwitch(message.member.displayName, text));
      await message.react('✅');
    } catch (err) {
      console.warn('[relay] Failed to send to Twitch:', err.message);
      await message.react('❌').catch(() => {});
    }
  });

  try {
    await client.login(config.discord.token);
  } catch (err) {
    console.error('[discord] Login failed:', err.message);
    console.error('[discord] Check DISCORD_TOKEN and that "Message Content Intent" is enabled for the bot.');
    process.exit(1);
  }
  return client;
}
