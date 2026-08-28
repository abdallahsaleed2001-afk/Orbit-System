import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createMines, MINES_JOIN_MS } from '../../services/games/minesService.js';

const joinRow = game => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`mines_join:${game.guildId}:${game.channelId}`).setLabel('انضم').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId(`mines_leave:${game.guildId}:${game.channelId}`).setLabel('خروج').setStyle(ButtonStyle.Secondary),
);

export default {
  data: new SlashCommandBuilder().setName('mines').setDescription('Start a multiplayer Mines game'),
  category: 'Fun',
  async execute(interaction) {
    const result = createMines(interaction.guildId, interaction.channelId, interaction.user);
    if (result.error === 'active') return interaction.reply({ content: 'توجد لعبة لغم نشطة بالفعل في هذه القناة.', ephemeral: true });
    const game = result.game;
    const message = await interaction.reply({
      content: `**INFINITY GAMES — لغم**\n\nالتسجيل مفتوح الآن لمدة **60 ثانية**.\nوقت الدخول: <t:${game.joinEndsAt}:R>\n\nاللاعبون (**${game.players.length}**):\n<@${interaction.user.id}>`,
      components: [joinRow(game)],
      fetchReply: true,
    });
    game.messageId = message.id;
    game.joinTimer = setTimeout(async () => {
      if (!game.active || game.phase !== 'join') return;
      if (game.players.length < 2) {
        game.active = false;
        game.phase = 'finished';
        const { endMines } = await import('../../services/games/minesService.js');
        endMines(game);
        await interaction.channel.send('انتهى وقت التسجيل — يجب أن يشارك شخصان على الأقل لبدء لعبة لغم.');
        await message.edit({ components: [] }).catch(() => {});
        return;
      }
      const { startMines } = await import('../../services/games/minesService.js');
      const started = startMines(game);
      if (!started.ok) return;
      await message.edit({ content: `**INFINITY GAMES — لغم**\n\nانتهى وقت الدخول.\nبدأت الجولة **#${game.round}**.\n\nدور: <@${started.player.id}>`, components: [] }).catch(() => {});
      await interaction.channel.send({ content: `**لغم — الجولة #${game.round}**\n\nدور <@${started.player.id}> — لديك **30 ثانية** لاختيار مربع.`, components: [] });
    }, MINES_JOIN_MS);
  },
};
