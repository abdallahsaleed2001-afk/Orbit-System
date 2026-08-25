import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { addRoulettePlayer, beginRouletteRound, chooseRandomTarget, chooseRouletteTarget, finishRouletteAction, getRoulette, getWinner, isParticipant, isSelected, removeRoulettePlayer, cancelRoulette } from '../../../services/games/rouletteService.js';

const spinTimers = new Map();

function participantText(game) {
  return game.participants.map((p, i) => `${i + 1}. <@${p.id}>`).join('\n') || 'لا يوجد مشاركون.';
}

function buildRows(game) {
  const rows = [];
  if (game.phase === 'join') {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`roulette_join:${game.id}`).setLabel('انضم').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`roulette_stop:${game.id}`).setLabel('إيقاف').setStyle(ButtonStyle.Danger),
    ));
    return rows;
  }
  if (game.phase !== 'decision') return [];
  const selected = game.selectedId;
  const buttons = game.participants.map(p => new ButtonBuilder().setCustomId(`roulette_target:${game.id}:${p.id}`).setLabel(p.username.slice(0, 80)).setStyle(p.id === selected ? ButtonStyle.Secondary : ButtonStyle.Primary).setDisabled(p.id === selected));
  for (let i = 0; i < buttons.length && rows.length < 4; i += 5) rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 5)));
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`roulette_leave:${game.id}`).setLabel('انسحب').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`roulette_random:${game.id}`).setLabel('اطرد شخصًا عشوائيًا').setStyle(ButtonStyle.Danger),
  ));
  return rows.slice(0, 5);
}

function payload(game) {
  return { content: `المشاركون (${game.participants.length})\n${participantText(game)}`, components: buildRows(game) };
}

export async function sendJoinMessage(message, game) {
  const sent = await message.channel.send({ content: `بدأت الروليت!\n${message.author}\nاضغط انضم للدخول. لديك 12 ثانية.`, components: buildRows(game) });
  game.messageId = sent.id;
  game.onJoinTimeout = async () => {
    if (getRoulette(game.guildId, game.channelId) !== game || game.phase !== 'join') return;
    if (game.participants.length < 2) {
      await sent.edit({ content: 'انتهت الروليت — يجب أن يشارك شخصان على الأقل.', components: [] }).catch(() => {});
      cancelRoulette(game.guildId, game.channelId);
      return;
    }
    await spinRound(sent, game);
  };
  return sent;
}

export async function spinRound(message, game) {
  const result = beginRouletteRound(game);
  if (!result) return;
  await message.edit({ content: `العجلة تدور...\n\n${participantText(game)}`, components: [] }).catch(() => {});
  const timerKey = `${game.guildId}:${game.channelId}`;
  clearTimeout(spinTimers.get(timerKey));
  const timer = setTimeout(async () => {
    if (getRoulette(game.guildId, game.channelId) !== game) return;
    game.phase = 'decision';
    await message.edit({ content: `توقفت العجلة على: <@${result.participant.id}>\n\n${participantText(game)}`, components: buildRows(game) }).catch(() => {});
  }, 3600);
  spinTimers.set(timerKey, timer);
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
    await interaction.update(payload(game));
    return;
  }
  if (action === 'stop') {
    if (!isParticipant(game, interaction.user.id)) return interaction.reply({ content: 'فقط المشاركون يستطيعون إيقاف الروليت.', ephemeral: true });
    cancelRoulette(game.guildId, game.channelId);
    await interaction.update({ content: 'تم إيقاف الروليت.', components: [] });
    return;
  }
  if (!isSelected(game, interaction.user.id)) return interaction.reply({ content: 'الدور ليس لك.', ephemeral: true });
  if (action === 'target') {
    if (!targetId || targetId === interaction.user.id) return interaction.reply({ content: 'اختر شخصًا آخر من القائمة.', ephemeral: true });
    if (!chooseRouletteTarget(game, targetId)) return interaction.reply({ content: 'هذا الشخص لم يعد في الجولة.', ephemeral: true });
  } else if (action === 'leave') removeRoulettePlayer(game, interaction.user.id);
  else if (action === 'random') chooseRandomTarget(game, interaction.user.id);
  finishRouletteAction(game);
  if (game.phase === 'finished') {
    const winner = getWinner(game);
    cancelRoulette(game.guildId, game.channelId);
    await interaction.update({ content: `الفائز في الروليت: <@${winner.id}>`, components: [] });
    return;
  }
  await interaction.update({ content: `الجولة التالية...\n\n${participantText(game)}`, components: buildRows(game) });
  setTimeout(() => spinRound(message, game).catch(() => {}), 900);
}

export default [
  { name: 'roulette_join', execute: handleRouletteButton },
  { name: 'roulette_stop', execute: handleRouletteButton },
  { name: 'roulette_target', execute: handleRouletteButton },
  { name: 'roulette_leave', execute: handleRouletteButton },
  { name: 'roulette_random', execute: handleRouletteButton },
];
