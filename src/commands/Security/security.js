import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { getSecurityConfig } from '../../services/security/securityService.js';

const BUTTONS = [
  ['security_panel_nuke', '🛡️ Anti-Nuke'],
  ['security_panel_raid', '🚨 Anti-Raid'],
  ['security_panel_automod', '🤖 AutoMod'],
  ['security_panel_punishments', '⚖️ Punishments'],
  ['security_panel_whitelist', '👤 Whitelist'],
  ['security_panel_logs', '📋 Logs'],
  ['security_panel_settings', '⚙️ Settings'],
];

function status(enabled) {
  return enabled ? '🟢 **ACTIVE**' : '🔴 **OFF**';
}

export function buildSecurityDashboard(config, guild) {
  const systems = [config.antiNuke?.enabled, config.antiRaid?.enabled, config.autoMod?.enabled, config.enabled];
  const active = systems.filter(Boolean).length;
  const score = Math.round((active / systems.length) * 100);
  const scoreLabel = score >= 100 ? '🟢 Maximum' : score >= 75 ? '🟡 Strong' : score >= 50 ? '🟠 Partial' : '🔴 Weak';
  const whitelistCount = (config.whitelist?.users?.length || 0) + (config.whitelist?.roles?.length || 0) + (config.whitelist?.bots?.length || 0);
  const logValue = config.logChannelId ? `<#${config.logChannelId}>` : '`Not configured`';

  return new EmbedBuilder()
    .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle('🛡️ Server Protection')
    .setDescription([`**${guild.name}**`, 'A centralized control center for your server security.', '', `Security health: **${score}%** ${scoreLabel}`].join('\n'))
    .setColor(score >= 100 ? 0x57F287 : score >= 75 ? 0xFEE75C : score >= 50 ? 0xF47B67 : 0xED4245)
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .addFields(
      { name: '━━ Core Protection ━━', value: [`🛡️ Anti-Nuke  ${status(config.antiNuke?.enabled)}`, `🚨 Anti-Raid  ${status(config.antiRaid?.enabled)}`, `🤖 AutoMod    ${status(config.autoMod?.enabled)}`, `🔒 Global     ${status(config.enabled)}`].join('\n') },
      { name: '━━ Protection Stats ━━', value: [`⚡ **${config.escalation?.length || 0}** punishment levels`, `👤 **${whitelistCount}** whitelist entries`, `⏱️ **${Math.round((config.strikeDecayMs || 86400000) / 3600000)}h** strike decay`, `📋 Logs: ${logValue}`].join('\n') },
      { name: '━━ Current Mode ━━', value: config.enabled ? '🟢 **PROTECTED** — Security systems are monitoring the server.' : '🔴 **DISABLED** — Global security protection is currently off.' },
    )
    .setFooter({ text: 'Infinity System • Security Center • Changes are saved automatically' })
    .setTimestamp();
}

export function buildSecurityControls(userId) {
  return [
    new ActionRowBuilder().addComponents(
      ...BUTTONS.slice(0, 4).map(([id, label], index) => new ButtonBuilder().setCustomId(`${id}:${userId}`).setLabel(label).setStyle(index === 0 ? ButtonStyle.Danger : ButtonStyle.Primary)),
    ),
    new ActionRowBuilder().addComponents(
      ...BUTTONS.slice(4).map(([id, label]) => new ButtonBuilder().setCustomId(`${id}:${userId}`).setLabel(label).setStyle(label.includes('Settings') ? ButtonStyle.Secondary : ButtonStyle.Primary)),
      new ButtonBuilder().setCustomId(`security_refresh:${userId}`).setLabel('🔄 Refresh').setStyle(ButtonStyle.Success),
    ),
  ];
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
      return interaction.reply({ content: 'You need Manage Server permission.', flags: MessageFlags.Ephemeral });
    }

    const security = await getSecurityConfig(client, interaction.guildId);
    await interaction.reply({ embeds: [buildSecurityDashboard(security, interaction.guild)], components: buildSecurityControls(interaction.user.id), flags: MessageFlags.Ephemeral });
  },
};
