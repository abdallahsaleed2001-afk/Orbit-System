import { SlashCommandBuilder } from 'discord.js';
import { createRoulette } from '../../services/games/rouletteService.js';
import { sendJoinMessage } from '../../interactions/buttons/roulette/roulette.js';

export default {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Start a roulette game'),
  category: 'Fun',
  prefixOnly: true,

  async prefixExecute(interaction) {
    const result = createRoulette(
      interaction.guildId,
      interaction.channel.id,
      interaction.user,
    );

    if (result.error === 'active') {
      await interaction.channel.send({
        content: 'توجد جولة روليت نشطة بالفعل في هذه القناة.',
      });
      return;
    }

    // Prefix commands use a mock interaction, so create a real Discord
    // message first and let the roulette UI edit that message.
    const message = await interaction.channel.send({
      content: 'جاري تجهيز الروليت...',
    });

    await sendJoinMessage(message, result.game);
  },
};
