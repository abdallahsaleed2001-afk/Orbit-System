// warningService.js

import { db, getFromDb, setInDb, getWarningsKey, getWarningsPrefix } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { createError, ErrorTypes, wrapServiceClassMethods } from '../../utils/errorHandler.js';

export const WARNING_ROLES = Object.freeze({
  1: '1534937998561644624',
  2: '1534938090571829442',
  3: '1534938171551387799',
});

class WarningService {
  static async addWarning({ guildId, userId, moderatorId, reason, timestamp = Date.now() }) {
    const key = getWarningsKey(guildId, userId);
    const warnings = await getFromDb(key, []);
    if (!Array.isArray(warnings)) {
      logger.warn(`Warnings for ${userId} in ${guildId} corrupted, resetting`);
      await setInDb(key, []);
      throw createError('Corrupted warning data', ErrorTypes.DATABASE, 'Warning data was corrupted and has been reset. Please try again.', { guildId, userId, service: 'warningService', operation: 'addWarning' });
    }
    const warning = { id: Date.now(), guildId, userId, moderatorId, reason, timestamp, status: 'active', caseId: null };
    warnings.push(warning);
    await setInDb(key, warnings);
    logger.info(`Warning added: ${userId} in ${guildId} by ${moderatorId}`);
    return { id: warning.id, totalCount: warnings.length };
  }

  static async attachCaseId(guildId, userId, warningId, caseId) {
    const key = getWarningsKey(guildId, userId);
    const warnings = await getFromDb(key, []);
    const warning = Array.isArray(warnings) ? warnings.find(w => String(w.id) === String(warningId)) : null;
    if (!warning) return false;
    warning.caseId = caseId;
    await setInDb(key, warnings);
    return true;
  }

  static async getWarnings(guildId, userId) {
    const warnings = await getFromDb(getWarningsKey(guildId, userId), []);
    return Array.isArray(warnings) ? warnings.filter(w => w && w.status !== 'deleted') : [];
  }

  static async getWarningCount(guildId, userId) {
    return (await this.getWarnings(guildId, userId)).length;
  }

  static async removeWarning(guildId, userId, warningId) {
    const key = getWarningsKey(guildId, userId);
    const warnings = await getFromDb(key, []);
    const index = warnings.findIndex(w => String(w.id) === String(warningId));
    if (index === -1) throw createError('Warning not found', ErrorTypes.USER_INPUT, 'That warning could not be found. It may have already been removed.', { guildId, userId, warningId, service: 'warningService', operation: 'removeWarning' });
    warnings[index].status = 'deleted';
    await setInDb(key, warnings);
    logger.info(`Warning removed: ${warningId} for ${userId} in ${guildId}`);
    return { removed: true, warning: warnings[index] };
  }

  static async clearWarnings(guildId, userId) {
    const key = getWarningsKey(guildId, userId);
    const warnings = await getFromDb(key, []);
    const count = Array.isArray(warnings) ? warnings.length : 0;
    await setInDb(key, []);
    logger.info(`Warnings cleared for ${userId} in ${guildId} (${count} removed)`);
    return { count };
  }

  static async getGuildWarnings(guildId, filters = {}, legacyFilters = undefined) {
    if (typeof guildId === 'object' && typeof filters === 'string') {
      guildId = filters;
      filters = legacyFilters || {};
    }

    const { moderatorId, limit = 100 } = filters || {};
    const prefix = getWarningsPrefix(guildId);
    const keys = await db.list(prefix);
    const allWarnings = [];

    for (const key of Array.isArray(keys) ? keys : []) {
      const warnings = await getFromDb(key, []);
      if (!Array.isArray(warnings)) continue;
      for (const warning of warnings) {
        if (!warning || warning.status === 'deleted') continue;
        if (moderatorId && warning.moderatorId !== moderatorId) continue;
        allWarnings.push(warning);
      }
    }

    allWarnings.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    logger.debug(`Fetched guild warnings for ${guildId} with ${allWarnings.length} total`);
    return allWarnings.slice(0, limit);
  }
}

export async function applyWarningEscalation({ guild, member, moderator, warningCount, reason, client }) {
  if (!guild || !member || !moderator || !warningCount) return { level: warningCount, action: 'none' };

  const botMember = guild.members.me;
  if (!botMember) return { level: warningCount, action: 'none' };

  const warningRoleIds = Object.values(WARNING_ROLES);
  const result = { level: warningCount, action: 'none', roleId: null, caseId: null };

  if (warningCount <= 3) {
    const roleId = WARNING_ROLES[warningCount];
    const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      logger.warn(`Warning role ${roleId} not found in ${guild.id}`);
      return result;
    }

    for (const oldRoleId of warningRoleIds) {
      if (oldRoleId === roleId || !member.roles.cache.has(oldRoleId)) continue;
      const oldRole = guild.roles.cache.get(oldRoleId);
      if (oldRole && oldRole.position < botMember.roles.highest.position) {
        await member.roles.remove(oldRole, `Warning escalation: ${warningCount} active warnings`).catch(() => {});
      }
    }

    if (!member.roles.cache.has(roleId)) {
      if (role.position >= botMember.roles.highest.position) {
        logger.warn(`Warning role ${roleId} is above the bot role in ${guild.id}`);
        return result;
      }
      await member.roles.add(role, `Warning escalation: warning ${warningCount}`);
    }

    result.action = 'warning_role';
    result.roleId = roleId;
    return result;
  }

  if (warningCount === 4) {
    if (!member.moderatable) {
      logger.warn(`Cannot timeout member for warning escalation: ${member.id}`);
      return result;
    }
    const durationMs = 24 * 60 * 60 * 1000;
    await member.timeout(durationMs, `Warning escalation #4: ${reason || '4 active warnings'}`);
    result.action = 'timeout';
    result.durationMs = durationMs;
    return result;
  }

  if (warningCount >= 5) {
    if (!member.kickable) {
      logger.warn(`Cannot kick member for warning escalation: ${member.id}`);
      return result;
    }
    await member.kick(`Warning escalation #${warningCount}: ${reason || '5+ active warnings'}`);
    result.action = 'kick';
    return result;
  }

  return result;
}

export async function syncWarningRoles(guild, userId) {
  if (!guild || !userId) return { count: 0, roleId: null };

  const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
  if (!member) return { count: 0, roleId: null };

  const botMember = guild.members.me;
  if (!botMember) return { count: 0, roleId: null };

  const warnings = await WarningService.getWarnings(guild.id, userId);
  const count = warnings.length;
  const desiredRoleId = count >= 1 && count <= 3 ? WARNING_ROLES[count] : null;

  for (const roleId of Object.values(WARNING_ROLES)) {
    if (!member.roles.cache.has(roleId)) continue;
    const role = guild.roles.cache.get(roleId);
    if (role && role.position < botMember.roles.highest.position && roleId !== desiredRoleId) {
      await member.roles.remove(role, 'Warning appeal approved / warning role reconciliation').catch(() => {});
    }
  }

  if (desiredRoleId && !member.roles.cache.has(desiredRoleId)) {
    const role = guild.roles.cache.get(desiredRoleId) || await guild.roles.fetch(desiredRoleId).catch(() => null);
    if (role && role.position < botMember.roles.highest.position) {
      await member.roles.add(role, 'Warning role reconciliation').catch(() => {});
    }
  }

  return { count, roleId: desiredRoleId };
}

wrapServiceClassMethods(WarningService);
export { WarningService };
