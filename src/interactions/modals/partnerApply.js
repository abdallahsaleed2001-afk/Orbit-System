import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export default {
  name: 'partner_apply_modal',
  async execute(interaction) {
    const server = interaction.fields.getTextInputValue('server_name');
    const invite = interaction.fields.getTextInputValue('invite');
    const members = interaction.fields.getTextInputValue('members');
    const description = interaction.fields.getTextInputValue('description');
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🤝 Partnership Request')
      .addFields(
        { name: 'Server', value: server },
        { name: 'Members', value: members },
        { name: 'Invite', value: invite },
        { name: 'Applicant', value: `${interaction.user}` },
        { name: 'Description', value: description },
      )
      .setFooter({ text: 'Status: Pending' });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('partner_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('partner_reject').setLabel('Reject').setStyle(ButtonStyle.Danger),
    );
    const target = interaction.guild.channels.cache.find(c => c.isTextBased() && c.name === 'partnership-requests');
    if (!target) return interaction.reply({ content: 'The partnership request channel is not configured. Ask an administrator to run `/partner setup` again.', ephemeral: true });
    await target.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: 'Your partnership request has been submitted.', ephemeral: true });
  },
};
