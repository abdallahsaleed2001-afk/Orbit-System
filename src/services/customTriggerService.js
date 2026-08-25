import { PermissionFlagsBits } from 'discord.js';
import { getGuildConfig, updateGuildConfig } from './config/guildConfig.js';
import { logger } from '../utils/logger.js';
import { WarningService } from './moderation/warningService.js';
import { logModerationAction } from '../utils/moderation.js';

const MAX_TRIGGERS = 100;
const MAX_TRIGGER_LENGTH = 100;
const cooldowns = new Map();
const TARGET_ROLE_ID = '1534935138440314960';
const MUTE_ROLE_ID = '1535481560172728402';

export const TRIGGER_ACTIONS = Object.freeze({
  LOCK: 'lock', UNLOCK: 'unlock', HIDE: 'hide', UNHIDE: 'unhide',
  ADD_ROLE: 'add_role', REMOVE_ROLE: 'remove_role', BAN: 'ban', KICK: 'kick', WARN: 'warn', MUTE: 'mute', TIMEOUT: 'timeout',
});

export async function getCustomTriggers(client, guildId) {
  const config = await getGuildConfig(client, guildId);
  return Array.isArray(config.customTriggers) ? config.customTriggers : [];
}

export async function addCustomTrigger(client, guildId, trigger, action, roleId = null) {
  const normalizedTrigger = normalizeTrigger(trigger);
  if (!normalizedTrigger) throw new Error('Trigger cannot be empty.');
  if (normalizedTrigger.length > MAX_TRIGGER_LENGTH) throw new Error(`Trigger cannot exceed ${MAX_TRIGGER_LENGTH} characters.`);
  if (!Object.values(TRIGGER_ACTIONS).includes(action)) throw new Error('Invalid trigger action.');
  if ((action === TRIGGER_ACTIONS.ADD_ROLE || action === TRIGGER_ACTIONS.REMOVE_ROLE) && !roleId) throw new Error('A role is required for this action.');
  const triggers = await getCustomTriggers(client, guildId);
  const existing = triggers.findIndex((item) => normalizeTrigger(item.trigger) === normalizedTrigger);
  const entry = { trigger: normalizedTrigger, action, roleId: roleId || null };
  if (existing >= 0) triggers[existing] = entry;
  else { if (triggers.length >= MAX_TRIGGERS) throw new Error(`A server can have up to ${MAX_TRIGGERS} custom triggers.`); triggers.push(entry); }
  await updateGuildConfig(client, guildId, { customTriggers: triggers });
  return entry;
}

export async function removeCustomTrigger(client, guildId, trigger) {
  const normalizedTrigger = normalizeTrigger(trigger);
  const triggers = await getCustomTriggers(client, guildId);
  const next = triggers.filter((item) => normalizeTrigger(item.trigger) !== normalizedTrigger);
  if (next.length === triggers.length) return false;
  await updateGuildConfig(client, guildId, { customTriggers: next });
  return true;
}

export async function handleCustomTrigger(message, client) {
  if (!message.guild || message.author.bot) return false;
  const content = normalizeTrigger(message.content);
  if (!content) return false;
  const triggers = await getCustomTriggers(client, message.guild.id);
  const trigger = triggers.find((item) => normalizeTrigger(item.trigger) === content);
  if (!trigger) return false;

  const cooldownKey = `${message.guild.id}:${message.author.id}:${content}`;
  if ((cooldowns.get(cooldownKey) || 0) > Date.now()) return true;
  cooldowns.set(cooldownKey, Date.now() + 1500);

  try {
    const channelActions = [TRIGGER_ACTIONS.LOCK, TRIGGER_ACTIONS.UNLOCK, TRIGGER_ACTIONS.HIDE, TRIGGER_ACTIONS.UNHIDE];
    if (channelActions.includes(trigger.action) && !message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return false;

    if (channelActions.includes(trigger.action)) {
      const targetRole = message.guild.roles.cache.get(TARGET_ROLE_ID) || await message.guild.roles.fetch(TARGET_ROLE_ID).catch(() => null);
      if (!targetRole) return false;
      const reason = `Custom trigger "${trigger.trigger}" used by ${message.author.tag}`;
      if (trigger.action === TRIGGER_ACTIONS.LOCK) await message.channel.permissionOverwrites.edit(targetRole, { SendMessages: false }, { reason });
      else if (trigger.action === TRIGGER_ACTIONS.UNLOCK) await message.channel.permissionOverwrites.edit(targetRole, { SendMessages: true }, { reason });
      else if (trigger.action === TRIGGER_ACTIONS.HIDE) await message.channel.permissionOverwrites.edit(targetRole, { ViewChannel: false }, { reason });
      else if (trigger.action === TRIGGER_ACTIONS.UNHIDE) await message.channel.permissionOverwrites.edit(targetRole, { ViewChannel: true }, { reason });
    } else if ([TRIGGER_ACTIONS.ADD_ROLE, TRIGGER_ACTIONS.REMOVE_ROLE].includes(trigger.action)) {
      const role = message.guild.roles.cache.get(trigger.roleId) || await message.guild.roles.fetch(trigger.roleId).catch(() => null);
      const botMember = message.guild.members.me;
      if (!role || !botMember || role.managed || role.position >= botMember.roles.highest.position) return false;
      const targetMember = await resolveTargetMember(message);
      if (!targetMember || targetMember.id === message.guild.ownerId || targetMember.id === botMember.id || targetMember.roles.highest.position >= botMember.roles.highest.position) return false;
      if (trigger.action === TRIGGER_ACTIONS.ADD_ROLE) {
        if (!targetMember.roles.cache.has(role.id)) await targetMember.roles.add(role, `Custom trigger "${trigger.trigger}"`);
        await logModerationAction({ client, guild: message.guild, event: { action: 'Role Added', target: `${targetMember.user.tag} (${targetMember.id})`, executor: `${message.author.tag} (${message.author.id})`, reason: `Trigger: ${trigger.trigger}`, metadata: { userId: targetMember.id, moderatorId: message.author.id, roleId: role.id, roleName: role.name } } });
      } else {
        if (targetMember.roles.cache.has(role.id)) await targetMember.roles.remove(role, `Custom trigger "${trigger.trigger}"`);
        await logModerationAction({ client, guild: message.guild, event: { action: 'Role Removed', target: `${targetMember.user.tag} (${targetMember.id})`, executor: `${message.author.tag} (${message.author.id})`, reason: `Trigger: ${trigger.trigger}`, metadata: { userId: targetMember.id, moderatorId: message.author.id, roleId: role.id, roleName: role.name } } });
      }
    } else {
      const success = await executeModerationTrigger(message, trigger.action);
      if (!success) return false;
    }

    await message.react('✅').catch(() => {});
    return true;
  } catch (error) {
    logger.error('Custom trigger execution failed:', { error: error.message, guildId: message.guild.id, channelId: message.channel.id, trigger: trigger.trigger, action: trigger.action });
    return false;
  } finally {
    setTimeout(() => cooldowns.delete(cooldownKey), 2000);
  }
}

async function resolveTargetMember(message) {
  const reference = message.reference?.messageId ? await message.channel.messages.fetch(message.reference.messageId).catch(() => null) : null;
  const targetId = message.mentions.users.first()?.id || reference?.author?.id;
  if (!targetId || targetId === message.author.id || targetId === message.client.user.id) return null;
  return message.guild.members.fetch(targetId).catch(() => null);
}

async function executeModerationTrigger(message, action) {
  const member = await resolveTargetMember(message);
  if (!member) return false;
  const botMember = message.guild.members.me;
  if (!botMember || member.id === message.guild.ownerId || member.roles.highest.position >= botMember.roles.highest.position) return false;
  const reason = `Trigger: ${message.content}`;
  const executor = `${message.author.tag} (${message.author.id})`;
  const target = `${member.user.tag} (${member.id})`;

  if (action === TRIGGER_ACTIONS.BAN) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers) || !member.bannable) return false;
    await member.ban({ reason });
    await logModerationAction({ client: message.client, guild: message.guild, event: { action: 'Member Banned', target, executor, reason, metadata: { userId: member.id, moderatorId: message.author.id } } });
    return true;
  }
  if (action === TRIGGER_ACTIONS.KICK) {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers) || !member.kickable) return false;
    await member.kick(reason);
    await logModerationAction({ client: message.client, guild: message.guild, event: { action: 'Member Kicked', target, executor, reason, metadata: { userId: member.id, moderatorId: message.author.id } } });
    return true;
  }
  if (action === TRIGGER_ACTIONS.WARN) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return false;
    const { id, totalCount } = await WarningService.addWarning({ guildId: message.guild.id, userId: member.id, moderatorId: message.author.id, reason, timestamp: Date.now() });
    await logModerationAction({ client: message.client, guild: message.guild, event: { action: 'User Warned', target, executor, reason, metadata: { userId: member.id, moderatorId: message.author.id, totalWarns: totalCount, warningNumber: totalCount, warningId: id } } });
    return true;
  }
  if (action === TRIGGER_ACTIONS.TIMEOUT) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers) || !member.moderatable) return false;
    const durationMs = 10 * 60 * 1000;
    await member.timeout(durationMs, reason);
    await logModerationAction({ client: message.client, guild: message.guild, event: { action: 'Member Timed Out', target, executor, reason, duration: '10 minutes', metadata: { userId: member.id, moderatorId: message.author.id, durationMs } } });
    return true;
  }
  if (action === TRIGGER_ACTIONS.MUTE) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return false;
    const muteRole = message.guild.roles.cache.get(MUTE_ROLE_ID) || await message.guild.roles.fetch(MUTE_ROLE_ID).catch(() => null);
    if (!muteRole || muteRole.managed || muteRole.position >= botMember.roles.highest.position) return false;
    if (!member.roles.cache.has(muteRole.id)) await member.roles.add(muteRole, reason);
    await logModerationAction({ client: message.client, guild: message.guild, event: { action: 'Member Muted', target, executor, reason, metadata: { userId: member.id, moderatorId: message.author.id, roleId: muteRole.id } } });
    return true;
  }
  return false;
}

function normalizeTrigger(value) { return String(value ?? '').trim().toLocaleLowerCase(); }
