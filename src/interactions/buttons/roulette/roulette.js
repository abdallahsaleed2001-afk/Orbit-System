import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  addRoulettePlayer,
  beginRouletteRound,
  chooseRandomTarget,
  chooseRouletteTarget,
  finishRouletteAction,
  getRoulette,
  getRoulettePlayerStats,
  getWinner,
  isParticipant,
  isSelected,
  removeRoulettePlayer,
  cancelRoulette,
  recordRouletteElimination,
  recordRouletteWinner,
  scheduleJoinTimeout,
  scheduleDecisionTimeout,
} from '../../../services/games/rouletteService.js';
import { createRouletteGif } from '../../../services/games/rouletteGif.js';
import { createRouletteJoinImage } from '../../../services/games/rouletteJoinImage.js';
import { createRouletteWinnerImage } from '../../../services/games/rouletteWinnerImage.js';

const decisionTimers = new Map();

function gameKey(game) {
  return `${game.guildId}:${game.channelId}`;
}

function clearDecisionTimer(game) {
  const key = gameKey(game);
  const timer = decisionTimers.get(key);
  if (timer) clearTimeout(timer);
  decisionTimers.delete(key);
}

function buildRows(game) {
  if (game.phase === 'join') {
    return [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`roulette_join:${game.id}`)
        .setLabel('انضم')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`roulette_stats:${game.id}`)
        .setLabel('إحصائياتي')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`roulette_leave_join:${game.id}`)
        .setLabel('انسحاب')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`roulette_stop:${game.id}`)
        .setLabel('إيقاف')
        .setStyle(ButtonStyle.Secondary),
    )];
  }

  if (game.phase !== 'decision' || !game.selectedId) return [];

  // The player whose turn it is is never shown as an elimination target.
  const targetButtons = game.participants
    .filter(player => player.id !== game.selectedId)
    .map(player => new ButtonBuilder()
      .setCustomId(`roulette_target:${game.id}:${player.id}`)
      .setLabel(String(player.username).slice(0, 80))
      .setStyle(ButtonStyle.Secondary));

  const rows = [];
  for (let i = 0; i < targetButtons.length && rows.length < 4; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(...targetButtons.slice(i, i + 5)));
  }

  if (rows.length < 5) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`roulette_random:${game.id}`)
        .setLabel('اطرد شخصًا عشوائيًا')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`roulette_leave:${game.id}`)
        .setLabel('انسحاب')
        .setStyle(ButtonStyle.Secondary),
    ));
  }

  return rows.slice(0, 5);
}

const joinContent = game => `**INFINITY GAMES — ROULETTE**\n\nالتسجيل مفتوح الآن.\nوقت الدخول: <t:${game.joinEndsAt}:R>\nعدد اللاعبين: **${game.participants.length}/100**`;
const playerCount = game => `عدد اللاعبين: **${game.participants.length}/100**`;
const roundContent = (game, selected) => `**INFINITY GAMES — ROULETTE**\n\n🎯 **دور <@${selected.id}>**\nاختر لاعبًا لإقصائه.\n\n${playerCount(game)} • الجولة **#${game.round}**`;

function statsText(user, stats) {
  const winRate = stats.rounds ? ((stats.wins / stats.rounds) * 100).toFixed(1) : '0.0';
  return `إحصائيات ${user}\n\nالجولات: **${stats.rounds}**\nالفوز: **${stats.wins}**\nالخسائر: **${stats.losses}**\nالإقصاءات: **${stats.eliminations}**\nنسبة الفوز: **${winRate}%**`;
}

async function sendRoundMessage(channel, game, result) {
  const gif = createRouletteGif(game, result.index);
  const attachment = new AttachmentBuilder(gif, {
    name: `roulette-round-${game.round}.gif`,
    description: 'INFINITY GAMES animated roulette round',
  });

  // Every round gets a completely new message. Previous round messages are never edited.
  const sent = await channel.send({
    content: roundContent(game, result.participant),
    files: [attachment],
    components: buildRows(game),
  });

  game.currentMessageId = sent.id;
  return sent;
}

async function sendWinnerMessage(channel, winner) {
  const image = createRouletteWinnerImage(winner);
  const attachment = new AttachmentBuilder(image, {
    name: 'roulette-winner.png',
    description: 'INFINITY GAMES roulette winner',
  });

  await channel.send({
    content: `🏆 **INFINITY GAMES — الفائز في الروليت**\n**${winner.username}**\n<@${winner.id}>`,
    files: [attachment],
  });
}

async function startNextRound(channel, game) {
  await new Promise(resolve => setTimeout(resolve, 1200));

  if (getRoulette(game.guildId, game.channelId) !== game || game.phase === 'finished') return;
  await spinRound(channel, game);
}

function startDecisionTimer(channel, game) {
  clearDecisionTimer(game);

  const key = gameKey(game);
  const timeout = setTimeout(async () => {
    decisionTimers.delete(key);

    if (getRoulette(game.guildId, game.channelId) !== game || game.phase !== 'decision' || !game.selectedId) return;

    const timedOutId = game.selectedId;
    if (!game.participants.some(player => player.id === timedOutId)) return;

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
  }, 30_000);

  decisionTimers.set(key, timeout);
  scheduleDecisionTimeout(game, () => {
    // The service timer is kept as a safety fallback; the interaction-local timer above
    // owns the actual Discord messages and is cleared whenever a valid action is made.
  });
}

export async function sendJoinMessage(message, game) {
  game.joinEndsAt = Math.floor((Date.now() + 60_000) / 1000);
  const guildName = message.guild?.name || 'INFINITY';
  const image = createRouletteJoinImage(guildName);
  const attachment = new AttachmentBuilder(image, {
    name: 'roulette-registration.png',
    description: 'INFINITY GAMES roulette registration',
  });

  const payload = {
    content: joinContent(game),
    files: [attachment],
    components: buildRows(game),
  };

  const sent = message.author?.bot
    ? await message.edit(payload)
    : await message.channel.send(payload);

  game.messageId = sent.id;
  game.currentMessageId = sent.id;

  const startRound = async () => {
    if (getRoulette(game.guildId, game.channelId) !== game || game.phase !== 'join') return;

    if (game.participants.length < 2) {
      await sent.edit({
        content: '**INFINITY GAMES — ROULETTE**\n\nانتهى التسجيل — يجب أن يشارك شخصان على الأقل.',
        components: [],
        attachments: [],
      }).catch(() => {});
      cancelRoulette(game.guildId, game.channelId);
      return;
    }

    // Registration is closed here. The actual round is always a new message.
    await sent.edit({
      content: '**INFINITY GAMES — ROULETTE**\n\nانتهى التسجيل. بدأت الجولة الأولى.',
      components: [],
      attachments: [],
    }).catch(() => {});

    await spinRound(message.channel, game);
  };

  game.onJoinTimeout = startRound;
  scheduleJoinTimeout(game, startRound);
  return sent;
}

export async function spinRound(channel, game) {
  clearDecisionTimer(game);

  const result = beginRouletteRound(game);
  if (!result) {
    if (game.participants.length <= 1) {
      const winner = getWinner(game);
      if (winner) {
        recordRouletteWinner(game.guildId, winner.id);
        cancelRoulette(game.guildId, game.channelId);
        await sendWinnerMessage(channel, winner).catch(() => {});
      }
    }
    return;
  }

  // The wheel animation takes time, but the game stays in 'spinning' so no decision
  // can be made before the new round message exists.
  await new Promise(resolve => setTimeout(resolve, 3600));

  if (getRoulette(game.guildId, game.channelId) !== game || game.phase !== 'spinning') return;

  try {
    game.phase = 'decision';
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

  if (!game || game.id !== gameId) {
    return interaction.reply({ content: 'هذه الجولة انتهت.', ephemeral: true });
  }

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

  if (action === 'stats') {
    if (game.phase !== 'join') return interaction.reply({ content: 'انتهى وقت الدخول.', ephemeral: true });
    if (!isParticipant(game, interaction.user.id)) return interaction.reply({ content: 'إحصائيات الروليت متاحة للمشاركين فقط.', ephemeral: true });
    return interaction.reply({ content: statsText(interaction.user, getRoulettePlayerStats(interaction.guildId, interaction.user.id)), ephemeral: true });
  }

  if (action === 'stop') {
    if (!isParticipant(game, interaction.user.id)) return interaction.reply({ content: 'فقط المشاركون يستطيعون إيقاف الروليت.', ephemeral: true });
    clearDecisionTimer(game);
    cancelRoulette(game.guildId, game.channelId);
    return interaction.reply({ content: 'تم إيقاف الروليت.', ephemeral: true });
  }

  if (game.phase !== 'decision') {
    return interaction.reply({ content: 'انتظر حتى تنتهي العجلة ويبدأ الدور.', ephemeral: true });
  }

  if (!isSelected(game, interaction.user.id)) {
    return interaction.reply({ content: 'الدور ليس لك.', ephemeral: true });
  }

  let eliminatedId = null;

  // Validate the requested action BEFORE clearing the timer.
  if (action === 'target') {
    if (!targetId || targetId === interaction.user.id) {
      return interaction.reply({ content: 'اختر شخصًا آخر من القائمة.', ephemeral: true });
    }
    if (!chooseRouletteTarget(game, targetId)) {
      return interaction.reply({ content: 'هذا الشخص لم يعد في الجولة.', ephemeral: true });
    }
    eliminatedId = targetId;
  } else if (action === 'leave') {
    removeRoulettePlayer(game, interaction.user.id);
  } else if (action === 'random') {
    const target = chooseRandomTarget(game, interaction.user.id);
    if (!target) return interaction.reply({ content: 'لا يوجد لاعب آخر يمكن إقصاؤه.', ephemeral: true });
    eliminatedId = target.id;
  } else {
    return interaction.reply({ content: 'هذا الخيار غير متاح.', ephemeral: true });
  }

  clearDecisionTimer(game);

  if (eliminatedId) recordRouletteElimination(game.guildId, eliminatedId);
  finishRouletteAction(game);

  if (game.phase === 'finished') {
    const winner = getWinner(game);
    if (winner) {
      recordRouletteWinner(game.guildId, winner.id);
      cancelRoulette(game.guildId, game.channelId);
      await interaction.reply({
        content: eliminatedId ? `تم إقصاء <@${eliminatedId}>.` : 'تم إنهاء الدور.',
        ephemeral: true,
      }).catch(() => {});
      await sendWinnerMessage(interaction.channel, winner).catch(() => {});
    }
    return;
  }

  await interaction.reply({
    content: eliminatedId ? `تم إقصاء <@${eliminatedId}>. الجولة التالية ستبدأ الآن.` : 'تم تنفيذ اختيارك. الجولة التالية ستبدأ الآن.',
    ephemeral: true,
  });

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
