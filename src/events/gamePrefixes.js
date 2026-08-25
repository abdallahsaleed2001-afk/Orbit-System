import { Events } from 'discord.js';
import { getCommandPrefix } from '../config/bot.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
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
  async execute(message, client) {
    try {
      if (!message.guild || message.author.bot) return;

      const config = await getGuildConfig(client, message.guild.id);
      const prefix = String(config?.prefix || getCommandPrefix() || '-');
      const content = String(message.content || '').trim();
      if (!content.startsWith(prefix)) return;

      const commandName = content.slice(prefix.length).trim().split(/\s+/)[0]?.toLowerCase();
      const type = GAME_PREFIXES.get(commandName);
      if (!type) return;

      const result = startGame(message.guild.id, message.channel.id, type);

      if (result?.error === 'active') {
        await message.channel.send('⚠️ توجد جولة شغالة بالفعل في هذه الروم.').catch(() => {});
        return;
      }

      if (result?.error || !result?.prompt) return;

      const prompt = await message.channel.send(result.prompt).catch((error) => {
        logger.error('Failed to send game prompt:', error);
        return null;
      });

      if (prompt && type === 'thakira') {
        setTimeout(() => {
          prompt.edit('🧠 **ذاكرة!**\n⏳ انتهى وقت الحفظ — اكتب الرقم الذي رأيته!').catch(() => {});
        }, 2000);
      }
    } catch (error) {
      logger.error('Error handling game prefix:', error);
    }
  },
};
