import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { getSecurityConfig } from '../../services/security/securityService.js';

const BUTTONS = [
  ['security_panel_nuke', 'Anti-Nuke'],
  ['security_panel_raid', 'Anti-Raid'],
  ['security_panel_automod', 'AutoMod'],
  ['security_panel_punishments', 'Punishments'],
  ['security_panel_whitelist', 'Whitelist'],
  ['security_panel_logs', 'Logs'],
  ['security_panel_settings', 'Settings'],
];

function dashboard(config, guild) {
  return new EmbedBuilder()
    .setTitle('🛡️ Infinity Security Dashboard')
    .setDescription(`Security control center for **${guild.name}**. All settings are stored persistently.`)
    .setColor(0x5865F2)
    .addFields(
      { name: '🛡️ Anti-Nuke', value: config.antiNuke.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
      { name: '🚨 Anti-Raid', value: config.antiRaid.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
      { name: '🤖 AutoMod', value: config.autoMod.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
      { name: '⚡ Punishments', value: `${config.escalation.length} escalation levels`, inline: true },
      { name: '👤 Whitelist', value: `${config.whitelist.users.length} users / ${config.whitelist.roles.length} roles / ${config.whitelist.bots.length} bots`, inline: true },
      { name: '📋 Logs', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not configured', inline: true },
      { name: '⏱️ Strike Decay', value: `${Math.round((config.strikeDecayMs || 86400000) / 3600000)}h`, inline: true },
      { name: '🔒 Global Security', value: config.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
    )
    .setFooter({ text: 'Only the moderator who opened this panel can use its controls.' });
}

function controls(userId) {
  const rows = [];
  for (let i = 0; i < BUTTONS.length; i += 4) {
    rows.push(
      new ActionRowBuilder().addComponents(
        ...BUTTONS.slice(i, i + 4).map(([id, label]) =>
          new ButtonBuilder()
            .setCustomId(`${id}:${userId}`)
            .setLabel(label)
            .setStyle(
              label === 'Punishments'
                ? ButtonStyle.Danger
                : label === 'Settings'
                  ? ButtonStyle.Secondary
                  : ButtonStyle.Primary,
            ),
        ),
      ),
    );
  }
  return rows;
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
      return interaction.reply({
        content: 'You need Manage Server permission.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const security = await getSecurityConfig(client, interaction.guildId);

    await interaction.reply({
      embeds: [dashboard(security, interaction.guild)],
      components: controls(interaction.user.id),
      flags: MessageFlags.Ephemeral,
    });
  },
};
