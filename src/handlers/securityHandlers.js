import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getSecurityConfig, updateSecurityConfig } from '../services/security/securityService.js';

function dashboard(config) {
  return new EmbedBuilder().setTitle('🛡️ Infinity Security Dashboard').setColor(0x5865F2).addFields(
    { name: '🛡️ Anti-Nuke', value: config.antiNuke.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
    { name: '🚨 Anti-Raid', value: config.antiRaid.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
    { name: '🤖 AutoMod', value: config.autoMod.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
    { name: '⚡ Escalation', value: `${config.escalation.length} strike levels`, inline: true },
    { name: '👤 Whitelist', value: `${config.whitelist.users.length} users / ${config.whitelist.roles.length} roles`, inline: true },
    { name: '📋 Log Channel', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not configured', inline: true },
  );
}

function controls(config, userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`security_toggle:nuke:${userId}`).setLabel('Anti-Nuke').setStyle(config.antiNuke.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`security_toggle:raid:${userId}`).setLabel('Anti-Raid').setStyle(config.antiRaid.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`security_toggle:automod:${userId}`).setLabel('AutoMod').setStyle(config.autoMod.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`security_refresh:${userId}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`security_whitelist:${userId}`).setLabel('Whitelist').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`security_logging:${userId}`).setLabel('Logging').setStyle(ButtonStyle.Primary),
    ),
  ];
}

function ownerOnly(interaction) {
  const parts = interaction.customId.split(':');
  return parts.at(-1) === interaction.user.id;
}

const securityToggleHandler = {
  name: 'security_toggle',
  async execute(interaction, client) {
    if (!ownerOnly(interaction)) return interaction.reply({ content: 'This dashboard belongs to another moderator.', ephemeral: true });
    const [, type] = interaction.customId.split(':');
    const key = type === 'nuke' ? 'antiNuke.enabled' : type === 'raid' ? 'antiRaid.enabled' : 'autoMod.enabled';
    const current = await getSecurityConfig(client, interaction.guildId);
    const patch = type === 'nuke' ? { antiNuke: { enabled: !current.antiNuke.enabled } } : type === 'raid' ? { antiRaid: { enabled: !current.antiRaid.enabled } } : { autoMod: { enabled: !current.autoMod.enabled } };
    const updated = await updateSecurityConfig(client, interaction.guildId, patch);
    await interaction.update({ embeds: [dashboard(updated)], components: controls(updated, interaction.user.id) });
  },
};

const securityRefreshHandler = {
  name: 'security_refresh',
  async execute(interaction, client) {
    if (!ownerOnly(interaction)) return interaction.reply({ content: 'This dashboard belongs to another moderator.', ephemeral: true });
    const config = await getSecurityConfig(client, interaction.guildId);
    await interaction.update({ embeds: [dashboard(config)], components: controls(config, interaction.user.id) });
  },
};

const securityWhitelistHandler = {
  name: 'security_whitelist',
  async execute(interaction) {
    if (!ownerOnly(interaction)) return interaction.reply({ content: 'This dashboard belongs to another moderator.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId(`security_whitelist_modal:${interaction.user.id}`).setTitle('Security Whitelist');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('users').setLabel('User IDs (space/comma separated)').setStyle(TextInputStyle.Paragraph).setRequired(false)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('roles').setLabel('Role IDs (space/comma separated)').setStyle(TextInputStyle.Paragraph).setRequired(false)),
    );
    await interaction.showModal(modal);
  },
};

const securityLoggingHandler = {
  name: 'security_logging',
  async execute(interaction) {
    if (!ownerOnly(interaction)) return interaction.reply({ content: 'This dashboard belongs to another moderator.', ephemeral: true });
    const modal = new ModalBuilder().setCustomId(`security_logging_modal:${interaction.user.id}`).setTitle('Security Logging');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel').setLabel('Security log channel ID').setPlaceholder('123456789012345678').setStyle(TextInputStyle.Short).setRequired(false)));
    await interaction.showModal(modal);
  },
};

const securityWhitelistModalHandler = {
  name: 'security_whitelist_modal',
  async execute(interaction, client) {
    if (!ownerOnly(interaction)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
    const users = interaction.fields.getTextInputValue('users').split(/[\s,]+/).filter(Boolean);
    const roles = interaction.fields.getTextInputValue('roles').split(/[\s,]+/).filter(Boolean);
    const updated = await updateSecurityConfig(client, interaction.guildId, { whitelist: { users, roles } });
    await interaction.reply({ embeds: [dashboard(updated)], components: controls(updated, interaction.user.id), ephemeral: true });
  },
};

const securityLoggingModalHandler = {
  name: 'security_logging_modal',
  async execute(interaction, client) {
    if (!ownerOnly(interaction)) return interaction.reply({ content: 'Unauthorized.', ephemeral: true });
    const channel = interaction.fields.getTextInputValue('channel').trim();
    const updated = await updateSecurityConfig(client, interaction.guildId, { logChannelId: channel || null });
    await interaction.reply({ embeds: [dashboard(updated)], components: controls(updated, interaction.user.id), ephemeral: true });
  },
};

export const securityButtonHandlers = [securityToggleHandler, securityRefreshHandler, securityWhitelistHandler, securityLoggingHandler];
export const securityModalHandlers = [securityWhitelistModalHandler, securityLoggingModalHandler];
