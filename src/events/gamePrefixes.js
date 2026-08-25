import { Events } from 'discord.js';
import { startGame } from '../services/games/gameService.js';
import { logger } from '../utils/logger.js';

const GAME_PREFIXES = new Map([
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

      // Game commands intentionally use the fixed '-' prefix.
      const content = String(message.content || '').trim();
      if (!content.startsWith('-')) return;

      const commandName = content.slice(1).trim().split(/\s+/)[0]?.toLowerCase();
      const type = GAME_PREFIXES.get(commandName);
      if (!type) return;

      const result = startGame(message.guild.id, message.channel.id, type);

      if (result?.error === 'active') {
        await message.channel.send('⚠️ توجد جولة شغالة بالفعل في هذه الروم.').catch(() => {});
        return;
      }

      if (result?.error || !result?.prompt) {
        logger.warn(`Game ${commandName} did not return a prompt.`);
        return;
      }

      const prompt = await message.channel.send({ content: result.prompt }).catch((error) => {
        logger.error('Failed to send game prompt:', error);
        return null;
      });

      if (prompt && type === 'thakira') {
        setTimeout(() => {
          prompt.edit({ content: '🧠 **ذاكرة!**\n⏳ انتهى وقت الحفظ — اكتب الرقم الذي رأيته!' }).catch(() => {});
        }, 2000);
      }
    } catch (error) {
      logger.error('Error handling game prefix:', error);
    }
  },
};
