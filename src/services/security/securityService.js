import { getFromDb, setInDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

export const SECURITY_DEFAULTS = {
  enabled: true,
  antiNuke: {
    enabled: true,
    windowMs: 10000,
    thresholds: {
      channelDelete: 3,
      channelCreate: 5,
      roleDelete: 3,
      roleCreate: 5,
      webhookUpdate: 3,
      ban: 5,
      kick: 5,
      botAdd: 2,
    },
    action: 'strip',
    lockdown: true,
  },
  antiRaid: {
    enabled: true,
    joins: 8,
    windowMs: 10000,
    minAccountAgeMs: 24 * 60 * 60 * 1000,
    action: 'timeout',
    timeoutMs: 10 * 60 * 1000,
    lockdown: true,
    lockdownMs: 10 * 60 * 1000,
  },
  autoMod: {
    enabled: true,
    spam: { enabled: true, maxMessages: 6, windowMs: 5000 },
    duplicate: { enabled: true, maxRepeats: 3, windowMs: 10000 },
    mentions: { enabled: true, max: 6 },
    caps: { enabled: false, ratio: 0.8, minLength: 12 },
    invites: { enabled: true },
    links: { enabled: false },
    badWords: { enabled: false, words: [] },
    action: 'delete',
  },
  escalation: [
    { strike: 1, action: 'warn', durationMs: 0 },
    { strike: 2, action: 'timeout', durationMs: 60 * 1000 },
    { strike: 3, action: 'timeout', durationMs: 10 * 60 * 1000 },
    { strike: 4, action: 'timeout', durationMs: 60 * 60 * 1000 },
    { strike: 5, action: 'kick', durationMs: 0 },
    { strike: 6, action: 'ban', durationMs: 0 },
  ],
  whitelist: { users: [], roles: [], bots: [] },
  ignoredChannels: [],
  logChannelId: null,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepMerge(base, patch) {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function configKey(guildId) {
  return `security:config:${guildId}`;
}

function strikeKey(guildId, userId) {
  return `security:strikes:${guildId}:${userId}`;
}

export async function getSecurityConfig(client, guildId) {
  try {
    const stored = await getFromDb(configKey(guildId), null);
    return deepMerge(clone(SECURITY_DEFAULTS), stored || {});
  } catch (error) {
    logger.error('Failed to load security config', { guildId, error: error.message });
    return clone(SECURITY_DEFAULTS);
  }
}

export async function updateSecurityConfig(client, guildId, patch) {
  const current = await getSecurityConfig(client, guildId);
  const updated = deepMerge(current, patch);
  await setInDb(configKey(guildId), updated);
  return updated;
}

export async function getStrikes(client, guildId, userId) {
  const value = await getFromDb(strikeKey(guildId, userId), null);
  if (!value || typeof value !== 'object') return { count: 0, updatedAt: 0 };
  return value;
}

export async function addStrike(client, guildId, userId, reason = 'AutoMod violation') {
  const current = await getStrikes(client, guildId, userId);
  const next = { count: Number(current.count || 0) + 1, updatedAt: Date.now(), lastReason: reason };
  await setInDb(strikeKey(guildId, userId), next);
  return next;
}

export async function clearStrikes(client, guildId, userId) {
  await setInDb(strikeKey(guildId, userId), { count: 0, updatedAt: Date.now() });
}

export function isWhitelisted(member, config) {
  if (!member) return false;
  if (config.whitelist.users.includes(member.id)) return true;
  if (member.roles?.cache?.some(role => config.whitelist.roles.includes(role.id))) return true;
  if (member.user?.bot && config.whitelist.bots.includes(member.id)) return true;
  return false;
}

export async function sendSecurityLog(client, guild, payload) {
  try {
    const config = await getSecurityConfig(client, guild.id);
    if (!config.logChannelId) return;
    const channel = guild.channels.cache.get(config.logChannelId) || await guild.channels.fetch(config.logChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    await channel.send({ embeds: [{
      title: payload.title || 'Security Event',
      description: payload.description || 'Security event detected.',
      color: payload.color || 0xED4245,
      fields: payload.fields || [],
      timestamp: new Date().toISOString(),
    }] });
  } catch (error) {
    logger.warn('Failed to send security log', { guildId: guild.id, error: error.message });
  }
}

export function getRecentCount(store, key, now, windowMs) {
  const list = store.get(key) || [];
  const recent = list.filter(timestamp => now - timestamp <= windowMs);
  store.set(key, recent);
  return recent;
}
