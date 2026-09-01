import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getChairs, joinChairs, leaveChairs, startChairsRound, sitOnChair, eliminateByTimeout, removePlayer, endChairs, CHAIRS_READY_MS, CHAIRS_ROUND_MS } from '../../../services/games/chairsService.js';
import { recordGameResult } from '../../../services/games/gameStatsService.js';

const roundTimers = new Map();
const gameKey = g => `${g.guildId}:${g.channelId}`;

function clearRoundTimer(game) {
  const k = gameKey(game);
  if (game.roundTimer) { clearTimeout(game.roundTimer); game.roundTimer = null; }
  if (roundTimers.has(k)) { clearTimeout(roundTimers.get(k)); roundTimers.delete(k); }
}

function playersList(game) {
  return game.players.map(p => `<@${p.id}>`).join(' ');
}

function lobbyContent(game) {
  return `**PlayArab Games \u{1fa91} كراسي**\n\nالتسجيل مفتوح لمدة **20 ثانية**.\nوقت الدخول: <t:${game.joinEndsAt}:R>\n\nاللاعبون (**${game.players.length}**):\n${playersList(game)}`;
}

function lobbyComponents(game) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`chairs_join:${game.guildId}:${game.channelId}`).setLabel('\u{1fa91} انضم').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`chairs_leave:${game.guildId}:${game.channelId}`).setLabel('\u274c خروج').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`chairs_start:${game.guildId}:${game.channelId}`).setLabel('\u25b6\ufe0f ابدأ').setStyle(ButtonStyle.Primary).setDisabled(game.players.length < 2),
  )];
}

function buildChairComponents(game) {
  const chairsCount = game.players.length - 1;
  const takenSeats = new Set(game.seated.values());
  const rows = [];
  const perRow = Math.min(chairsCount, 5);
  const rowCount = Math.ceil(chairsCount / perRow);

  for (let r = 0; r < rowCount; r++) {
    const buttons = [];
    for (let i = r * perRow; i < Math.min((r + 1) * perRow, chairsCount); i++) {
      if (takenSeats.has(i)) {
        let sitterName = '?';
        for (const [uid, si] of game.seated) { if (si === i) { const p = game.players.find(x => x.id === uid); sitterName = p ? p.username.slice(0, 12) : '?'; break; } }
        buttons.push(new ButtonBuilder().setCustomId(`chairs_seat:${game.guildId}:${game.channelId}:${i}`).setLabel(`\u2705 ${sitterName}`).setStyle(ButtonStyle.Success).setDisabled(true));
      } else {
        buttons.push(new ButtonBuilder().setCustomId(`chairs_seat:${game.guildId}:${game.channelId}:${i}`).setLabel('\u{1fa91}').setStyle(ButtonStyle.Primary));
      }
    }
    rows.push(new ActionRowBuilder().addComponents(...buttons));
  }
  return rows;
}

function roundContent(game, extra = '') {
  const chairsCount = game.players.length - 1;
  const isFinal = game.players.length === 2;
  const title = isFinal ? '\u{1f3c6} الجولة النهائية!' : `الجولة **#${game.round}**`;
  return `**PlayArab Games \u{1fa91} كراسي**\n\n${title}\nاللاعبون: **${game.players.length}** \u{1fa91} الكراسي: **${chairsCount}**\nجلس: **${game.seated.size}** / **${chairsCount}**${extra ? `\n\n${extra}` : ''}`;
}

export async function startRound(channel, game) {
  if (game.players.length < 2) return finishGame(channel, game);

  game.seated.clear();
  const result = startChairsRound(game);
  if (!result.ok) return finishGame(channel, game);

  const isFinal = game.players.length === 2;

  // Ready phase (2 seconds)
  game.phase = 'ready';
  const readyText = `**PlayArab Games \u{1fa91} كراسي**\n\n${isFinal ? '\u{1f3c6} الجولة النهائية!' : `الجولة **#${game.round}**`}\nاللاعبون: **${game.players.length}** \u{1fa91} الكراسي: **${result.chairsCount}**\n\n\u23f3 استعدوا...`;

  await channel.send({ content: readyText }).catch(() => {});

  // After ready, show chairs
  setTimeout(async () => {
    if (!game.active) return;
    game.phase = 'playing';

    const msg = await channel.send({
      content: roundContent(game),
      components: buildChairComponents(game),
    }).catch(() => null);

    if (msg) game.messageId = msg.id;

    // Round timer (15 seconds)
    const k = gameKey(game);
    clearRoundTimer(game);
    const timer = setTimeout(async () => {
      roundTimers.delete(k);
      if (!game.active || game.phase !== 'playing') return;

      // Timeout - eliminate someone who didn't sit
      if (game.seated.size < result.chairsCount) {
        const { eliminated } = eliminateByTimeout(game);
        if (eliminated) {
          game.eliminated.push(eliminated);
          removePlayer(game, eliminated.id);
          await channel.send({ content: `\u23f0 انتهى الوقت! <@${eliminated.id}> لم يجد كرسي وتم طرده.`, components: [] }).catch(() => {});
        }
      }

      // Next round or finish
      if (game.players.length <= 1) {
        return finishGame(channel, game);
      }

      // Small delay then next round
      setTimeout(() => startRound(channel, game), 2000);
    }, CHAIRS_ROUND_MS);

    game.roundTimer = timer;
    roundTimers.set(k, timer);
  }, CHAIRS_READY_MS);
}

async function finishGame(channel, game) {
  game.active = false;
  game.phase = 'ended';
  clearRoundTimer(game);
  if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }

  const winner = game.players[0];
  const loserIds = game.eliminated.map(p => p.id);

  if (winner) {
    await channel.send({
      content: `**PlayArab Games \u{1fa91} كراسي**\n\n\u{1f3c6} الفائز: <@${winner.id}>!\n\nالجولات: **${game.round}** | اللاعبون: **${game.players.length + game.eliminated.length}**`,
      components: [],
    }).catch(() => {});
    await recordGameResult(game.guildId, 'chairs', [winner.id], loserIds);
  } else {
    await channel.send({ content: '**PlayArab Games \u{1fa91} كراسي**\n\n\u274c انتهت اللعبة بدون فائز.', components: [] }).catch(() => {});
  }

  endChairs(game);
}

// Update the game message with current state
async function updateGameMessage(game, content, components) {
  const channel = game.client?.channels?.cache?.get(game.channelId);
  if (!channel) return;
  const msg = channel.messages.cache.get(game.messageId);
  if (!msg) return;
  await msg.edit({ content, components }).catch(() => {});
}

async function handleButton(interaction, client) {
  const parts = interaction.customId.split(':');
  const action = parts[0];
  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  const game = getChairs(guildId, channelId);

  if (!game || !game.active) return interaction.reply({ content: 'هذه اللعبة انتهت.', ephemeral: true });
  game.client = client;

  // JOIN
  if (action === 'chairs_join') {
    if (game.phase !== 'join') return interaction.reply({ content: 'انتهى وقت الدخول.', ephemeral: true });
    const result = joinChairs(game, interaction.user);
    if (result.error === 'already') return interaction.reply({ content: 'أنت داخل اللعبة بالفعل.', ephemeral: true });
    if (result.error === 'full') return interaction.reply({ content: 'وصلت اللعبة للحد الأقصى (20 لاعب).', ephemeral: true });
    return interaction.update({ content: lobbyContent(game), components: lobbyComponents(game) });
  }

  // LEAVE
  if (action === 'chairs_leave') {
    const result = leaveChairs(game, interaction.user.id);
    if (result.error) return interaction.reply({ content: 'أنت لست داخل اللعبة.', ephemeral: true });
    if (result.empty) {
      endChairs(game);
      return interaction.update({ content: '**PlayArab Games \u{1fa91} كراسي**\n\n\u274c تم إلغاء اللعبة لعدم وجود لاعبين.', components: [] });
    }
    if (game.phase === 'join') {
      return interaction.update({ content: lobbyContent(game), components: lobbyComponents(game) });
    }
    // Left during a round
    game.eliminated.push({ id: interaction.user.id, username: interaction.user.username });
    clearRoundTimer(game);
    await interaction.update({ content: `\u{1f4aa} <@${interaction.user.id}> خرج من اللعبة.`, components: [] }).catch(() => {});
    if (game.players.length <= 1) return finishGame(interaction.channel, game);
    setTimeout(() => startRound(interaction.channel, game), 1500);
    return;
  }

  // START (manual start by any player)
  if (action === 'chairs_start') {
    if (game.phase !== 'join') return interaction.reply({ content: 'اللعبة بدأت بالفعل.', ephemeral: true });
    if (game.players.length < 2) return interaction.reply({ content: 'يجب أن يشارك شخصان على الأقل.', ephemeral: true });
    if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }
    await interaction.update({ content: `**PlayArab Games \u{1fa91} كراسي**\n\n\u25b6\ufe0f بدأت اللعبة!`, components: [] }).catch(() => {});
    return startRound(interaction.channel, game);
  }

  // SIT ON CHAIR
  if (action === 'chairs_seat') {
    if (game.phase !== 'playing') return interaction.reply({ content: 'الجولة لم تبدأ بعد.', ephemeral: true });
    const seatIndex = Number(parts[3]);
    const result = sitOnChair(game, interaction.user.id, seatIndex);
    if (result.error === 'already_seated') return interaction.reply({ content: 'أنت جالس بالفعل!', ephemeral: true });
    if (result.error === 'not_player') return interaction.reply({ content: 'أنت لست داخل اللعبة.', ephemeral: true });
    if (result.error === 'seat_taken') return interaction.reply({ content: 'هذا الكرسي محجوز!', ephemeral: true });

    // Player sat successfully
    if (result.winner) {
      // 2 players, 1 chair - first to sit wins!
      clearRoundTimer(game);
      game.eliminated.push(game.players.find(p => p.id !== result.winner.id));
      game.players = [result.winner];
      return finishGame(interaction.channel, game);
    }

    if (result.eliminated) {
      // All chairs taken - last player eliminated
      clearRoundTimer(game);
      const elim = result.eliminated;
      game.eliminated.push(elim);
      removePlayer(game, elim.id);

      await interaction.update({
        content: roundContent(game, `\u{1f4aa} <@${elim.id}> لم يجد كرسي وتم طرده!`),
        components: buildChairComponents(game),
      }).catch(() => {});

      // Disable all remaining buttons
      const msg = interaction.message;
      if (msg) {
        setTimeout(async () => {
          await msg.edit({ components: [] }).catch(() => {});
          if (game.players.length <= 1) return finishGame(interaction.channel, game);
          setTimeout(() => startRound(interaction.channel, game), 2000);
        }, 1500);
      }
      return;
    }

    // Normal sit - update message
    await interaction.update({
      content: roundContent(game, `\u2705 <@${interaction.user.id}> جلس على كرسي!`),
      components: buildChairComponents(game),
    }).catch(() => {});
    return;
  }
}

export default ['chairs_join', 'chairs_leave', 'chairs_start', 'chairs_seat'].map(name => ({ name, execute: handleButton }));
