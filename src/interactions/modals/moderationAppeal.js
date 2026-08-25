import { EmbedBuilder } from 'discord.js';
import { createAppeal } from '../../services/moderation/appealService.js';
import { getSecurityConfig, sendSecurityLog } from '../../services/security/securityService.js';

export default {
  name: 'moderation_appeal',
  async execute(interaction, client) {
    const [, guildId, caseId, type] = interaction.customId.split(':');
    if (!guildId || guildId !== interaction.client.guilds.cache.find(g => g.id === guildId)?.id) return interaction.reply({ content: 'This appeal is no longer valid.', ephemeral: true });
    const reason = interaction.fields.getTextInputValue('reason');
    const appeal = await createAppeal({ guildId, userId: interaction.user.id, caseId, type, reason });
    const guild = interaction.client.guilds.cache.get(guildId);
    if (guild) await sendSecurityLog(client, guild, { title: '📨 Moderation Appeal', description: `**${interaction.user.tag}** submitted an appeal.`, color: 0x5865f2, fields: [
      { name: 'Case', value: `#${caseId}`, inline: true }, { name: 'Type', value: type, inline: true }, { name: 'Appeal ID', value: `#${appeal.id}`, inline: true }, { name: 'Reason', value: reason.slice(0, 1024) }
    ] });
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('Appeal Submitted').setDescription(`Your appeal **#${appeal.id}** has been submitted to the server staff.\n\nCase: **#${caseId}**`)], ephemeral: true });
  },
};
