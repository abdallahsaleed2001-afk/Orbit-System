import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createMines, MINES_JOIN_MS, startMines, endMines } from '../../services/games/minesService.js';
import { grid, startMinesTurnTimer } from '../../interactions/buttons/mines/mines.js';

const lobbyRows = game => [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`mines_join:${game.guildId}:${game.channelId}`).setLabel('انضم').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId(`mines_leave:${game.guildId}:${game.channelId}`).setLabel('خروج').setStyle(ButtonStyle.Secondary),
)];

export default {
  data: new SlashCommandBuilder().setName('mines').setDescription('Start a multiplayer Mines game'),
  category: 'Fun',
  async execute(interaction) {
    const result = createMines(interaction.guildId, interaction.channelId, interaction.user);
    if (result.error === 'active') return interaction.reply({ content: 'توجد لعبة لغم نشطة بالفعل في هذه القناة.', ephemeral: true });
    const game = result.game;
    const message = await interaction.reply({
      content: `**INFINITY GAMES — لغم**\n\nالتسجيل مفتوح لمدة **60 ثانية**.\nوقت الدخول: <t:${game.joinEndsAt}:R>\n\nاللاعبون (**1**):\n<@${interaction.user.id}>`,
      components: lobbyRows(game),
      fetchReply: true,
    });
    game.messageId = message.id;
    game.joinTimer = setTimeout(async () => {
      if (!game.active || game.phase !== 'join') return;
      if (game.players.length < 2) {
        await message.edit({ content: '**INFINITY GAMES — لغم**\n\nانتهى وقت التسجيل — يجب أن يشارك شخصان على الأقل.', components: [] }).catch(() => {});
        endMines(game);
        return;
      }
      const started = startMines(game);
      if (!started.ok) return;
      await message.edit({ content: `**INFINITY GAMES — لغم**\n\nانتهى وقت الدخول. بدأت الجولة **#${game.round}**.\n\nدور: <@${started.player.id}>\nلغم واحد مخفي في هذه الجولة. لديك **30 ثانية**.`, components: grid(game) }).catch(() => {});
      game.currentMessageId = message.id;
      startMinesTurnTimer(interaction.channel, game);
    }, MINES_JOIN_MS);
  },
};
