import { Events } from 'discord.js';
import { handleGameMessage } from '../services/games/gameService.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message.guild || message.author.bot) return;
      await handleGameMessage(message);
    } catch (error) {
      console.error('Game message handler error:', error);
    }
  },
};
