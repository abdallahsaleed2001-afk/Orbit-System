import { getFromDb, setInDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

const NukeTypes = ['channelDelete','channelCreate','roleDelete','roleCreate','roleUpdate','webhookUpdate','webhookDelete','ban','kick','botAdd'];
const AutoModTypes = ['spam','duplicate','mentions','invites','links','caps','badWords'];

export const SECURITY_DEFAULTS = {
  enabled: true,
  antiNuke: {
    enabled: true,
    windowMs: 10000,
    thresholds: { channelDelete: 3, channelCreate: 5, roleDelete: 3, roleCreate: 5, roleUpdate: 1, webhookUpdate: 3, webhookDelete: 2, ban: 5, kick: 5, botAdd: 1 },
    action: 'strip',
    punishments: Object.fromEntries(NukeTypes.map(type => [type, ['ban','kick','botAdd'].includes(type) ? 'ban' : 'strip'])),
    lockdown: true,
  },
  antiRaid: {
    enabled: true,
    joins: 8,
    windowMs: 10000,
    minAccountAgeMs: 24 * 60 * 60 * 1000,
    action: 'timeout',
    punishment: 'timeout',
    timeoutMs: 10 * 60 * 1000,
    lockdown: true,
    lockdownMs: 10 * 60 * 1000,
  },
  autoMod: {
    enabled: true,
    spam: { enabled: true, maxMessages: 6, windowMs: 5000, punishment: 'delete' },
    duplicate: { enabled: true, maxRepeats: 3, windowMs: 10000, punishment: 'delete' },
    mentions: { enabled: true, max: 6, punishment: 'delete' },
    caps: { enabled: false, ratio: 0.8, minLength: 12, punishment: 'delete' },
    invites: { enabled: true, punishment: 'delete' },
    links: { enabled: false, punishment: 'delete' },
    badWords: { enabled: false, words: [], punishment: 'delete' },
    action: 'delete',
  },
  escalation: [
    { strike: 1, action: 'delete', durationMs: 0 },
    { strike: 2, action: 'timeout', durationMs: 60 * 1000 },
    { strike: 3, action: 'timeout', durationMs: 10 * 60 * 1000 },
    { strike: 4, action: 'timeout', durationMs: 60 * 60 * 1000 },
    { strike: 5, action: 'kick', durationMs: 0 },
    { strike: 6, action: 'ban', durationMs: 0 },
  ],
  strikeDecayMs: 24 * 60 * 60 * 1000,
  whitelist: { users: [], roles: [], bots: [] },
  ignoredChannels: [],
  logChannelId: null,
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function deepMerge(base, patch) {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) result[key] = deepMerge(base[key], value);
    else result[key] = value;
  }
  return result;
}
function configKey(guildId) { return `security:config:${guildId}`; }
function strikeKey(guildId, userId) { return `security:strikes:${guildId}:${userId}`; }

export async function getSecurityConfig(client, guildId) {
  try {
    const stored = await getFromDb(configKey(guildId), null);
    const config = deepMerge(clone(SECURITY_DEFAULTS), stored || {});
    config.antiNuke.punishments = { ...SECURITY_DEFAULTS.antiNuke.punishments, ...(config.antiNuke.punishments || {}) };
    for (const type of AutoModTypes) config.autoMod[type].punishment ||= SECURITY_DEFAULTS.autoMod[type].punishment;
    config.escalation = (config.escalation || []).map(level => ({ ...level, action: level.action === 'warn' ? 'delete' : level.action }));
    return config;
  } catch (error) {
    logger.error('Failed to load security config', { guildId, error: error.message });
    return clone(SECURITY_DEFAULTS);
  }
}
export async function updateSecurityConfig(client, guildId, patch) {
  const current = await getSecurityConfig(client, guildId);
  const updated = deepMerge(current, patch);
  updated.escalation = (updated.escalation || []).map(level => ({ ...level, action: level.action === 'warn' ? 'delete' : level.action }));
  await setInDb(configKey(guildId), updated);
  return updated;
}
export async function getStrikes(client, guildId, userId) {
  const value = await getFromDb(strikeKey(guildId, userId), null);
  if (!value || typeof value !== 'object') return { count: 0, updatedAt: 0 };
  return value;
}
export async function addStrike(client, guildId, userId, reason = 'AutoMod violation') {
  const config = await getSecurityConfig(client, guildId);
  const current = await getStrikes(client, guildId, userId);
  const now = Date.now();
  const expired = current.updatedAt && now - current.updatedAt > Number(config.strikeDecayMs || 0);
  const next = { count: (expired ? 0 : Number(current.count || 0)) + 1, updatedAt: now, lastReason: reason };
  await setInDb(strikeKey(guildId, userId), next);
  return next;
}
export async function clearStrikes(client, guildId, userId) { await setInDb(strikeKey(guildId, userId), { count: 0, updatedAt: Date.now() }); }
export function isWhitelisted(member, config) {
  if (!member) return false;
  if (config.whitelist?.users?.includes(member.id)) return true;
  if (member.roles?.cache?.some(role => config.whitelist?.roles?.includes(role.id))) return true;
  if (member.user?.bot && config.whitelist?.bots?.includes(member.id)) return true;
  return false;
}
export async function sendSecurityLog(client, guild, payload) {
  try {
    const config = await getSecurityConfig(client, guild.id);
    if (!config.logChannelId) return;
    const channel = guild.channels.cache.get(config.logChannelId) || await guild.channels.fetch(config.logChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    await channel.send({ embeds: [{ title: payload.title || 'Security Event', description: payload.description || 'Security event detected.', color: payload.color || 0xED4245, fields: payload.fields || [], timestamp: new Date().toISOString() }] });
  } catch (error) { logger.warn('Failed to send security log', { guildId: guild.id, error: error.message }); }
}
export function getRecentCount(store, key, now, windowMs) {
  const list = store.get(key) || [];
  const recent = list.filter(timestamp => now - timestamp <= windowMs);
  store.set(key, recent);
  return recent;
}

const autoModState = new Map();
function autoModKey(guildId, userId) { return `${guildId}:${userId}`; }
function autoModData(guildId, userId) {
  const key = autoModKey(guildId, userId);
  let data = autoModState.get(key);
  if (!data) { data = { messages: [], repeats: [] }; autoModState.set(key, data); }
  return data;
}
function normalizeMessage(content) { return String(content || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function capRatio(content) {
  const letters = String(content || '').match(/[A-Za-z]/g) || [];
  const upper = String(content || '').match(/[A-Z]/g) || [];
  return letters.length ? upper.length / letters.length : 0;
}

async function executeAutoModAction(message, action, duration, reason) {
  const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
  if (action === 'delete') return;
  if (action === 'timeout' && member?.moderatable) await member.timeout(Math.min(Math.max(duration || 60000, 1000), 2419200000), `AutoMod: ${reason}`).catch(() => {});
  else if (action === 'kick' && member?.kickable) await member.kick(`AutoMod: ${reason}`).catch(() => {});
  else if (action === 'ban' && member?.bannable) await member.ban({ reason: `AutoMod: ${reason}` }).catch(() => {});
}

export async function processAutoMod(message, client) {
  if (!message?.guild || message.author?.bot) return false;
  const config = await getSecurityConfig(client, message.guild.id);
  const a = config.autoMod;
  if (!config.enabled || !a?.enabled || config.ignoredChannels?.includes(message.channel.id) || isWhitelisted(message.member, config)) return false;

  const now = Date.now();
  const data = autoModData(message.guild.id, message.author.id);
  data.messages = data.messages.filter(t => now - t <= 60000);
  data.repeats = data.repeats.filter(x => now - x.time <= 60000);
  data.messages.push(now);
  data.repeats.push({ time: now, content: normalizeMessage(message.content) });

  const content = message.content || '';
  const violations = [];
  if (a.spam.enabled && data.messages.filter(t => now - t <= a.spam.windowMs).length >= a.spam.maxMessages) violations.push({ type: 'spam', reason: `message spam (${a.spam.maxMessages}/${Math.round(a.spam.windowMs / 1000)}s)` });
  if (a.duplicate.enabled && data.repeats.filter(x => now - x.time <= a.duplicate.windowMs && x.content === normalizeMessage(content)).length >= a.duplicate.maxRepeats) violations.push({ type: 'duplicate', reason: `duplicate spam (${a.duplicate.maxRepeats})` });
  const mentions = message.mentions.users.size + message.mentions.roles.size;
  if (a.mentions.enabled && mentions >= a.mentions.max) violations.push({ type: 'mentions', reason: `mention spam (${mentions})` });
  if (a.invites.enabled && /(?:discord\.gg|discord(?:app)?\.com\/invite)\/\S+/i.test(content)) violations.push({ type: 'invites', reason: 'Discord invite' });
  if (a.links.enabled && /https?:\/\/\S+/i.test(content)) violations.push({ type: 'links', reason: 'link spam' });
  if (a.caps.enabled && content.length >= a.caps.minLength && capRatio(content) >= a.caps.ratio) violations.push({ type: 'caps', reason: 'excessive caps' });
  if (a.badWords.enabled && a.badWords.words?.some(word => word && content.toLowerCase().includes(String(word).toLowerCase()))) violations.push({ type: 'badWords', reason: 'blocked word' });
  if (!violations.length) return false;

  const reason = violations.map(v => v.reason).join(', ');
  const strike = await addStrike(client, message.guild.id, message.author.id, reason);
  const escalation = config.escalation?.find(item => item.strike === strike.count);
  const primary = violations[0];
  const action = (escalation?.action || a[primary.type]?.punishment || a.action || 'delete') === 'warn' ? 'delete' : (escalation?.action || a[primary.type]?.punishment || a.action || 'delete');
  const duration = escalation?.durationMs || 60000;

  await message.delete().catch(() => {});
  await executeAutoModAction(message, action, duration, reason);
  await sendSecurityLog(client, message.guild, { title: 'AutoMod Triggered', description: `AutoMod acted on **${message.author.tag}**.`, fields: [
    { name: 'Rule', value: primary.type, inline: true },
    { name: 'Reason', value: reason.slice(0, 1024), inline: true },
    { name: 'Strike', value: String(strike.count), inline: true },
    { name: 'Action', value: action, inline: true },
  ] });
  return true;
}
