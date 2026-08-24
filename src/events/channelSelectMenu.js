import { Events } from 'discord.js';
import { getSecurityConfig, updateSecurityConfig } from '../services/security/securityService.js';
import { logger } from '../utils/logger.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isChannelSelectMenu?.()) return;
    if (!interaction.customId.startsWith('security_logs_ignored_select:')) return;

    const [, ownerId] = interaction.customId.split(':');
    if (ownerId !== interaction.user.id) {
      await interaction.reply({
        content: 'This security dashboard belongs to another moderator.',
        ephemeral: true,
      }).catch(() => {});
      return;
    }

    try {
      const channelId = interaction.values?.[0];
      if (!channelId) {
        await interaction.reply({ content: 'No channel was selected.', ephemeral: true }).catch(() => {});
        return;
      }

      const config = await getSecurityConfig(client, interaction.guildId);
      const ignored = new Set(config.ignoredChannels || []);

      if (ignored.has(channelId)) ignored.delete(channelId);
      else ignored.add(channelId);

      await updateSecurityConfig(client, interaction.guildId, {
        ignoredChannels: [...ignored],
      });

      const updated = await getSecurityConfig(client, interaction.guildId);
      const list = updated.ignoredChannels?.length
        ? updated.ignoredChannels.map(id => `<#${id}>`).join(', ')
        : '`None`';

      await interaction.update({
        embeds: [
          interaction.message.embeds[0]
            ? interaction.message.embeds[0].toJSON()
            : {
                title: '🚫 Ignored AutoMod Channels',
                description: 'Select a channel below to toggle AutoMod ignore.',
              },
        ],
        components: interaction.message.components,
      });

      // Update the existing embed without rebuilding the dashboard structure.
      const embed = interaction.message.embeds[0]?.toJSON?.() || {};
      embed.description = `Select a channel below to **toggle** AutoMod ignore.\n\n**Ignored channels:** ${list}\n\nIgnored channels are skipped by AutoMod, including Repeated Words.`;
      await interaction.message.edit({ embeds: [embed] }).catch(() => {});
    } catch (error) {
      logger.error('Failed to handle security ignored channel select:', {
        error: error.message,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        customId: interaction.customId,
      });

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Failed to update ignored channels.', ephemeral: true }).catch(() => {});
      }
    }
  },
};
