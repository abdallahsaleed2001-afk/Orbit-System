import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder } from 'discord.js';
import { getSecurityConfig } from '../../../services/security/securityService.js';

const allowed = interaction => interaction.customId.split(':').at(-1) === interaction.user.id;

function render(guild, config, userId) {
  const ignored = config.ignoredChannels || [];
  const list = ignored.length ? ignored.map(id => `<#${id}>`).join(', ') : '`None`';

  return {
    embeds: [new EmbedBuilder()
      .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
      .setTitle('🚫 Ignored AutoMod Channels')
      .setDescription(`Select a channel below to **toggle** AutoMod ignore.\n\n**Ignored channels:** ${list}\n\nIgnored channels are skipped by AutoMod, including Repeated Words.`)
      .setColor(0xed4245)
      .setFooter({ text: 'Select a channel again to remove it from the ignore list.' })
      .setTimestamp()],
    components: [
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(`security_logs_ignored_select:${userId}`)
          .setPlaceholder('Select a channel to toggle ignore')
          .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setMinValues(1)
          .setMaxValues(1)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`security_panel_logs:${userId}`).setLabel('← Back to Logs').setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

export default {
  name: 'logs_ignored2',
  async execute(interaction, client) {
    if (!allowed(interaction)) {
      return interaction.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });
    }

    const config = await getSecurityConfig(client, interaction.guildId);
    return interaction.update(render(interaction.guild, config, interaction.user.id));
  },
};
