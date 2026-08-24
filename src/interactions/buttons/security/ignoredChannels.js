import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder } from 'discord.js';
import { getSecurityConfig } from '../../../services/security/securityService.js';

function allowed(interaction) {
  return interaction.customId.split(':').at(-1) === interaction.user.id;
}

function ignoredList(config) {
  const channels = config.ignoredChannels || [];
  return channels.length ? channels.map(id => `<#${id}>`).join(', ') : '`None`';
}

function buildEmbed(guild, config) {
  return new EmbedBuilder()
    .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle('🚫 Ignored AutoMod Channels')
    .setDescription(
      'Select a channel below to **toggle** AutoMod ignore.\n\n' +
      '**Ignored channels:** ' + ignoredList(config) +
      '\n\nIgnored channels are skipped by AutoMod, including Repeated Words.'
    )
    .setColor(0xed4245)
    .setFooter({ text: 'Select a channel again to remove it from the ignore list.' })
    .setTimestamp();
}

function components(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`security_logs_ignored_select:${userId}`)
        .setPlaceholder('Select a channel to toggle ignore')
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1)
        .setMaxValues(1)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`security_panel_logs:${userId}`)
        .setLabel('← Back to Logs')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

export default {
  name: 'security_logs_ignored',
  async execute(interaction, client) {
    if (!allowed(interaction)) {
      return interaction.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });
    }

    const config = await getSecurityConfig(client, interaction.guildId);
    return interaction.update({
      embeds: [buildEmbed(interaction.guild, config)],
      components: components(interaction.user.id),
    });
  },
};
