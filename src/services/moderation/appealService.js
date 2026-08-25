import { getFromDb, setInDb } from '../../utils/database.js';

const key = guildId => `moderation:appeals:${guildId}`;

export async function createAppeal({ guildId, userId, caseId, type, reason }) {
  const appeals = await getFromDb(key(guildId), []);
  const appeal = { id: Date.now(), guildId, userId, caseId, type, reason, status: 'pending', createdAt: Date.now() };
  appeals.push(appeal);
  await setInDb(key(guildId), appeals.slice(-500));
  return appeal;
}

export async function getAppeals(guildId, status = null) {
  const appeals = await getFromDb(key(guildId), []);
  return Array.isArray(appeals) ? appeals.filter(a => !status || a.status === status) : [];
}

export async function reviewAppeal(guildId, appealId, status, reviewerId, note = '') {
  const appeals = await getFromDb(key(guildId), []);
  const appeal = appeals.find(a => String(a.id) === String(appealId));
  if (!appeal) return null;
  appeal.status = status;
  appeal.reviewedBy = reviewerId;
  appeal.reviewedAt = Date.now();
  appeal.reviewNote = note;
  await setInDb(key(guildId), appeals);
  return appeal;
}
