import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { addRoulettePlayer, beginRouletteRound, chooseRandomTarget, chooseRouletteTarget, finishRouletteAction, getRoulette, getRoulettePlayerStats, getWinner, isParticipant, isSelected, removeRoulettePlayer, cancelRoulette, recordRouletteElimination, recordRouletteWinner } from '../../../services/games/rouletteService.js';
import { createRouletteGif } from '../../../services/games/rouletteGif.js';
import { createRouletteWinnerImage } from '../../../services/games/rouletteWinnerImage.js';

const decisionTimers = new Map();

function buildRows(game) {
  const rows = [];
  if (game.phase === 'join') {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`roulette_join:${game.id}`).setLabel('انضم').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`roulette_stats:${game.id}`).setLabel('إحصائياتي').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`roulette_leave_join:${game.id}`).setLabel('انسحاب').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`roulette_stop:${game.id}`).setLabel('إيقاف').setStyle(ButtonStyle.Secondary),
    ));
    return rows;
  }
  if (game.phase !== 'decision') return [];
  const selected = game.selectedId;
  const buttons = game.participants.map(p => new ButtonBuilder().setCustomId(`roulette_target:${game.id}:${p.id}`).setLabel(p.username.slice(0, 80)).setStyle(ButtonStyle.Secondary).setDisabled(p.id === selected));
  for (let i = 0; i < buttons.length && rows.length < 4; i += 5) rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`roulette_leave:${game.id}`).setLabel('انسحاب').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`roulette_random:${game.id}`).setLabel('اطرد شخصًا عشوائيًا').setStyle(ButtonStyle.Secondary),
  ));
  return rows.slice(0, 5);
}

const joinContent = game => `بدأت الروليت!\n\nوقت الدخول: <t:${game.joinEndsAt}:R>\nعدد اللاعبين: **${game.participants.length}/100**`;
const playerCount = game => `عدد اللاعبين: **${game.participants.length}/100**`;
const roundContent = (game, selected) => `**🎯 دور <@${selected.id}>**\nاختر لاعبًا لإقصائه.\n\n${playerCount(game)} • الجولة **#${game.round}**`;

function clearDecisionTimer(game) {
  const key = `${game.guildId}:${game.channelId}`;
  const timer = decisionTimers.get(key);
  if (timer) clearTimeout(timer);
  decisionTimers.delete(key);
}

function statsText(user, stats) {
  const winRate = stats.rounds ? ((stats.wins / stats.rounds) * 100).toFixed(1) : '0.0';
  return `إحصائيات ${user}\n\nالجولات: **${stats.rounds}**\nالفوز: **${stats.wins}**\nالخسائر: **${stats.losses}**\nالإقصاءات: **${stats.eliminations}**\nنسبة الفوز: **${winRate}%**`;
}

async function sendRoundMessage(channel, game, result) {
  const gif = createRouletteGif(game, result.index);
  const attachment = new AttachmentBuilder(gif, { name: `roulette-round-${game.round}.gif`, description: 'Orbit System animated roulette round' });
  const message = await channel.send({ content: roundContent(game, result.participant), files: [attachment], components: buildRows(game) });
  game.currentMessageId = message.id;
  return message;
}

async function sendWinnerMessage(channel, winner) {
  const image = createRouletteWinnerImage(winner);
  const attachment = new AttachmentBuilder(image, { name: 'roulette-winner.png', description: 'Orbit System roulette winner' });
  const embed = new EmbedBuilder()
    .setTitle('🏆 الفائز في الروليت')
    .setDescription(`**${winner.username}**\n<@${winner.id}>`)
    .setImage('attachment://roulette-winner.png');
  if (winner.avatar) embed.setThumbnail(winner.avatar);
  await channel.send({ embeds: [embed], files: [attachment] });
}

async function startNextRound(channel, game) {
  await new Promise(resolve => setTimeout(resolve, 1800));
  if (getRoulette(game.guildId, game.channelId) !== game || game.phase === 'finished') return;
  await spinRound(channel, game);
}

function startDecisionTimer(channel, game) {
  clearDecisionTimer(game);
  const key = `${game.guildId}:${game.channelId}`;
  decisionTimers.set(key, setTimeout(async () => {
    if (getRoulette(game.guildId, game.channelId) !== game || game.phase !== 'decision' || !game.selectedId) return;
    const timedOutId = game.selectedId;
    removeRoulettePlayer(game, timedOutId);
    recordRouletteElimination(game.guildId, timedOutId);
    finishRouletteAction(game);

    await channel.send({ content: `تم طرد <@${timedOutId}> لعدم التفاعل` }).catch(() => {});

    if (game.phase === 'finished') {
      const winner = getWinner(game);
      if (winner) {
        recordRouletteWinner(game.guildId, winner.id);
        cancelRoulette(game.guildId, game.channelId);
        await sendWinnerMessage(channel, winner).catch(() => {});
      }
      return;
    }

    await startNextRound(channel, game);
  }, 10_000));
}

export async function sendJoinMessage(message, game) {
  game.joinEndsAt = Math.floor((Date.now() + 60_000) / 1000);
  const sent = await message.channel.send({ content: joinContent(game), components: buildRows(game) });
  game.messageId = sent.id;
  game.onJoinTimeout = async () => {
    if (getRoulette(game.guildId, game.channelId) !== game || game.phase !== 'join') return;
    if (game.participants.length < 2) {
      await sent.edit({ content: 'انتهت الروليت — يجب أن يشارك شخصان على الأقل.', components: [], attachments: [] }).catch(() => {});
      cancelRoulette(game.guildId, game.channelId);
      return;
    }
    await spinRound(message.channel, game);
  };
  return sent;
}

export async function spinRound(channel, game) {
  clearDecisionTimer(game);
  const result = beginRouletteRound(game);
  if (!result) return;
  await new Promise(resolve => setTimeout(resolve, 3600));
  if (getRoulette(game.guildId, game.channelId) !== game) return;
  game.phase = 'decision';
  try {
    await sendRoundMessage(channel, game, result);
    startDecisionTimer(channel, game);
  } catch (error) {
    console.error('[roulette] Failed to send round message:', error);
    game.phase = 'decision';
    startDecisionTimer(channel, game);
  }
}

export async function handleRouletteButton(interaction, client, args) {
  const action = interaction.customId.split(':')[0].replace('roulette_', '');
  const gameId = args[0];
  const targetId = args[1];
  const game = getRoulette(interaction.guildId, interaction.channelId);
  if (!game || game.id !== gameId) return interaction.reply({ content: 'هذه الجولة انتهت.', ephemeral: true });

  if (game.phase !== 'join' && interaction.message.id !== game.currentMessageId) {
    return interaction.reply({ content: 'هذه رسالة جولة قديمة. انتظر الجولة الحالية.', ephemeral: true });
  }

  if (action === 'join') {
    const result = addRoulettePlayer(interaction.guildId, interaction.channelId, interaction.user);
    if (result.error === 'joined') return interaction.reply({ content: 'أنت داخل الجولة بالفعل.', ephemeral: true });
    if (result.error === 'full') return interaction.reply({ content: 'وصلت الروليت للحد الأقصى من المشاركين.', ephemeral: true });
    if (result.error) return interaction.reply({ content: 'انتهى وقت الدخول.', ephemeral: true });
    await interaction.update({ content: joinContent(game), components: buildRows(game) });
    return;
  }
  if (action === 'leave_join') {
    if (!isParticipant(game, interaction.user.id)) return interaction.reply({ content: 'أنت لست داخل اللعبة.', ephemeral: true });
    if (game.phase !== 'join') return interaction.reply({ content: 'انتهى وقت الدخول.', ephemeral: true });
    removeRoulettePlayer(game, interaction.user.id);
    await interaction.update({ content: joinContent(game), components: buildRows(game) });
    return;
  }
  if (action === 'stop') {
    if (!isParticipant(game, interaction.user.id)) return interaction.reply({ content: 'فقط المشاركون يستطيعون إيقاف الروليت.', ephemeral: true });
    clearDecisionTimer(game);
    cancelRoulette(game.guildId, game.channelId);
    return interaction.reply({ content: 'تم إيقاف الروليت.', ephemeral: true });
  }
  if (action === 'stats') {
    if (game.phase !== 'join') return interaction.reply({ content: 'انتهى وقت عرض الإحصائيات.', ephemeral: true });
    if (!isParticipant(game, interaction.user.id)) return interaction.reply({ content: 'إحصائيات الروليت متاحة للمشاركين فقط.', ephemeral: true });
    return interaction.reply({ content: statsText(interaction.user, getRoulettePlayerStats(interaction.guildId, interaction.user.id)), ephemeral: true });
  }
  if (!isSelected(game, interaction.user.id)) return interaction.reply({ content: 'الدور ليس لك.', ephemeral: true });

  clearDecisionTimer(game);
  let eliminatedId = null;
  if (action === 'target') {
    if (!targetId || targetId === interaction.user.id) return interaction.reply({ content: 'اختر شخصًا آخر من القائمة.', ephemeral: true });
    if (!chooseRouletteTarget(game, targetId)) return interaction.reply({ content: 'هذا الشخص لم يعد في الجولة.', ephemeral: true });
    eliminatedId = targetId;
  } else if (action === 'leave') {
    removeRoulettePlayer(game, interaction.user.id);
  } else if (action === 'random') {
    const target = chooseRandomTarget(game, interaction.user.id);
    if (target) eliminatedId = target.id;
  }

  if (eliminatedId) recordRouletteElimination(game.guildId, eliminatedId);
  finishRouletteAction(game);
  if (game.phase === 'finished') {
    const winner = getWinner(game);
    if (winner) {
      recordRouletteWinner(game.guildId, winner.id);
      cancelRoulette(game.guildId, game.channelId);
      await interaction.reply({ content: `تم إقصاء <@${eliminatedId}>.` }).catch(() => {});
      await sendWinnerMessage(interaction.channel, winner).catch(() => {});
    }
    return;
  }

  await interaction.reply({ content: eliminatedId ? `تم إقصاء <@${eliminatedId}>. الجولة التالية ستبدأ الآن.` : 'تم تنفيذ اختيارك. الجولة التالية ستبدأ الآن.', ephemeral: true });
  await startNextRound(interaction.channel, game);
}

export default [
  { name: 'roulette_join', execute: handleRouletteButton },
  { name: 'roulette_stop', execute: handleRouletteButton },
  { name: 'roulette_target', execute: handleRouletteButton },
  { name: 'roulette_leave', execute: handleRouletteButton },
  { name: 'roulette_leave_join', execute: handleRouletteButton },
  { name: 'roulette_random', execute: handleRouletteButton },
  { name: 'roulette_stats', execute: handleRouletteButton },
];
