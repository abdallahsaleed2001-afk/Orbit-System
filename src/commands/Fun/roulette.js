import { SlashCommandBuilder } from 'discord.js';
import { createRoulette } from '../../services/games/rouletteService.js';
import { sendJoinMessage } from '../../interactions/buttons/roulette/roulette.js';

async function runRoulette(interaction) {
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

  const message = await interaction.channel.send({
    content: 'جاري تجهيز الروليت...',
  });

  await sendJoinMessage(message, result.game);
}

export default {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Start a roulette game'),
  category: 'Fun',
  prefixOnly: true,
  async execute(interaction) {
    return runRoulette(interaction);
  },
  async prefixExecute(interaction) {
    return runRoulette(interaction);
  },
};
