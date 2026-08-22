import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getSecurityConfig } from '../../services/security/securityService.js';

function dashboard(config) {
  return new EmbedBuilder()
    .setTitle('🛡️ Infinity Security Dashboard')
    .setDescription('Use the buttons below to enable/disable protection and manage security settings.')
    .setColor(0x5865F2)
    .addFields(
      { name: '🛡️ Anti-Nuke', value: config.antiNuke.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
      { name: '🚨 Anti-Raid', value: config.antiRaid.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
      { name: '🤖 AutoMod', value: config.autoMod.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
      { name: '⚡ Escalation', value: `${config.escalation.length} strike levels`, inline: true },
      { name: '👤 Whitelist', value: `${config.whitelist.users.length} users / ${config.whitelist.roles.length} roles`, inline: true },
      { name: '📋 Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not configured', inline: true },
    )
    .setFooter({ text: 'Infinity Security • ManageGuild required' });
}

export default {
  category: 'Security',
  slashOnly: true,
  data: new SlashCommandBuilder()
    .setName('security')
    .setDescription('Open the server security dashboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild.toString()),
  async execute(interaction, config, client) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
    }

    const security = await getSecurityConfig(client, interaction.guildId);
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`security_toggle:nuke:${interaction.user.id}`).setLabel('Anti-Nuke').setStyle(security.antiNuke.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`security_toggle:raid:${interaction.user.id}`).setLabel('Anti-Raid').setStyle(security.antiRaid.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`security_toggle:automod:${interaction.user.id}`).setLabel('AutoMod').setStyle(security.autoMod.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`security_refresh:${interaction.user.id}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`security_whitelist:${interaction.user.id}`).setLabel('Whitelist').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`security_logging:${interaction.user.id}`).setLabel('Logging').setStyle(ButtonStyle.Primary),
    );

    await interaction.reply({ embeds: [dashboard(security)], components: [row1, row2], ephemeral: true });
  },
};
