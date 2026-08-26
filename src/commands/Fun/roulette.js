import { SlashCommandBuilder } from 'discord.js';
import { createRoulette } from '../../services/games/rouletteService.js';
import { sendJoinMessage } from '../../interactions/buttons/roulette/roulette.js';

export default {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Start a roulette game'),
  category: 'Fun',
  prefixOnly: true,
  async execute(interaction) {
    const result = createRoulette(
      interaction.guildId,
      interaction.channel.id,
      interaction.user,
    );

    if (result.error === 'active') {
      return interaction.reply({ content: 'توجد جولة روليت نشطة بالفعل في هذه القناة.' });
    }

    await interaction.reply({ content: 'جاري تجهيز الروليت...' });
    const message = await interaction.fetchReply();
    await sendJoinMessage(message, result.game);
  },
};
