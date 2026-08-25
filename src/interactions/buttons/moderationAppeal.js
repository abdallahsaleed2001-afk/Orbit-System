import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export default [
  {
    name: 'moderation_appeal',
    async execute(interaction, client, args) {
      const [guildId, caseId, type] = args;
      if (!guildId || !caseId || !type) return interaction.reply({ content: 'This appeal link is invalid.', ephemeral: true });
      if (interaction.user.id === client.user.id) return interaction.reply({ content: 'Invalid appeal.', ephemeral: true });
      return interaction.showModal(new ModalBuilder().setCustomId(`moderation_appeal:${guildId}:${caseId}:${type}`).setTitle('Moderation Appeal').addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Why should this punishment be appealed?').setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(1000).setRequired(true))
      ));
    },
  },
];
