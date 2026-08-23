import { getFromDb, setInDb } from '../utils/database.js';

const key = (guildId) => `guild:${guildId}:staff`;

const DEFAULTS = {
  config: { promotionChannelId: null, demotionChannelId: null, warningChannelId: null, notesChannelId: null, managerRoleId: null, warningsBeforeReview: 3 },
  members: {},
};

function normalize(data) {
  const value = data && typeof data === 'object' ? data : {};
  return { config: { ...DEFAULTS.config, ...(value.config || {}) }, members: value.members && typeof value.members === 'object' ? value.members : {} };
}

export async function getStaffData(guildId) { return normalize(await getFromDb(key(guildId), DEFAULTS)); }
export async function saveStaffData(guildId, data) { const normalized = normalize(data); await setInDb(key(guildId), normalized); return normalized; }

export async function getStaffProfile(guildId, userId, defaults = {}) {
  const data = await getStaffData(guildId);
  const existing = data.members[userId] || {};
  return { userId, joinedAt: existing.joinedAt || defaults.joinedAt || new Date().toISOString(), warnings: Array.isArray(existing.warnings) ? existing.warnings : [], promotions: Array.isArray(existing.promotions) ? existing.promotions : [], demotions: Array.isArray(existing.demotions) ? existing.demotions : [], notes: Array.isArray(existing.notes) ? existing.notes : [], activity: existing.activity && typeof existing.activity === 'object' ? existing.activity : {}, ...existing };
}

export async function ensureStaffMember(guildId, userId, defaults = {}) { const data = await getStaffData(guildId); const profile = await getStaffProfile(guildId, userId, defaults); data.members[userId] = profile; await saveStaffData(guildId, data); return profile; }
export async function updateStaffConfig(guildId, patch) { const data = await getStaffData(guildId); data.config = { ...data.config, ...patch }; return saveStaffData(guildId, data); }

export async function addStaffWarning(guildId, userId, issuerId, reason) {
  const data = await getStaffData(guildId); const profile = await getStaffProfile(guildId, userId);
  const warning = { id: `sw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, reason: String(reason).trim(), issuerId, createdAt: new Date().toISOString() };
  profile.warnings.push(warning); data.members[userId] = profile; await saveStaffData(guildId, data); return warning;
}
export async function removeStaffWarning(guildId, userId, warningId) { const data = await getStaffData(guildId); const profile = await getStaffProfile(guildId, userId); const before = profile.warnings.length; profile.warnings = profile.warnings.filter((warning) => warning.id !== warningId); data.members[userId] = profile; await saveStaffData(guildId, data); return before !== profile.warnings.length; }

export async function addPromotion(guildId, userId, record) { const data = await getStaffData(guildId); const profile = await getStaffProfile(guildId, userId); profile.promotions.push({ id: `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...record, createdAt: new Date().toISOString() }); data.members[userId] = profile; await saveStaffData(guildId, data); return profile.promotions.at(-1); }
export async function addDemotion(guildId, userId, record) { const data = await getStaffData(guildId); const profile = await getStaffProfile(guildId, userId); profile.demotions.push({ id: `sd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...record, createdAt: new Date().toISOString() }); data.members[userId] = profile; await saveStaffData(guildId, data); return profile.demotions.at(-1); }
export async function addStaffNote(guildId, userId, authorId, note) { const data = await getStaffData(guildId); const profile = await getStaffProfile(guildId, userId); profile.notes.push({ id: `sn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, note: String(note).trim(), authorId, createdAt: new Date().toISOString() }); data.members[userId] = profile; await saveStaffData(guildId, data); return profile.notes.at(-1); }

export async function incrementStaffActivity(guildId, userId, type, amount = 1) { const data = await getStaffData(guildId); const profile = await getStaffProfile(guildId, userId); profile.activity = profile.activity || {}; profile.activity[type] = Math.max(0, Number(profile.activity[type] || 0) + Number(amount || 0)); profile.activity.lastActiveAt = new Date().toISOString(); data.members[userId] = profile; await saveStaffData(guildId, data); return profile; }

export function calculateActivityScore(profile) {
  const activity = profile?.activity || {};
  const moderation = Number(activity.moderationActions || 0);
  const tickets = Number(activity.ticketsHandled || 0);
  const events = Number(activity.eventsManaged || 0);
  const commands = Number(activity.commands || 0);
  const messages = Number(activity.messages || 0);
  return Math.round(Math.min(100, moderation * 0.4 + tickets * 0.35 + events * 5 + commands * 0.05 + messages * 0.01));
}

export function countWarnings(profile) { return Array.isArray(profile?.warnings) ? profile.warnings.length : 0; }
export function getStaffLeaderboard(data, limit = 10) { return Object.entries(data?.members || {}).map(([userId, profile]) => ({ userId, profile, score: calculateActivityScore(profile) })).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(25, Number(limit) || 10))); }
