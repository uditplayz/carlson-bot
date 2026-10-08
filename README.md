# carlson-bot

A Discord bot that links a Discord text channel to your Twitch chat:

Watch my stream in the background meanwhile you set this up for developer's luck ;) >> <a href="https://www.twitch.tv/uditplayz">UditPlayz (click me)</a>

- **Twitch → Discord:** every Twitch chat message shows up live in a Discord channel, with badges (🎙️ broadcaster, 🛡️ mod, 💎 VIP, ⭐ sub).
- **Discord → Twitch (optional):**
  - `/say <message>` sends a single message to Twitch chat.
  - `/relay on` forwards every message that allowed users type in the channel. Start a message with `//` to keep it in Discord only. `/relay off` turns forwarding off again.
  - `/status` shows whether the bot is connected.

In Twitch chat, messages from Discord look like `[Discord] Udit: hello`. You can change the format with `DISCORD_TO_TWITCH_FORMAT`.

By default only members with **Manage Server** can send messages to Twitch. To let other people send, set `DISCORD_ALLOWED_ROLE_IDS` and/or `DISCORD_ALLOWED_USER_IDS`.

---

## 1. Setup (about 15 minutes, once)

You need [Node.js 20 or newer](https://nodejs.org) on your computer.

```bash
git clone https://github.com/uditplayz/carlson-bot.git
cd carlson-bot
npm install
cp .env.example .env      # on Windows: copy .env.example .env
```

### 1a. Create the Discord bot

1. Go to <https://discord.com/developers/applications>, click **New Application** and give it a name.
2. Open the **Bot** tab:
   - Click **Reset Token** and copy the token into `DISCORD_TOKEN`.
   - Under **Privileged Gateway Intents**, turn on **Message Content Intent**. `/relay` needs it to read messages.
3. Open the **OAuth2 → URL Generator** tab:
   - Under Scopes, tick `bot` and `applications.commands`.
   - Under Bot Permissions, tick `View Channels`, `Send Messages`, `Read Message History` and `Add Reactions`.
   - Open the generated URL and add the bot to your server.
4. In Discord, go to **User Settings → Advanced** and turn on **Developer Mode**. Then:
   - Right-click your server, choose **Copy Server ID**, and put it in `DISCORD_GUILD_ID`.
   - Right-click the channel for the live chat feed (for example `#twitch-chat`), choose **Copy Channel ID**, and put it in `DISCORD_CHANNEL_ID`.

### 1b. Create the Twitch app

1. Go to <https://dev.twitch.tv/console/apps> and click **Register Your Application**:
   - Name: anything you like.
   - OAuth Redirect URLs: `http://localhost:3000`
   - Category: Chat Bot. Client Type: **Confidential**.
2. Copy the **Client ID** into `TWITCH_CLIENT_ID`. Click **New Secret** and copy it into `TWITCH_CLIENT_SECRET`.
3. Set `TWITCH_CHANNEL` to your channel name, for example `carlson`.
4. Run:
   ```bash
   npm run twitch-auth
   ```
   Open the link it prints and log in with the Twitch account the bot should chat as. That can be your own account or a separate bot account. The terminal then prints `TWITCH_REFRESH_TOKEN=...`; paste that line into `.env`.

   > If you use a separate bot account, make it a mod in your channel with `/mod botname`. Twitch then lets it send messages faster and skips slow mode.

### 1c. Test it

```bash
npm start
```

You should see `[discord] Logged in…` and `[twitch] Connected…`. Send a message in your Twitch chat and it should appear in the Discord channel within about a second. Then try `/say hello` in Discord.

---

## 2. Free hosting

The bot needs to run whenever you stream, so it must stay up without you looking after it. Here are three free options, best first.

### Option A: run it on your streaming PC (simplest, truly free)

You only need the bot while you're live, and your PC is already on then.

- **Windows:** double-click `start-bot.bat`. It installs dependencies the first time and restarts the bot automatically if it crashes. Start it before you go live, or have it start automatically:
  1. Press `Win + R`, type `shell:startup` and press Enter.
  2. Put a shortcut to `start-bot.bat` in that folder.
- **Mac/Linux:** run `npm start` (or use the pm2 setup from Option B).

Cost: 0. Uptime: exactly whenever your PC is on.

### Option B: Oracle Cloud "Always Free" VM (24/7, no sleeping)

This is a real Linux server that stays on all the time. Sign-up asks for a card for identity verification, but Always Free resources aren't charged.

1. Sign up at <https://www.oracle.com/cloud/free/>.
2. Go to **Compute → Instances → Create instance**:
   - Choose the image **Ubuntu 24.04**.
   - For the shape, pick **VM.Standard.E2.1.Micro** (AMD, Always Free) or a small Ampere A1. This bot needs under 100 MB of RAM.
   - Download the SSH key, then create the instance.
3. Connect with SSH (`ssh -i key.pem ubuntu@<public-ip>`) and run:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   git clone https://github.com/uditplayz/carlson-bot.git
   cd carlson-bot
   npm ci --omit=dev
   nano .env          # paste in your filled-in .env from your PC
   sudo cp deploy/carlson-bot.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now carlson-bot
   journalctl -u carlson-bot -f     # watch the logs
   ```
   systemd starts the bot on boot and restarts it if it crashes. You don't need to open any ports.

To update later, run `cd carlson-bot && git pull && npm ci --omit=dev && sudo systemctl restart carlson-bot`.

> Oracle cut its Always Free Ampere limits in 2026, and A1 capacity is sometimes "out of stock". The AMD micro shape is usually available and is enough for this bot.

### Option C: Render free web service plus an uptime pinger (no card, no server to manage)

Render's free plan puts a service to sleep after 15 minutes without incoming HTTP traffic. The bot runs a small health-check web server, so a free pinger can keep it awake.

1. Push this repo to GitHub. Then on <https://render.com>, go to **New → Blueprint**, pick the repo, and fill in the secrets it asks for. `render.yaml` sets up everything else.
2. Once it deploys, copy the service URL (for example `https://carlson-bot.onrender.com`).
3. On <https://cron-job.org> (free), create a job that requests that URL **every 10 minutes**.

Caveats:
- The free plan allows 750 hours per month, which is enough for one service running all month.
- Render can still restart free services now and then. Each restart drops about a minute of chat.
- Before a stream, open the URL once in your browser to make sure the bot is awake.

**Recommendation:** If you only need the bot while you stream, Option A is the most reliable free choice. If you want it online all the time, use Option B.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Used disallowed intents` | Turn on **Message Content Intent** in the Discord developer portal (Bot tab). |
| Slash commands don't appear | Make sure `DISCORD_GUILD_ID` is correct and that the bot was invited with the `applications.commands` scope. |
| `Could not log in to Twitch` / `Invalid refresh token` | Run `npm run twitch-auth` again and update `TWITCH_REFRESH_TOKEN`. Changing your Twitch password or disconnecting the app invalidates the token. |
| Messages from Discord don't show on Twitch | The bot account may be banned or timed out, or caught by slow mode or followers-only mode. Make it a mod. |
| ❌ reaction on a relayed message | Twitch rejected the message. Check the bot logs for the reason. |

## Configuration reference

All settings are documented in [`.env.example`](.env.example).
