import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { getGuildConfig, updateGuildConfig } from './config/guildConfig.js';
import { logger } from '../utils/logger.js';

export const LOGGING_CHANNEL_DEFINITIONS = {
  moderation: { name: 'moderation-logs', topic: 'Orbit logs for bans, kicks, mutes, warnings, timeouts, locks and other moderation actions.' },
  message: { name: 'message-logs', topic: 'Orbit logs for deleted, edited and bulk-deleted messages.' },
  member: { name: 'member-logs', topic: 'Orbit logs for member joins, leaves and name changes.' },
  role: { name: 'role-logs', topic: 'Orbit logs for role creation, deletion and updates.' },
  leveling: { name: 'leveling-logs', topic: 'Orbit logs for level-ups and leveling milestones.' },
  reactionrole: { name: 'reaction-role-logs', topic: 'Orbit logs for reaction-role creation, updates, deletion and assignments.' },
  giveaway: { name: 'giveaway-logs', topic: 'Orbit logs for giveaway creation, winners, rerolls and deletion.' },
  counter: { name: 'counter-logs', topic: 'Orbit logs for counter updates and configuration changes.' },
  application: { name: 'application-logs', topic: 'Orbit logs for application submissions and reviews.' },
  report: { name: 'report-logs', topic: 'Orbit logs for user reports filed through Orbit.' },
};

const CATEGORY_NAME = 'ORBIT LOGS';

function isUsableTextChannel(channel) {
  return channel?.type === ChannelType.GuildText;
}

async function findExistingChannel(guild, name, parentId) {
  return guild.channels.cache.find(
    (channel) => isUsableTextChannel(channel) && channel.name === name && (!parentId || channel.parentId === parentId),
  ) || null;
}

export async function ensureLoggingChannels(guild) {
  if (!guild) throw new Error('Guild is required to create logging channels.');

  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error('I need Manage Channels permission to create the logging system.');
  }

  let category = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name === CATEGORY_NAME,
  ) || null;

  if (!category) {
    category = await guild.channels.create({ name: CATEGORY_NAME, type: ChannelType.GuildCategory });
  }

  const channels = {};
  const created = [];

  for (const [key, definition] of Object.entries(LOGGING_CHANNEL_DEFINITIONS)) {
    let channel = await findExistingChannel(guild, definition.name, category.id);

    if (!channel) {
      channel = await guild.channels.create({
        name: definition.name,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: definition.topic,
      });
      created.push(channel.id);
    } else if (!channel.topic) {
      await channel.setTopic(definition.topic).catch(() => {});
    }

    channels[key] = channel.id;
  }

  return { categoryId: category.id, channels, created };
}

export async function setupLoggingSystem(client, guildId) {
  const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) throw new Error('Guild not found.');

  const result = await ensureLoggingChannels(guild);
  const config = await getGuildConfig(client, guildId);
  const currentLogging = config.logging || {};
  const currentChannels = currentLogging.channels || {};

  await updateGuildConfig(client, guildId, {
    logging: {
      ...currentLogging,
      enabled: true,
      categoryId: result.categoryId,
      channels: {
        ...currentChannels,
        ...result.channels,
        // Backwards compatibility: the existing logger uses `audit` for general audit events.
        audit: result.channels.moderation,
        applications: result.channels.application,
        reports: result.channels.report,
      },
    },
  });

  logger.info(`Logging system ready for guild ${guildId}; created ${result.created.length} channels.`);
  return result;
}

export async function repairLoggingSystem(client, guildId) {
  return setupLoggingSystem(client, guildId);
}
