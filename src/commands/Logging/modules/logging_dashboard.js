import { EmbedBuilder, MessageFlags, PermissionsBitField } from 'discord.js';
import { getColor } from '../../../config/bot.js';
import { getLoggingStatus } from '../../../services/loggingService.js';
import {
  createLoggingDashboardComponents,
  createLoggingCategoryViewComponents,
  createLoggingFilterComponents,
  DASHBOARD_CATEGORIES,
  DASHBOARD_CATEGORY_LABELS,
  EVENT_TYPES_BY_CATEGORY,
  LOG_CHANNEL_DESTINATIONS,
} from '../../../utils/logging/loggingUi.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';

export function getCategoryStatus(enabledEvents, category, loggingEnabled) {
  if (!loggingEnabled) return false;
  const events = enabledEvents || {};
  if (events[`${category}.*`] === false) return false;
  const categoryEvents = EVENT_TYPES_BY_CATEGORY[category] || [];
  return categoryEvents.length === 0 || categoryEvents.every((eventType) => events[eventType] !== false);
}

async function formatChannelMention(guild, id) {
  if (!id) return '`Not configured`';
  const channel = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
  return channel ? channel.toString() : `⚠️ Missing (${id})`;
}

function countEnabledCategories(enabledEvents, loggingEnabled) {
  const enabled = DASHBOARD_CATEGORIES.filter((key) => getCategoryStatus(enabledEvents, key, loggingEnabled)).length;
  return { enabled, total: DASHBOARD_CATEGORIES.length };
}

export async function buildLoggingDashboardView(interaction, client) {
  const loggingStatus = await getLoggingStatus(client, interaction.guildId);
  const loggingEnabled = Boolean(loggingStatus.enabled);
  const channels = loggingStatus.channels || {};
  const ignore = loggingStatus.ignore || { users: [], channels: [] };
  const { enabled: enabledCount, total } = countEnabledCategories(loggingStatus.enabledEvents, loggingEnabled);

  const channelLines = await Promise.all(
    LOG_CHANNEL_DESTINATIONS.map(async (destination) =>
      `**${destination.label}:** ${await formatChannelMention(interaction.guild, channels[destination.value])}`),
  );

  const embed = new EmbedBuilder()
    .setTitle('📝 Logging Dashboard')
    .setDescription(`Manage server logging for **${interaction.guild.name}**. Each event category has its own dedicated log channel.`)
    .setColor(loggingEnabled ? getColor('success') : getColor('warning'))
    .addFields(
      { name: 'Logging Status', value: loggingEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
      { name: 'Event Categories', value: `${enabledCount}/${total} enabled`, inline: true },
      { name: 'Ignore Filters', value: `${ignore.users?.length || 0} users · ${ignore.channels?.length || 0} channels`, inline: true },
      { name: 'Log Channels', value: channelLines.join('\n'), inline: false },
    )
    .setFooter({ text: 'Use /logging setup to create or repair all logging channels.' })
    .setTimestamp();

  return { embed, components: createLoggingDashboardComponents(loggingStatus.enabledEvents, loggingEnabled) };
}

export async function buildLoggingCategoriesView(interaction, client) {
  const loggingStatus = await getLoggingStatus(client, interaction.guildId);
  const loggingEnabled = Boolean(loggingStatus.enabled);

  const categoryLines = DASHBOARD_CATEGORIES.map((key) => {
    const on = getCategoryStatus(loggingStatus.enabledEvents, key, loggingEnabled);
    const label = DASHBOARD_CATEGORY_LABELS[key] || key;
    return `${on ? '✅' : '❌'} ${label}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📋 Event Categories')
    .setDescription(loggingEnabled ? 'Toggle which event types are logged to their dedicated channels.' : '⚠️ Logging is disabled. Enable the Logging System from the main dashboard.')
    .setColor(getColor('info'))
    .addFields({ name: 'Category Status', value: categoryLines, inline: false })
    .setFooter({ text: 'Each category is sent to its own dedicated log channel.' })
    .setTimestamp();

  return { embed, components: createLoggingCategoryViewComponents(loggingStatus.enabledEvents, loggingEnabled) };
}

export async function buildLoggingFilterView(interaction, client) {
  const loggingStatus = await getLoggingStatus(client, interaction.guildId);
  const ignore = loggingStatus.ignore || { users: [], channels: [] };

  const userLines = (ignore.users || []).length ? ignore.users.map((id) => `• User \`${id}\``).join('\n') : '*No ignored users*';
  const channelLines = (ignore.channels || []).length ? ignore.channels.map((id) => `• Channel \`${id}\``).join('\n') : '*No ignored channels*';

  const embed = new EmbedBuilder()
    .setTitle('🔇 Log Ignore Filters')
    .setDescription('Users and channels on this list will be skipped when sending logs.')
    .setColor(getColor('info'))
    .addFields(
      { name: 'Ignored Users', value: userLines.slice(0, 1024), inline: false },
      { name: 'Ignored Channels', value: channelLines.slice(0, 1024), inline: false },
    )
    .setFooter({ text: 'Use the buttons below to add or remove filters.' })
    .setTimestamp();

  return { embed, components: createLoggingFilterComponents() };
}

export function isCategoriesView(interaction) {
  return interaction.message?.embeds?.[0]?.title === '📋 Event Categories';
}

export function isFilterView(interaction) {
  return interaction.message?.embeds?.[0]?.title === '🔇 Log Ignore Filters';
}

export async function refreshDashboardMessage(interaction, client) {
  let view;
  if (isCategoriesView(interaction)) view = await buildLoggingCategoriesView(interaction, client);
  else if (isFilterView(interaction)) view = await buildLoggingFilterView(interaction, client);
  else view = await buildLoggingDashboardView(interaction, client);

  await interaction.message.edit({ embeds: [view.embed], components: view.components, content: null }).catch(() => {});
}

export default {
  prefixOnly: false,
  async execute(interaction, config, client) {
    try {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need **Manage Server** permissions to view the logging dashboard.' });
      }

      await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
      const { embed, components } = await buildLoggingDashboardView(interaction, client);
      await InteractionHelper.safeEditReply(interaction, { embeds: [embed], components });
    } catch (error) {
      logger.error('logging_dashboard error:', error);
      await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Failed to load the logging dashboard.' });
    }
  },
};
