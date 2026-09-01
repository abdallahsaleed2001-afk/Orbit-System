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

function normalizeArabic(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .trim();
}

function isNaturalRepeat(text) {
  const normalized = normalizeArabic(text).replace(/[\s.,!?،؛:()[\]{}*_~`'"“”‘’]+/g, '');
  if (!normalized) return false;

  // Natural laughter is not considered intentional spam, even when embedded in normal text.
  if (/ه{3,}/u.test(normalized)) return true;

  const words = normalizeArabic(text).split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.every(word => {
    const clean = word.replace(/[.,!?،؛:()[\]{}*_~`'"“”‘’]+/g, '');
    return /^ا?ل+ه$/u.test(clean) && clean.length >= 4;
  })) return true;

  // Treat character stretching as natural expression when the repeated character is
  // attached to an otherwise meaningful-looking word, e.g. ايواااااا / لااااا / nooooo.
  // Pure repeated characters such as aaaaaaaaaaaa are still treated as spam.
  const stretchedWord = /(?:[\p{L}\p{N}])(?:[\p{L}\p{N}]*)([\p{L}])\1{3,}(?:[\p{L}\p{N}]*)/u;
  if (stretchedWord.test(normalized)) {
    const collapsed = normalized.replace(/([\p{L}\p{N}])\1+/gu, '$1');
    const uniqueCharacters = new Set(Array.from(collapsed)).size;
    if (collapsed.length >= 2 && uniqueCharacters >= 2) return true;
  }

  return false;
}

function normalizeBlockedText(value) {
  return normalizeArabic(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .trim();
}

function matchesBlockedWord(text, blockedWord) {
  const messageWords = normalizeBlockedText(text).split(/\s+/).filter(Boolean);
  const blockedWords = normalizeBlockedText(blockedWord).split(/\s+/).filter(Boolean);
  if (!messageWords.length || !blockedWords.length) return false;

  // Match complete words (or complete multi-word phrases), never substrings.
  if (blockedWords.length === 1) return messageWords.includes(blockedWords[0]);

  for (let i = 0; i <= messageWords.length - blockedWords.length; i++) {
    if (blockedWords.every((word, offset) => messageWords[i + offset] === word)) return true;
  }
  return false;
}

function detect(message, config) {
  const text = message.content || '';
  const reasons = [];
  const now = Date.now();
  const key = `${message.guild.id}:${message.author.id}`;
  const naturalRepeat = isNaturalRepeat(text);

  if (config.autoMod.spam.enabled && !naturalRepeat) {
    const list = getState(userMessages, key).filter(t => now - t <= config.autoMod.spam.windowMs);
    list.push(now);
    userMessages.set(key, list);
    if (list.length >= config.autoMod.spam.maxMessages) reasons.push({ type: 'spam', reason: `message spam (${config.autoMod.spam.maxMessages}/${Math.round(config.autoMod.spam.windowMs / 1000)}s)` });
  }

  const normalized = text.trim().slice(0, 500).toLowerCase();
  if (config.autoMod.duplicate.enabled && normalized && !naturalRepeat) {
    const list = getState(duplicates, key).filter(x => now - x.time <= config.autoMod.duplicate.windowMs);
    list.push({ text: normalized, time: now });
    duplicates.set(key, list);
    if (list.filter(x => x.text === normalized).length >= config.autoMod.duplicate.maxRepeats) reasons.push({ type: 'duplicate', reason: `duplicate spam (${config.autoMod.duplicate.maxRepeats})` });
  }

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (config.autoMod.mentions.enabled && mentionCount >= config.autoMod.mentions.max) reasons.push({ type: 'mentions', reason: `mention spam (${mentionCount})` });
  if (config.autoMod.mentions.enabled && (message.mentions.everyone || /@(everyone|here)/i.test(text))) reasons.push({ type: 'mentions', reason: 'everyone/here mention' });
  if (config.autoMod.invites.enabled && inviteRegex.test(text)) reasons.push({ type: 'invites', reason: 'Discord invite link' });
  if (config.autoMod.links.enabled && urlRegex.test(text)) reasons.push({ type: 'links', reason: 'external link' });
  if (config.autoMod.badWords.enabled && config.autoMod.badWords.words.some(word => matchesBlockedWord(text, word))) reasons.push({ type: 'badWords', reason: 'blocked word' });
  if (!naturalRepeat && repeatedCharRegex.test(text)) reasons.push({ type: 'spam', reason: 'character spam' });

  if (config.autoMod.caps.enabled) {
    const letters = text.match(/[A-Za-z]/g) || [];
    const upper = text.match(/[A-Z]/g) || [];
    if (letters.length >= config.autoMod.caps.minLength && upper.length / letters.length >= config.autoMod.caps.ratio) reasons.push({ type: 'caps', reason: 'excessive caps' });
  }

  const seen = new Set();
  return reasons.filter(item => !seen.has(item.type) && seen.add(item.type));
}

async function executeAction(message, action, duration, reason, strike) {
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  const config = await getSecurityConfig(message.client, message.guild.id);

  if (!member || isWhitelisted(member, config)) return false;

  const deleted = await message.delete().then(() => true).catch(() => false);

  if (action === 'timeout' && member.moderatable) await member.timeout(Math.min(Math.max(duration || 60000, 1000), 2419200000), `AutoMod: ${reason}`).catch(() => {});
  else if (action === 'kick' && member.kickable) await member.kick(`AutoMod: ${reason}`).catch(() => {});
  else if (action === 'ban' && member.bannable) await member.ban({ reason: `AutoMod: ${reason}` }).catch(() => {});

  await sendSecurityLog(message.client, message.guild, {
    title: 'AutoMod Action',
    description: `${message.author} triggered AutoMod.`,
    fields: [
      { name: 'Rule', value: reason.split(':')[0].slice(0, 100), inline: true },
      { name: 'Reason', value: reason.slice(0, 900), inline: true },
      { name: 'Strike', value: String(strike.count), inline: true },
      { name: 'Action', value: action, inline: true },
      { name: 'Message Deleted', value: deleted ? 'Yes' : 'No', inline: true },
    ],
  });
  return true;
}

export async function handleAutoMod(message) {
  if (!message.guild || message.author.bot) return false;
  const config = await getSecurityConfig(message.client, message.guild.id);
  if (!config.enabled || !config.autoMod.enabled || config.ignoredChannels?.includes(message.channel.id)) return false;

  const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member || member.id === message.guild.ownerId || isWhitelisted(member, config)) return false;

  const violations = detect(message, config);
  if (!violations.length) return false;

  const latestConfig = await getSecurityConfig(message.client, message.guild.id);
  const latestMember = await message.guild.members.fetch(message.author.id).catch(() => member);
  if (!latestMember || latestMember.id === message.guild.ownerId || isWhitelisted(latestMember, latestConfig)) return false;

  const primary = violations[0];
  const reason = violations.map(v => `${v.type}: ${v.reason}`).join(', ');
  const strike = await addStrike(message.client, message.guild.id, message.author.id, reason);
  const rule = latestConfig.autoMod[primary.type] || {};
  const baseAction = rule.punishment || latestConfig.autoMod.action || 'delete';
  const escalation = strike.count > 1 ? latestConfig.escalation?.find(item => item.strike === strike.count) : null;
  const action = escalation?.action || baseAction;
  const duration = escalation?.durationMs || rule.timeoutMs || 60000;

  await executeAction(message, action, duration, reason, strike);
  return true;
}
