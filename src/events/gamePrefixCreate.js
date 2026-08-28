import { Events } from 'discord.js';
import { cancelGame, checkAnswer, getActiveGame } from '../services/games/gameService.js';
import { cancelRoulette, getRoulette } from '../services/games/rouletteService.js';

const GAME_TTL_MS = 20_000;
const MEMORY_HIDE_MS = 2_000;

function getTimeoutAnswer(game) {
  if (game?.type === 'fakk' && game?.display) return [...String(game.display)].join(' ');
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
  const answerText = answer ? `\n**الإجابة الصحيحة: ${answer}**` : '';
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
      const command = content.startsWith('-')
        ? content.slice(1).trim().split(/\s+/)[0]?.toLowerCase()
        : '';
      const roulette = getRoulette(message.guild.id, message.channel.id);

      // Keep -ايقاف available for every active game without exposing
      // individual game launch commands.
      if (command === 'ايقاف') {
        if (roulette) {
          cancelRoulette(message.guild.id, message.channel.id);
          await message.channel.send('🛑 **تم إيقاف الروليت.**').catch(() => {});
          return;
        }

        const active = getActiveGame(message.guild.id, message.channel.id);
        if (active) {
          cancelGame(message.guild.id, message.channel.id);
          await message.channel.send('🛑 **تم إيقاف الجولة.**').catch(() => {});
          return;
        }

        await message.channel.send('ℹ️ لا توجد جولة نشطة في هذه القناة.').catch(() => {});
        return;
      }

      const active = getActiveGame(message.guild.id, message.channel.id);
      if (!active) return;

      // Answers remain message-based exactly as before for the games that use them.
      if (!command && checkAnswer(active, content)) {
        cancelGame(message.guild.id, message.channel.id);
        await message.channel.send(winMessage(message)).catch(() => {});
        return;
      }

      // Starting games is now exclusively handled by the unified -العاب menu.
      scheduleTimeout(message, active);

      if (active.type === 'thakira') {
        setTimeout(async () => {
          if (getActiveGame(message.guild.id, message.channel.id) !== active) return;
          try {
            const gameMessage = message.channel.messages.cache.last();
            if (gameMessage) {
              await gameMessage.edit({
                content: '🧠 **انتهى وقت الحفظ — اكتب الرقم الذي رأيته!**',
              });
            }
          } catch {
            // Ignore message update failures; gameplay state remains valid.
          }
        }, MEMORY_HIDE_MS);
      }
    } catch {
      // Keep message handling isolated from the rest of the bot.
    }
  },
};
