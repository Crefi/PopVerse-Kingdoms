import { SlashCommandBuilder } from 'discord.js';
import type { Command, CommandContext } from '../../../infrastructure/discord/types.js';

export const pingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check if the bot is responsive'),

  async execute(context: CommandContext): Promise<void> {
    const sent = await context.interaction.reply({
      content: '🏓 Pinging...',
      fetchReply: true,
    });

    const latency = sent.createdTimestamp - context.interaction.createdTimestamp;
    const apiLatency = Math.round(context.interaction.client.ws.ping);

    await context.interaction.editReply(
      `🏓 Pong!\n` +
        `📡 Bot Latency: ${latency}ms\n` +
        `🌐 API Latency: ${apiLatency}ms`
    );
  },
};
