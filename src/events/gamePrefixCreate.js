import { Events } from 'discord.js';
import { getCommandPrefix } from '../config/bot.js';
import { handleGameMessage, startGame } from '../services/games/gameService.js';
import { logger } from '../utils/logger.js';

const GAME_PREFIX_TYPES = new Map([
  ['فكك', 'fakk'],
  ['اشبك', 'ashbak'],
  ['اسرع', 'asra'],
  ['اسم', 'ism'],
  ['حساب', 'hisab'],
  ['رتب', 'ratib'],
  ['ذاكرة', 'thakira'],
  ['مختلف', 'mokhtalef'],
  ['عكس', 'aks'],
  ['حرف', 'harf'],
]);

export default {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message.guild || message.author.bot) return;

      // Active games: treat every normal message as a possible answer.
      const handled = await handleGameMessage(message, message.client);
      if (handled) return;

      const prefix = getCommandPrefix();
      const content = String(message.content ?? '').trim();
      if (!content.startsWith(prefix)) return;

      const command = content.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
      const type = GAME_PREFIX_TYPES.get(command);
      if (!type) return;

      const game = startGame(message.guild.id, message.channel.id, type);
      if (game?.error === 'active') {
        await message.channel.send('⚠️ توجد جولة نشطة بالفعل في هذه القناة.').catch(() => {});
        return;
      }

      if (game?.prompt) {
        await message.channel.send({ content: game.prompt });
      }
    } catch (error) {
      logger.error('Error handling game prefix message:', error);
    }
  },
};
