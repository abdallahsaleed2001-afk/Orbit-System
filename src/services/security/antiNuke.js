import { AuditLogEvent } from 'discord.js';
import { getSecurityConfig, isWhitelisted, sendSecurityLog, getRecentCount } from './securityService.js';
import { logger } from '../../utils/logger.js';

const counters = new Map();

const EVENT_MAP = {
  channelDelete: AuditLogEvent.ChannelDelete,
  channelCreate: AuditLogEvent.ChannelCreate,
  roleDelete: AuditLogEvent.RoleDelete,
  roleCreate: AuditLogEvent.RoleCreate,
  webhookUpdate: AuditLogEvent.WebhookCreate,
  ban: AuditLogEvent.MemberBanAdd,
  kick: AuditLogEvent.MemberKick,
  botAdd: AuditLogEvent.BotAdd,
};

function key(guildId, executorId, type) {
  return `${guildId}:${executorId}:${type}`;
}

async function findExecutor(guild, auditType, targetId) {
  const logs = await guild.fetchAuditLogs({ type: auditType, limit: 8 }).catch(() => null);
  const entry = logs?.entries?.find(e => {
    if (Date.now() - e.createdTimestamp > 15000) return false;
    if (!targetId) return true;
    return e.target?.id === targetId;
  });
  return entry?.executor || null;
}

async function punishExecutor(guild, executor, config, reason) {
  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (!member || member.id === guild.ownerId || isWhitelisted(member, config)) return false;

  if (config.antiNuke.action === 'ban' && member.bannable) {
    await member.ban({ reason: `Anti-Nuke: ${reason}` }).catch(() => {});
  } else if (config.antiNuke.action === 'kick' && member.kickable) {
    await member.kick(`Anti-Nuke: ${reason}`).catch(() => {});
  } else if (member.manageable) {
    const removable = member.roles.cache.filter(role => role.id !== guild.id && role.editable);
    await member.roles.remove(removable, `Anti-Nuke: ${reason}`).catch(() => {});
  }

  await sendSecurityLog(guild.client, guild, {
    title: 'Anti-Nuke Triggered',
    description: `**${executor.tag || executor.username}** triggered the Anti-Nuke protection.`,
    fields: [
      { name: 'Reason', value: reason },
      { name: 'Action', value: config.antiNuke.action },
    ],
  });
  return true;
}

export async function handleAntiNuke(guild, type, targetId = null) {
  const config = await getSecurityConfig(guild.client, guild.id);
  if (!config.enabled || !config.antiNuke.enabled) return;

  const auditType = EVENT_MAP[type];
  const threshold = config.antiNuke.thresholds[type];
  if (!auditType || !threshold) return;

  const executor = await findExecutor(guild, auditType, targetId);
  if (!executor) return;
  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (!member || member.id === guild.ownerId || isWhitelisted(member, config)) return;

  const now = Date.now();
  const counterKey = key(guild.id, executor.id, type);
  const recent = getRecentCount(counters, counterKey, now, config.antiNuke.windowMs);
  recent.push(now);
  counters.set(counterKey, recent);

  if (recent.length >= threshold) {
    await punishExecutor(guild, executor, config, `${type} threshold exceeded (${recent.length}/${threshold})`);
    counters.delete(counterKey);
  }
}

export function registerAntiNukeEvent(eventName, type) {
  return {
    name: eventName,
    async execute(eventTarget) {
      const guild = eventTarget?.guild || eventTarget;
      const targetId = eventTarget?.id || null;
      if (!guild?.id) return;
      try {
        await handleAntiNuke(guild, type, targetId);
      } catch (error) {
        logger.error(`Anti-Nuke ${type} failed`, { error: error.message, guildId: guild.id });
      }
    },
  };
}
