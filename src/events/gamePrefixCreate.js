import { Events } from 'discord.js';
import { cancelGame, checkAnswer, getActiveGame, startGame } from '../services/games/gameService.js';
import { logger } from '../utils/logger.js';

const GAME_TTL_MS = 20_000;
const GAME_PREFIX_TYPES = new Map([
  ['فكك', 'fakk'], ['اشبك', 'ashbak'], ['اسرع', 'asra'], ['اسم', 'ism'],
  ['حساب', 'hisab'], ['رتب', 'ratib'], ['ذاكرة', 'thakira'], ['مختلف', 'mokhtalef'],
  ['عكس', 'aks'], ['حرف', 'harf'],
]);
const GAME_LIST = ['-فكك', '-اشبك', '-اسرع', '-اسم', '-حساب', '-رتب', '-ذاكرة', '-مختلف', '-عكس', '-حرف'];

function getTimeoutAnswer(game) {
  if (game?.display) return game.display;
  if (game?.answer) return game.answer;
  if (game?.type === 'ism' && game.dictionary instanceof Set) {
    const letter = String(game.answerLetter || '').trim();
    const match = [...game.dictionary].find((value) => value.startsWith(letter));
    return match || 'لا توجد إجابة واحدة محددة';
  }
  return null;
}

function sendTimeout(channel, guildId, channelId, game) {
  const answer = getTimeoutAnswer(game);
  cancelGame(guildId, channelId);
  const answerText = answer ? `\n**الاجابة الصحيحة: ${answer}**` : '';
  channel.send(`⏱️ **انتهت الجولة!** لم يجب أحد في الوقت المحدد.${answerText}`).catch(() => {});
}

function scheduleTimeout(message, game) {
  const guildId = message.guild.id;
  const channelId = message.channel.id;
  setTimeout(() => {
    const active = getActiveGame(guildId, channelId);
    if (active === game) sendTimeout(message.channel, guildId, channelId, game);
  }, GAME_TTL_MS);
}

function winMessage(message) {
  return `🏆 **${message.author} فاز!**`;
}

export default {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message.guild || message.author.bot) return;
      const content = String(message.content ?? '').trim();
      const command = content.startsWith('-') ? content.slice(1).trim().split(/\s+/)[0]?.toLowerCase() : '';
      const active = getActiveGame(message.guild.id, message.channel.id);

      if (active && command === 'ايقاف') {
        cancelGame(message.guild.id, message.channel.id);
        await message.channel.send('🛑 **تم إيقاف الجولة.**').catch(() => {});
        return;
      }
      if (active && !command && checkAnswer(active, content)) {
        cancelGame(message.guild.id, message.channel.id);
        await message.channel.send(winMessage(message)).catch(() => {});
        return;
      }
      if (active && GAME_PREFIX_TYPES.has(command)) return;

      if (!content.startsWith('-')) return;
      if (command === 'العاب') {
        await message.channel.send(`🎮 **الألعاب المتاحة**\n\n${GAME_LIST.map((name) => `**${name}**`).join('\n')}\n\n🛑 **-ايقاف**`).catch(() => {});
        return;
      }
      if (command === 'ايقاف') {
        await message.channel.send('ℹ️ لا توجد جولة نشطة في هذه القناة.').catch(() => {});
        return;
      }

      const type = GAME_PREFIX_TYPES.get(command);
      if (!type) return;
      const game = startGame(message.guild.id, message.channel.id, type);
      if (game?.error === 'active') {
        await message.channel.send('⚠️ توجد جولة نشطة بالفعل في هذه القناة.').catch(() => {});
        return;
      }
      if (!game?.prompt) return;
      await message.channel.send({ content: game.prompt });
      scheduleTimeout(message, game);
      if (type === 'thakira') {
        setTimeout(() => {
          if (getActiveGame(message.guild.id, message.channel.id) === game) {
            message.channel.send('🧠 **انتهى وقت الحفظ — اكتب الرقم الذي رأيته!**').catch(() => {});
          }
        }, 2000);
      }
    } catch (error) {
      logger.error('Error handling game prefix message:', error);
    }
  },
};
