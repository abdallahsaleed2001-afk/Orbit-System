import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { addRoulettePlayer, beginRouletteRound, chooseRandomTarget, chooseRouletteTarget, finishRouletteAction, getRoulette, getRoulettePlayerStats, getWinner, isParticipant, isSelected, removeRoulettePlayer, cancelRoulette, recordRouletteElimination, recordRouletteWinner, createRouletteGif } from '../../../services/games/rouletteService.js';

const spinTimers = new Map();
const decisionTimers = new Map();
const joinCountdowns = new Map();

function participantText(game) {
  return game.participants.map((p, i) => `${i + 1}. <@${p.id}>`).join('\n') || 'لا يوجد مشاركون.';
}

function buildRows(game) {
  const rows = [];
  if (game.phase === 'join') {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`roulette_join:${game.id}`).setLabel('انضم').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`roulette_stats:${game.id}`).setLabel('إحصائيات اللاعب').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`roulette_stop:${game.id}`).setLabel('إيقاف').setStyle(ButtonStyle.Secondary),
    ));
    return rows;
  }
  if (game.phase !== 'decision') return [];
  const selected = game.selectedId;
  const buttons = game.participants.map(p => new ButtonBuilder().setCustomId(`roulette_target:${game.id}:${p.id}`).setLabel(p.username.slice(0, 80)).setStyle(ButtonStyle.Secondary).setDisabled(p.id === selected));
  for (let i = 0; i < buttons.length && rows.length < 4; i += 5) rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`roulette_leave:${game.id}`).setLabel('انسحب').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`roulette_random:${game.id}`).setLabel('اطرد شخصًا عشوائيًا').setStyle(ButtonStyle.Secondary),
  ));
  return rows.slice(0, 5);
}

function wheelAttachment(game, selectedIndex) {
  return new AttachmentBuilder(createRouletteGif(game.participants, selectedIndex), { name: 'roulette.gif' });
}

export async function sendJoinMessage(message, game) {
  const endAt = Math.floor((Date.now() + 60_000) / 1000);
  const sent = await message.edit({ content: `بدأت الروليت!\n\nوقت الدخول: <t:${endAt}:R>\nستنطلق الجولة بعد انتهاء وقت الدخول.\n\n${participantText(game)}`, components: buildRows(game) });
  game.messageId = sent.id;
  const key = `${game.guildId}:${game.channelId}`;
  const startedAt = Date.now();
  const updateCountdown = setInterval(async () => {
    if (getRoulette(game.guildId, game.channelId) !== game || game.phase !== 'join') {
      clearInterval(updateCountdown);
      joinCountdowns.delete(key);
      return;
    }
    const remaining = Math.max(0, 60 - Math.floor((Date.now() - startedAt) / 1000));
    await sent.edit({ content: `بدأت الروليت!\n\nوقت الدخول: **${remaining} ثانية**\nستنطلق الجولة بعد انتهاء وقت الدخول.\n\n${participantText(game)}`, components: buildRows(game) }).catch(() => {});
    if (remaining <= 0) {
      clearInterval(updateCountdown);
      joinCountdowns.delete(key);
    }
  }, 1000);
  joinCountdowns.set(key, updateCountdown);
  game.onJoinTimeout = async () => {
    clearInterval(updateCountdown);
    joinCountdowns.delete(key);
    if (getRoulette(game.guildId, game.channelId) !== game || game.phase !== 'join') return;
    if (game.participants.length < 2) {
      await sent.edit({ content: 'انتهت الروليت — يجب أن يشارك شخصان على الأقل.', components: [], attachments: [] }).catch(() => {});
      cancelRoulette(game.guildId, game.channelId);
      return;
    }
    await spinRound(sent, game);
  };
  return sent;
}

function clearDecisionTimer(game) {
  const key = `${game.guildId}:${game.channelId}`;
  const timer = decisionTimers.get(key);
  if (timer) clearTimeout(timer);
  decisionTimers.delete(key);
}

function startDecisionTimer(message, game) {
  clearDecisionTimer(game);
  const key = `${game.guildId}:${game.channelId}`;
  decisionTimers.set(key, setTimeout(async () => {
    if (getRoulette(game.guildId, game.channelId) !== game || game.phase !== 'decision' || !game.selectedId) return;
    const timedOutId = game.selectedId;
    removeRoulettePlayer(game, timedOutId);
    recordRouletteElimination(game.guildId, timedOutId);
    finishRouletteAction(game);
    if (game.phase === 'finished') {
      const winner = getWinner(game);
      if (winner) recordRouletteWinner(game.guildId, winner.id);
      cancelRoulette(game.guildId, game.channelId);
      await message.edit({ content: `تم طرد <@${timedOutId}>\n\nالفائز في الروليت: ${winner ? `<@${winner.id}>` : 'لا يوجد فائز'}`, components: [], attachments: [] }).catch(() => {});
      return;
    }
    await message.edit({ content: `تم طرد <@${timedOutId}>\nسيتم بدء الجولة التالية بعد قليل.\n\n${participantText(game)}`, components: [], attachments: [] }).catch(() => {});
    setTimeout(() => spinRound(message, game).catch(() => {}), 1800);
  }, 10_000));
}

export async function spinRound(message, game) {
  clearDecisionTimer(game);
  const result = beginRouletteRound(game);
  if (!result) return;
  await message.edit({ content: `العجلة تدور...\n\n${participantText(game)}`, components: [], files: [wheelAttachment(game, result.index)] }).catch(() => {});
  const timerKey = `${game.guildId}:${game.channelId}`;
  clearTimeout(spinTimers.get(timerKey));
  const timer = setTimeout(async () => {
    if (getRoulette(game.guildId, game.channelId) !== game) return;
    game.phase = 'decision';
    await message.edit({ content: `توقفت العجلة على: <@${result.participant.id}>\n\n${participantText(game)}`, components: buildRows(game) }).catch(() => {});
    startDecisionTimer(message, game);
  }, 3600);
  spinTimers.set(timerKey, timer);
}

function statsText(user, stats) {
  const winRate = stats.rounds ? ((stats.wins / stats.rounds) * 100).toFixed(1) : '0.0';
  return `إحصائيات ${user}\n\nالجولات: **${stats.rounds}**\nالفوز: **${stats.wins}**\nالخسائر: **${stats.losses}**\nالإقصاءات: **${stats.eliminations}**\nنسبة الفوز: **${winRate}%**`;
}

export async function handleRouletteButton(interaction, client, args) {
  const action = interaction.customId.split(':')[0].replace('roulette_', '');
  const gameId = args[0];
  const targetId = args[1];
  const game = getRoulette(interaction.guildId, interaction.channelId);
  if (!game || game.id !== gameId) return interaction.reply({ content: 'هذه الجولة انتهت.', ephemeral: true });
  const message = interaction.message;
  if (action === 'join') {
    const result = addRoulettePlayer(interaction.guildId, interaction.channelId, interaction.user);
    if (result.error === 'joined') return interaction.reply({ content: 'أنت داخل الجولة بالفعل.', ephemeral: true });
    if (result.error === 'full') return interaction.reply({ content: 'وصلت الروليت للحد الأقصى من المشاركين.', ephemeral: true });
    if (result.error) return interaction.reply({ content: 'انتهى وقت الانضمام.', ephemeral: true });
    await interaction.update({ content: `بدأت الروليت!\n\nالمشاركون (${game.participants.length})\n${participantText(game)}`, components: buildRows(game) });
    return;
  }
  if (action === 'stop') {
    if (!isParticipant(game, interaction.user.id)) return interaction.reply({ content: 'فقط المشاركون يستطيعون إيقاف الروليت.', ephemeral: true });
    clearDecisionTimer(game);
    cancelRoulette(game.guildId, game.channelId);
    await interaction.update({ content: 'تم إيقاف الروليت.', components: [], attachments: [] });
    return;
  }
  if (action === 'stats') {
    if (game.phase !== 'join') return interaction.reply({ content: 'انتهى وقت عرض الإحصائيات.', ephemeral: true });
    if (!isParticipant(game, interaction.user.id)) return interaction.reply({ content: 'إحصائيات الروليت متاحة للمشاركين فقط.', ephemeral: true });
    const stats = getRoulettePlayerStats(interaction.guildId, interaction.user.id);
    return interaction.reply({ content: statsText(interaction.user, stats), ephemeral: true });
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
    if (winner) recordRouletteWinner(game.guildId, winner.id);
    cancelRoulette(game.guildId, game.channelId);
    await interaction.update({ content: `تم طرد <@${eliminatedId}>\n\nالفائز في الروليت: <@${winner.id}>`, components: [], attachments: [] });
    return;
  }
  if (eliminatedId) {
    await interaction.update({ content: `تم طرد <@${eliminatedId}>\nسيتم بدء الجولة التالية بعد قليل.`, components: [], attachments: [] });
    setTimeout(() => spinRound(message, game).catch(() => {}), 1800);
    return;
  }
  await interaction.update({ content: `سيتم بدء الجولة التالية بعد قليل.\n\n${participantText(game)}`, components: [], attachments: [] });
  setTimeout(() => spinRound(message, game).catch(() => {}), 1800);
}

export default [
  { name: 'roulette_join', execute: handleRouletteButton },
  { name: 'roulette_stop', execute: handleRouletteButton },
  { name: 'roulette_target', execute: handleRouletteButton },
  { name: 'roulette_leave', execute: handleRouletteButton },
  { name: 'roulette_random', execute: handleRouletteButton },
  { name: 'roulette_stats', execute: handleRouletteButton },
];
