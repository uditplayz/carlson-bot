const MAX_LENGTH = 2000;

// Batches Twitch chat lines into as few Discord messages as possible, so busy
// chats don't hit Discord's rate limit (~5 messages / 5 s per channel).
export class DiscordQueue {
  constructor(intervalMs = 1200) {
    this.lines = [];
    this.channel = null;
    this.timer = setInterval(() => this.flush(), intervalMs);
  }

  setChannel(channel) {
    this.channel = channel;
  }

  push(line) {
    this.lines.push(line.length > MAX_LENGTH ? `${line.slice(0, MAX_LENGTH - 1)}…` : line);
    // Don't let the backlog grow forever if Discord is unreachable.
    if (this.lines.length > 500) this.lines.splice(0, this.lines.length - 500);
  }

  async flush() {
    if (!this.channel || this.lines.length === 0 || this.flushing) return;
    this.flushing = true;
    try {
      while (this.lines.length) {
        let chunk = '';
        while (this.lines.length && chunk.length + this.lines[0].length + 1 <= MAX_LENGTH) {
          chunk += (chunk ? '\n' : '') + this.lines.shift();
        }
        await this.channel.send({ content: chunk, allowedMentions: { parse: [] } });
      }
    } catch (err) {
      console.error('[discord] Failed to post chat batch:', err.message);
    } finally {
      this.flushing = false;
    }
  }

  stop() {
    clearInterval(this.timer);
  }
}
