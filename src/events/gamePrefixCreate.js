import { Events } from 'discord.js';
import { cancelGame, checkAnswer, getActiveGame, startGame } from '../services/games/gameService.js';
import { logger } from '../utils/logger.js';

const GAME_TTL_MS = 20_000;
const GAME_PREFIX_TYPES = new Map([
  ['فكك', 'fakk'], ['اشبك', 'ashbak'], ['اسرع', 'asra'], ['اسم', 'ism'],
  ['حساب', 'hisab'], ['رتب', 'ratib'], ['ذاكرة', 'thakira'], ['مختلف', 'mokhtalef'],
  ['عكس', 'aks'], ['حرف', 'harf'],
]);
const ANSWER_GAMES = new Set(['ratib', 'ashbak', 'thakira', 'aks', 'fakk', 'hisab', 'harf', 'mokhtalef']);
const GAME_LIST = [
  ['-فكك', 'فكك الكلمة إلى حروف منفصلة.'], ['-اشبك', 'اجمع الحروف واكتب الكلمة الصحيحة.'],
  ['-اسرع', 'أسرع شخص يكتب الكلمة يفوز.'], ['-اسم', 'اسم بنت أو اسم ولد أو جماد حسب الحرف.'],
  ['-حساب', 'حل العملية الحسابية بأسرع وقت.'], ['-رتب', 'رتب الحروف لتعرف الكلمة.'],
  ['-ذاكرة', 'احفظ الرقم واكتبه بعد اختفائه.'], ['-مختلف', 'حدد الكلمة المختلفة.'],
  ['-عكس', 'اكتب الكلمة بالعكس.'], ['-حرف', 'اكتب كلمة تبدأ بالحرف المطلوب.'],
];

function sendTimeout(channel, guildId, channelId) {
  cancelGame(guildId, channelId);
  channel.send('⏱️ **انتهت الجولة!** لم يجب أحد في الوقت المحدد.').catch(() => {});
}
function scheduleTimeout(message, game) {
  const guildId = message.guild.id, channelId = message.channel.id;
  setTimeout(() => {
    const active = getActiveGame(guildId, channelId);
    if (active === game) sendTimeout(message.channel, guildId, channelId);
  }, GAME_TTL_MS);
}
function winMessage(message, game) {
  const winner = `🏆 **${message.author} فاز!**`;
  return ANSWER_GAMES.has(game.type) ? `${winner}\nالإجابة: **${game.display || message.content.trim()}**` : winner;
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
        await message.channel.send(winMessage(message, active)).catch(() => {});
        return;
      }
      if (active && GAME_PREFIX_TYPES.has(command)) return;

      if (!content.startsWith('-')) return;
      if (command === 'العاب') {
        await message.channel.send(`🎮 **الألعاب المتاحة**\n\n${GAME_LIST.map(([n, d]) => `**${n}** — ${d}`).join('\n')}\n\n🛑 **-ايقاف** — إيقاف الجولة الحالية.`).catch(() => {});
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
