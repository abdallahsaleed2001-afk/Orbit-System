import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getMines, joinMines, leaveMines, pickMine, endMines, getMinesStatus } from '../../../services/games/minesService.js';

function grid(game) {
  const buttons = [];
  for (let i = 0; i < 9; i++) {
    buttons.push(new ButtonBuilder()
      .setCustomId(`mines_cell:${game.guildId}:${game.channelId}:${i}`)
      .setLabel(game.revealed.has(i) ? '✓' : '■')
      .setStyle(game.revealed.has(i) ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(game.revealed.has(i) || !game.active));
  }
  return [0,1,2].map(r => new ActionRowBuilder().addComponents(...buttons.slice(r * 3, r * 3 + 3)));
}

function lobby(game) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mines_join:${game.guildId}:${game.channelId}`).setLabel('انضم').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mines_leave:${game.guildId}:${game.channelId}`).setLabel('خروج').setStyle(ButtonStyle.Secondary),
  )];
}

function players(game) {
  const list = getMinesStatus(game);
  return list.length ? list.map(p => `<@${p.id}>`).join(' × ') : 'لا يوجد لاعبين';
}

function activeContent(game, extra = '') {
  return `**INFINITY GAMES — لغم**\n\n${extra ? `${extra}\n\n` : ''}اللاعبون: ${players(game)}\nاختار أي لاعب مربعًا من الشبكة.\n\n**لغم واحد مخفي في كل جولة.**`;
}

async function executeMinesButton(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[0];
  const guildId = parts[1];
  const channelId = parts[2];
  const cell = parts[3] !== undefined ? Number(parts[3]) : null;
  const game = getMines(guildId, channelId);

  if (!game || !game.active) return interaction.reply({ content: 'هذه اللعبة انتهت.', ephemeral: true });
  if (interaction.guildId !== guildId || interaction.channelId !== channelId) return interaction.reply({ content: 'هذه اللعبة ليست في هذه القناة.', ephemeral: true });

  if (action === 'mines_join') {
    const result = joinMines(game, interaction.user);
    if (result.error === 'already') return interaction.reply({ content: 'أنت داخل اللعبة بالفعل.', ephemeral: true });
    if (result.error) return interaction.reply({ content: 'لا يمكنك الانضمام إلى هذه اللعبة.', ephemeral: true });
    await interaction.update({ content: activeContent(game, `@${interaction.user.username} انضم إلى اللعبة.`), components: grid(game) });
    return;
  }

  if (action === 'mines_leave') {
    const result = leaveMines(game, interaction.user.id);
    if (result.error) return interaction.reply({ content: 'أنت لست داخل اللعبة.', ephemeral: true });
    if (result.empty) {
      endMines(game);
      await interaction.update({ content: `**INFINITY GAMES — لغم**\n\n@${interaction.user.username} خرج من اللعبة.\nتم إلغاء اللعبة لعدم وجود لاعبين.`, components: [] });
      return;
    }
    await interaction.update({ content: activeContent(game, `@${interaction.user.username} خرج من اللعبة.`), components: grid(game) });
    return;
  }

  if (action === 'mines_cell') {
    if (!game.players.has(interaction.user.id)) return interaction.reply({ content: 'يجب أن تنضم إلى اللعبة أولًا.', ephemeral: true });
    if (game.revealed.has(cell)) return interaction.reply({ content: 'هذا المربع تم اختياره بالفعل.', ephemeral: true });
    const result = pickMine(game, interaction.user.id, cell);

    if (result.error === 'revealed') return interaction.reply({ content: 'هذا المربع تم اختياره بالفعل.', ephemeral: true });
    if (result.error) return interaction.reply({ content: 'تعذر تنفيذ الاختيار.', ephemeral: true });

    if (result.mine) {
      const eliminated = interaction.user.id;
      if (result.winner) {
        endMines(game);
        await interaction.update({ content: `**INFINITY GAMES — لغم**\n\n💣 تم طرد <@${eliminated}>\n\n🏆 الفائز: <@${result.winner.id}>`, components: grid(game) });
        return;
      }
      await interaction.update({ content: activeContent(game, `💣 تم طرد <@${eliminated}>`), components: grid(game) });
      return;
    }

    if (result.winner) {
      endMines(game);
      await interaction.update({ content: `**INFINITY GAMES — لغم**\n\n✅ <@${interaction.user.id}> اختار مربعًا آمنًا.\n\n🏆 الفائز: <@${result.winner.id}>`, components: grid(game) });
      return;
    }

    await interaction.update({ content: activeContent(game, `✅ <@${interaction.user.id}> اختار مربعًا آمنًا.`), components: grid(game) });
  }
}

export default ['mines_join', 'mines_leave', 'mines_cell'].map(name => ({ name, execute: executeMinesButton }));
