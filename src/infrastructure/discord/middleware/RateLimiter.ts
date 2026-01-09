import type { CommandContext, CommandMiddleware, RateLimitEntry } from '../types.js';
import logger from '../../../shared/utils/logger.js';

export class RateLimiter implements CommandMiddleware {
  name = 'RateLimiter';

  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), windowMs);
  }

  async execute(context: CommandContext): Promise<boolean> {
    const userId = context.interaction.user.id;
    const commandName = context.interaction.commandName;
    const key = `${userId}:${commandName}`;

    const now = Date.now();
    const entry = this.limits.get(key);

    if (entry) {
      if (now < entry.resetAt) {
        if (entry.count >= this.maxRequests) {
          const remainingTime = Math.ceil((entry.resetAt - now) / 1000);
          await context.interaction.reply({
            content: `⏳ You're using this command too fast! Please wait ${remainingTime} seconds.`,
            ephemeral: true,
          });
          logger.warn(`Rate limit hit for user ${userId} on command ${commandName}`);
          return false;
        }
        entry.count++;
      } else {
        // Reset the window
        entry.count = 1;
        entry.resetAt = now + this.windowMs;
      }
    } else {
      this.limits.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now >= entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }
}
