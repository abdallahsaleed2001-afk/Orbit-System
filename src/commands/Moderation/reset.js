import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { WarningService } from '../../services/moderation/warningService.js';
import { clearStrikes } from '../../services/security/securityService.js';

export default {
  data: new SlashCommandBuilder().setName('reset').setDescription('Reset moderation counters without deleting the audit history.')
    .addUserOption(o => o.setName('user').setDescription('Member to reset').setRequired(true))
    .addStringOption(o => o.setName('type').setDescription('What to reset').setRequired(true).addChoices(
      { name: 'Warnings', value: 'warnings' }, { name: 'Security Strikes', value: 'strikes' }, { name: 'Warnings + Strikes', value: 'all' }
    )).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  category: 'moderation',
  async execute(interaction, config, client) {
    const user = interaction.options.getUser('user'); const type = interaction.options.getString('type'); const results = [];
    if (type === 'warnings' || type === 'all') { const result = await WarningService.clearWarnings(interaction.guildId, user.id); results.push(`Warnings reset: **${result.count}**`); }
    if (type === 'strikes' || type === 'all') { await clearStrikes(client, interaction.guildId, user.id); results.push('Security strikes reset: **0**'); }
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🧹 Moderation Reset').setDescription(`Reset completed for <@${user.id}>.\n\n${results.join('\n')}\n\n**Moderation logs and historical cases were not deleted.**`)], ephemeral: true });
  },
};
