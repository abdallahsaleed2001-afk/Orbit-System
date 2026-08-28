import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createMines } from '../../services/games/minesService.js';

function rows(game) {
  const buttons = [];
  for (let i = 0; i < 9; i++) {
    buttons.push(new ButtonBuilder().setCustomId(`mines_cell:${game.guildId}:${game.channelId}:${i}`).setLabel('■').setStyle(ButtonStyle.Secondary));
  }
  return [0,1,2].map(r => new ActionRowBuilder().addComponents(...buttons.slice(r * 3, r * 3 + 3)));
}

export default {
  data: new SlashCommandBuilder().setName('mines').setDescription('Start a multiplayer Mines game'),
  category: 'Fun',
  async execute(interaction) {
    const result = createMines(interaction.guildId, interaction.channelId, interaction.user);
    if (result.error === 'active') return interaction.reply({ content: 'توجد لعبة لغم نشطة بالفعل في هذه القناة.', ephemeral: true });
    const game = result.game;
    const message = await interaction.reply({
      content: `**INFINITY GAMES — لغم**\n\n@${interaction.user.username} بدأ اللعبة.\nاضغط انضم للدخول، أو اختار مربعًا بعد الانضمام.\n\nاللاعبون: <@${interaction.user.id}>`,
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`mines_join:${game.guildId}:${game.channelId}`).setLabel('انضم').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`mines_leave:${game.guildId}:${game.channelId}`).setLabel('خروج').setStyle(ButtonStyle.Secondary))],
    });
    game.messageId = message.id;
    game.gridMessage = null;
  },
};

export { rows };