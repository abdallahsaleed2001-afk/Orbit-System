import { getSecurityConfig, isWhitelisted, addStrike, sendSecurityLog } from './securityService.js';

const userMessages = new Map();
const duplicates = new Map();
const inviteRegex = /(discord\.gg|discord(?:app)?\.com\/invite)\/[^\s]+/i;
const urlRegex = /https?:\/\/[^\s]+/i;
const repeatedCharRegex = /(.)\1{8,}/u;

function getState(map, key) {
  if (!map.has(key)) map.set(key, []);
  return map.get(key);
}

function detect(message, config) {
  const text = message.content || '';
  const lower = text.toLowerCase();
  const reasons = [];
  const now = Date.now();
  const key = `${message.guild.id}:${message.author.id}`;

  if (config.autoMod.spam.enabled) {
    const list = getState(userMessages, key).filter(t => now - t <= config.autoMod.spam.windowMs);
    list.push(now);
    userMessages.set(key, list);
    if (list.length >= config.autoMod.spam.maxMessages) reasons.push('message spam');
  }

  const normalized = text.trim().slice(0, 500);
  if (config.autoMod.duplicate.enabled && normalized) {
    const list = getState(duplicates, key).filter(x => now - x.time <= config.autoMod.duplicate.windowMs);
    list.push({ text: normalized, time: now });
    duplicates.set(key, list);
    const repeats = list.filter(x => x.text === normalized).length;
    if (repeats >= config.autoMod.duplicate.maxRepeats) reasons.push('duplicate messages');
  }

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (config.autoMod.mentions.enabled && mentionCount >= config.autoMod.mentions.max) reasons.push('mention spam');
  if (config.autoMod.mentions.enabled && (message.mentions.everyone || /@(everyone|here)/i.test(text))) reasons.push('everyone/here mention');
  if (config.autoMod.invites.enabled && inviteRegex.test(text)) reasons.push('Discord invite link');
  if (config.autoMod.links.enabled && urlRegex.test(text)) reasons.push('external link');
  if (config.autoMod.badWords.enabled && config.autoMod.badWords.words.some(word => {
    const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\s)${escaped}(?=$|\\s|[.!?,])`, 'i').test(text);
  })) reasons.push('blocked word');
  if (repeatedCharRegex.test(text)) reasons.push('character spam');

  if (config.autoMod.caps.enabled) {
    const letters = text.match(/[A-Za-z]/g) || [];
    const upper = text.match(/[A-Z]/g) || [];
    if (letters.length >= config.autoMod.caps.minLength && upper.length / letters.length >= config.autoMod.caps.ratio) {
      reasons.push('excessive caps');
    }
  }

  return [...new Set(reasons)];
}

async function executeAction(message, reason, config) {
  const deleted = await message.delete().then(() => true).catch(() => false);
  const strike = await addStrike(message.client, message.guild.id, message.author.id, reason);
  const level = Math.min(strike.count, config.escalation.length);
  const escalation = config.escalation[level - 1];
  let action = config.autoMod.action;

  if (escalation?.action && escalation.action !== 'warn') action = escalation.action;
  if (escalation?.action === 'warn') action = 'warn';

  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (member && !isWhitelisted(member, config)) {
    if (action === 'timeout' && member.moderatable) {
      await member.timeout(escalation?.durationMs || 60000, `AutoMod: ${reason}`).catch(() => {});
    } else if (action === 'kick' && member.kickable) {
      await member.kick(`AutoMod: ${reason}`).catch(() => {});
    } else if (action === 'ban' && member.bannable) {
      await member.ban({ reason: `AutoMod: ${reason}` }).catch(() => {});
    }
  }

  if (action === 'warn' && !message.channel.isDMBased?.()) {
    const warning = await message.channel.send({
      content: `${message.author}, warning: **${reason}**. Strike **${strike.count}**.`,
      allowedMentions: { users: [message.author.id] },
    }).catch(() => null);
    if (warning) {
      const timer = setTimeout(() => warning.delete().catch(() => {}), 5000);
      timer.unref?.();
    }
  }

  await sendSecurityLog(message.client, message.guild, {
    title: 'AutoMod Action',
    description: `${message.author} triggered AutoMod.`,
    fields: [
      { name: 'Reason', value: reason.slice(0, 1024), inline: true },
      { name: 'Strike', value: String(strike.count), inline: true },
      { name: 'Action', value: action, inline: true },
      { name: 'Message Deleted', value: deleted ? 'Yes' : 'No', inline: true },
    ],
  });
}

export async function handleAutoMod(message) {
  if (!message.guild || message.author.bot) return false;
  const config = await getSecurityConfig(message.client, message.guild.id);
  if (!config.enabled || !config.autoMod.enabled || config.ignoredChannels?.includes(message.channel.id)) return false;

  const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member || member.id === message.guild.ownerId || isWhitelisted(member, config)) return false;

  const reasons = detect(message, config);
  if (!reasons.length) return false;
  await executeAction(message, reasons.join(', '), config);
  return true;
}
