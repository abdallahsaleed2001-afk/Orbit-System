import { Events } from 'discord.js';
import minesCommand from '../commands/Fun/mines.js';
import { createMockInteraction } from '../utils/messageAdapter.js';

export default {
  name: Events.MessageCreate,
  async execute(message, client) {
    if (!message.guild || message.author?.bot) return;
    if (String(message.content || '').trim() !== '-لغم') return;

    // This is intentionally isolated to the Mines game so the existing
    // prefix behavior of every other command/game remains untouched.
    try {
      const interaction = createMockInteraction(message, minesCommand.data, []);
      await minesCommand.prefixExecute(interaction, client);
    } catch (error) {
      client.logger?.error?.('Error handling -لغم prefix:', error);
      console.error('[mines] -لغم prefix error:', error);
    }
  },
};
