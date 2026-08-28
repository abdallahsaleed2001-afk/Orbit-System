import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getMines, joinMines, leaveMines, pickMinesCell, eliminateCurrentForTimeout, endMines, isPlayer, currentPlayer, MINES_TURN_MS } from '../../../services/games/minesService.js';

const timers = new Map();
const key = game => `${game.guildId}:${game.channelId}`;
const clearTimer = game => { const k = key(game); const t = timers.get(k); if (t) clearTimeout(t); timers.delete(k); };

export function grid(game) {
  const buttons = [];
  for (let i = 0; i < 9; i++) {
    const revealed = game.revealed.has(i);
    buttons.push(new ButtonBuilder()
      .setCustomId(`mines_cell:${game.guildId}:${game.channelId}:${i}`)
      .setLabel(revealed ? '✓' : '■')
      .setStyle(revealed ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(revealed || !game.active));
  }
  return [0, 1, 2].map(r => new ActionRowBuilder().addComponents(...buttons.slice(r * 3, r * 3 + 3)));
}

function players(game) {
  return game.players.length ? game.players.map(p => `<@${p.id}>`).join(' × ') : 'لا يوجد لاعبين';
}

function content(game, extra = '') {
  const turn = currentPlayer(game);
  return `**INFINITY GAMES — لغم**\n\n${extra ? `${extra}\n\n` : ''}اللاعبون: ${players(game)}\n\nالجولة: **#${game.round}**\nدور: ${turn ? `<@${turn.id}>` : '—'}\nلغم واحد مخفي في هذه الجولة.\nلديك **10 ثوانٍ** للتفاعل.`;
}

function lobbyComponents(game) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mines_join:${game.guildId}:${game.channelId}`).setLabel('انضم').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mines_leave:${game.guildId}:${game.channelId}`).setLabel('خروج').setStyle(ButtonStyle.Secondary),
  )];
}

async function startTurnTimer(channel, game) {
  clearTimer(game);
  const k = key(game);
  timers.set(k, setTimeout(async () => {
    timers.delete(k);
    if (!game.active || game.phase !== 'turn') return;
    const result = eliminateCurrentForTimeout(game);
    if (!result) return;
    if (result.finished) {
      await channel.send({ content: `**INFINITY GAMES — لغم**\n\n⏱️ تم طرد <@${result.eliminated.id}> لعدم التفاعل.\n\n🏆 الفائز: <@${result.winner.id}>` }).catch(() => {});
      endMines(game);
      return;
    }
    await channel.send({ content: content(game, `⏱️ تم طرد <@${result.eliminated.id}> لعدم التفاعل.`), components: grid(game) }).then(m => { game.currentMessageId = m.id; }).catch(() => {});
    startTurnTimer(channel, game);
  }, MINES_TURN_MS));
}

export function startMinesTurnTimer(channel, game) {
  return startTurnTimer(channel, game);
}

async function executeMinesButton(interaction, client, args = []) {
  const [guildIdFromArgs, channelIdFromArgs, cellFromArgs] = Array.isArray(args) ? args : [];
  const parts = interaction.customId.split(':');
  const action = parts[0];
  const guildId = guildIdFromArgs || parts[1];
  const channelId = channelIdFromArgs || parts[2];
  const cell = cellFromArgs !== undefined ? Number(cellFromArgs) : (parts[3] === undefined ? null : Number(parts[3]));

  const game = getMines(guildId, channelId);
  if (!game || !game.active) return interaction.reply({ content: 'هذه اللعبة انتهت.', ephemeral: true });
  if (interaction.guildId !== guildId || interaction.channelId !== channelId) return interaction.reply({ content: 'هذه اللعبة ليست في هذه القناة.', ephemeral: true });

  if (action === 'mines_join') {
    if (game.phase !== 'join') return interaction.reply({ content: 'انتهى وقت الدخول.', ephemeral: true });
    const result = joinMines(game, interaction.user);
    if (result.error === 'already') return interaction.reply({ content: 'أنت داخل اللعبة بالفعل.', ephemeral: true });
    if (result.error === 'full') return interaction.reply({ content: 'وصلت اللعبة للحد الأقصى من اللاعبين.', ephemeral: true });
    if (result.error) return interaction.reply({ content: 'لا يمكنك الانضمام الآن.', ephemeral: true });
    await interaction.update({
      content: `**INFINITY GAMES — لغم**\n\nالتسجيل مفتوح.\nاللاعبون (**${game.players.length}**): ${players(game)}\n\nوقت الدخول: <t:${game.joinEndsAt}:R>`,
      components: lobbyComponents(game),
    });
    return;
  }

  if (action === 'mines_leave') {
    const result = leaveMines(game, interaction.user.id);
    if (result.error) return interaction.reply({ content: 'أنت لست داخل اللعبة.', ephemeral: true });
    if (game.phase === 'join') {
      if (result.empty) {
        endMines(game);
        return interaction.update({ content: 'تم إلغاء اللعبة لعدم وجود لاعبين.', components: [] });
      }
      return interaction.update({
        content: `**INFINITY GAMES — لغم**\n\n${interaction.user} خرج من التسجيل.\nاللاعبون (**${game.players.length}**): ${players(game)}\n\nوقت الدخول: <t:${game.joinEndsAt}:R>`,
        components: lobbyComponents(game),
      });
    }
    clearTimer(game);
    if (game.players.length <= 1) {
      const winner = game.players[0];
      endMines(game);
      return interaction.update({ content: `**INFINITY GAMES — لغم**\n\n${interaction.user} خرج من اللعبة.\n\n🏆 الفائز: ${winner ? `<@${winner.id}>` : 'لا يوجد'}`, components: [] });
    }
    await interaction.update({ content: content(game, `${interaction.user} خرج من اللعبة.`), components: grid(game) });
    startTurnTimer(interaction.channel, game);
    return;
  }

  if (action === 'mines_cell') {
    if (!isPlayer(game, interaction.user.id)) return interaction.reply({ content: 'أنت لست داخل اللعبة.', ephemeral: true });
    const result = pickMinesCell(game, interaction.user.id, cell);
    if (result.error === 'not_turn') return interaction.reply({ content: `ليس دورك. الدور على ${currentPlayer(game) ? `<@${currentPlayer(game).id}>` : 'لاعب آخر'}.`, ephemeral: true });
    if (result.error === 'revealed') return interaction.reply({ content: 'هذا المربع تم اختياره بالفعل.', ephemeral: true });
    if (result.error) return interaction.reply({ content: 'تعذر تنفيذ الاختيار.', ephemeral: true });
    clearTimer(game);

    if (result.mine) {
      if (result.finished) {
        endMines(game);
        return interaction.update({ content: `**INFINITY GAMES — لغم**\n\n💣 تم طرد <@${result.eliminated.id}>\n\n🏆 الفائز: <@${result.winner.id}>`, components: [] });
      }
      await interaction.update({ content: content(game, `💣 تم طرد <@${result.eliminated.id}> — بدأت الجولة **#${game.round}**.`), components: grid(game) });
      startTurnTimer(interaction.channel, game);
      return;
    }

    await interaction.update({ content: content(game, `✅ <@${result.player.id}> اختار مربعًا آمنًا.`), components: grid(game) });
    startTurnTimer(interaction.channel, game);
  }
}

export default ['mines_join', 'mines_leave', 'mines_cell'].map(name => ({ name, execute: executeMinesButton }));
