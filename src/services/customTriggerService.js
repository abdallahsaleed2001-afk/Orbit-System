import { PermissionFlagsBits } from 'discord.js';
import { getGuildConfig, updateGuildConfig } from './config/guildConfig.js';
import { logger } from '../utils/logger.js';

const MAX_TRIGGERS = 100;
const MAX_TRIGGER_LENGTH = 100;
const cooldowns = new Map();

export const TRIGGER_ACTIONS = Object.freeze({
  LOCK: 'lock',
  UNLOCK: 'unlock',
  HIDE: 'hide',
  UNHIDE: 'unhide',
  ADD_ROLE: 'add_role',
  REMOVE_ROLE: 'remove_role',
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
  if ((action === TRIGGER_ACTIONS.ADD_ROLE || action === TRIGGER_ACTIONS.REMOVE_ROLE) && !roleId) {
    throw new Error('A role is required for this action.');
  }

  const triggers = await getCustomTriggers(client, guildId);
  const existing = triggers.findIndex((item) => normalizeTrigger(item.trigger) === normalizedTrigger);
  const entry = { trigger: normalizedTrigger, action, roleId: roleId || null };

  if (existing >= 0) triggers[existing] = entry;
  else {
    if (triggers.length >= MAX_TRIGGERS) throw new Error(`A server can have up to ${MAX_TRIGGERS} custom triggers.`);
    triggers.push(entry);
  }

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

  // Exact match: whitespace around the message is ignored, but any extra
  // characters before/after the trigger prevent execution. For example,
  // trigger "صور" does NOT execute for "-صور" or "صور123".
  const content = normalizeTrigger(message.content);
  if (!content) return false;

  const triggers = await getCustomTriggers(client, message.guild.id);
  const trigger = triggers.find((item) => normalizeTrigger(item.trigger) === content);
  if (!trigger) return false;

  const cooldownKey = `${message.guild.id}:${message.author.id}:${content}`;
  const cooldownUntil = cooldowns.get(cooldownKey) || 0;
  if (cooldownUntil > Date.now()) return true;
  cooldowns.set(cooldownKey, Date.now() + 1500);

  try {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) &&
        [TRIGGER_ACTIONS.LOCK, TRIGGER_ACTIONS.UNLOCK, TRIGGER_ACTIONS.HIDE, TRIGGER_ACTIONS.UNHIDE].includes(trigger.action)) {
      return false;
    }

    switch (trigger.action) {
      case TRIGGER_ACTIONS.LOCK:
        await message.channel.permissionOverwrites.edit(
          message.guild.roles.everyone,
          { SendMessages: false },
          { reason: `Custom trigger "${trigger.trigger}" used by ${message.author.tag}` },
        );
        break;

      case TRIGGER_ACTIONS.UNLOCK:
        await message.channel.permissionOverwrites.edit(
          message.guild.roles.everyone,
          { SendMessages: null },
          { reason: `Custom trigger "${trigger.trigger}" used by ${message.author.tag}` },
        );
        break;

      case TRIGGER_ACTIONS.HIDE:
        await message.channel.permissionOverwrites.edit(
          message.guild.roles.everyone,
          { ViewChannel: false },
          { reason: `Custom trigger "${trigger.trigger}" used by ${message.author.tag}` },
        );
        break;

      case TRIGGER_ACTIONS.UNHIDE:
        await message.channel.permissionOverwrites.edit(
          message.guild.roles.everyone,
          { ViewChannel: null },
          { reason: `Custom trigger "${trigger.trigger}" used by ${message.author.tag}` },
        );
        break;

      case TRIGGER_ACTIONS.ADD_ROLE:
      case TRIGGER_ACTIONS.REMOVE_ROLE: {
        const role = message.guild.roles.cache.get(trigger.roleId) || await message.guild.roles.fetch(trigger.roleId).catch(() => null);
        const botMember = message.guild.members.me;
        if (!role || !botMember) return false;
        if (role.managed || role.position >= botMember.roles.highest.position) return false;

        if (trigger.action === TRIGGER_ACTIONS.ADD_ROLE) {
          if (!message.member.roles.cache.has(role.id)) await message.member.roles.add(role, `Custom trigger "${trigger.trigger}"`);
        } else if (message.member.roles.cache.has(role.id)) {
          await message.member.roles.remove(role, `Custom trigger "${trigger.trigger}"`);
        }
        break;
      }

      default:
        return false;
    }

    await message.delete().catch(() => {});
    return true;
  } catch (error) {
    logger.error('Custom trigger execution failed:', {
      error: error.message,
      guildId: message.guild.id,
      channelId: message.channel.id,
      trigger: trigger.trigger,
      action: trigger.action,
    });
    return false;
  } finally {
    setTimeout(() => cooldowns.delete(cooldownKey), 2000);
  }
}

function normalizeTrigger(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}
