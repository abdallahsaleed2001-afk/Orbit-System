import { SlashCommandBuilder } from 'discord.js';
import { startFlags, handleFlagsMessage } from '../../services/games/flagsService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('flags')
    .setDescription('خمن اسم الدولة من العلم'),
  category: 'Fun',
  prefixOnly: true,
  gameMenu: {
    label: 'أعلام',
    description: 'خمن اسم الدولة من العلم قبل الجميع.',
  },
  async execute(interaction) {
    const game = startFlags(interaction.guildId, interaction.channel.id);
    if (game.error === 'active') return interaction.reply({ content: '⚠️ توجد جولة أعلام نشطة بالفعل في هذه القناة.' });

    await interaction.reply({ content: game.prompt });

    const collector = interaction.channel.createMessageCollector({ time: 20_000 });
    collector.on('collect', async message => {
      try {
        const handled = await handleFlagsMessage(message);
        if (handled) collector.stop('winner');
      } catch {}
    });
  },
};
