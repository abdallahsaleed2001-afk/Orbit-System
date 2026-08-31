import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

const GAMES_ROLE_ID = '1543774154279354398';

function hasGamesRole(interaction) {
  return interaction.member?.roles?.cache?.has(GAMES_ROLE_ID)
    || interaction.member?.roles?.includes?.(GAMES_ROLE_ID);
}

export default {
  name: 'games_menu',
  async execute(interaction, client) {
    if (!hasGamesRole(interaction)) {
      return interaction.reply({ content: 'ليس لديك صلاحية استخدام ألعاب البوت.', ephemeral: true });
    }

    const gameName = interaction.values?.[0];
    const command = client.gameCommands?.get(gameName);
    if (!command) {
      return interaction.reply({ content: 'هذه اللعبة غير متاحة حاليًا.', ephemeral: true });
    }

    // Fight is the only current game that requires an opponent option.
    // Collect that option here without changing the existing fight logic.
    if (gameName === 'fight') {
      const modal = new ModalBuilder()
        .setCustomId('games_fight_modal')
        .setTitle('⚔️ اختيار الخصم');

      const opponent = new TextInputBuilder()
        .setCustomId('opponent')
        .setLabel('منشن الخصم أو أدخل الـ ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('@user أو 123456789012345678')
        .setRequired(true)
        .setMaxLength(100);

      modal.addComponents(new ActionRowBuilder().addComponents(opponent));
      return interaction.showModal(modal);
    }

    return command.execute(interaction, null, client);
  },
};
