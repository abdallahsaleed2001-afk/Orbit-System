import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const ids = new Set(['partner_apply','partner_requirements','partner_accept','partner_reject']);

export default {
  name: 'partner',
  ids,
  async execute(interaction) {
    const id = interaction.customId;
    if (id === 'partner_apply') {
      const modal = new ModalBuilder().setCustomId('partner_apply_modal').setTitle('Partnership Request');
      const server = new TextInputBuilder().setCustomId('server_name').setLabel('Server name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
      const invite = new TextInputBuilder().setCustomId('invite').setLabel('Invite link').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200);
      const members = new TextInputBuilder().setCustomId('members').setLabel('Member count').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10);
      const description = new TextInputBuilder().setCustomId('description').setLabel('Server description').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
      modal.addComponents(...[server, invite, members, description].map(x => new ActionRowBuilder().addComponents(x)));
      return interaction.showModal(modal);
    }
    if (id === 'partner_requirements') return interaction.reply({ content: 'Partnership requirements: active community, valid invite, no recent serious violations, and the server must meet the configured member/activity requirements.', ephemeral: true });
    if (id === 'partner_accept' || id === 'partner_reject') {
      if (!interaction.memberPermissions?.has('ManageGuild')) return interaction.reply({ content: 'You do not have permission to manage partnerships.', ephemeral: true });
      const accepted = id === 'partner_accept';
      const embed = EmbedBuilder.from(interaction.message.embeds[0] || new EmbedBuilder()).setColor(accepted ? 0x57f287 : 0xed4245).addFields({ name: 'Status', value: accepted ? '🟢 Accepted' : '🔴 Rejected' }, { name: 'Reviewed by', value: `${interaction.user}` });
      return interaction.update({ embeds: [embed], components: [] });
    }
  },
};
