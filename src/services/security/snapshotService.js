import { PermissionFlagsBits } from 'discord.js';
import { getFromDb, setInDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { getSecurityConfig, sendSecurityLog } from './securityService.js';

// ── Dangerous permissions to monitor ──────────────────────────
const DANGEROUS_PERMS = {
  [PermissionFlagsBits.Administrator.toString()]: 'Administrator',
  [PermissionFlagsBits.ManageGuild.toString()]: 'ManageServer',
  [PermissionFlagsBits.ManageChannels.toString()]: 'ManageChannels',
  [PermissionFlagsBits.ManageRoles.toString()]: 'ManageRoles',
  [PermissionFlagsBits.BanMembers.toString()]: 'BanMembers',
  [PermissionFlagsBits.KickMembers.toString()]: 'KickMembers',
  [PermissionFlagsBits.ManageWebhooks.toString()]: 'ManageWebhooks',
  [PermissionFlagsBits.ModerateMembers.toString()]: 'ModerateMembers',
  [PermissionFlagsBits.ManageMessages.toString()]: 'ManageMessages',
  [PermissionFlagsBits.MentionEveryone.toString()]: 'MentionEveryone',
  [PermissionFlagsBits.ManageNicknames.toString()]: 'ManageNicknames',
};

const DANGEROUS_FLAG_SET = new Set(Object.keys(DANGEROUS_PERMS));
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_SNAPSHOT_SIZE = 500; // max roles/channels to capture

// ── DB keys ────────────────────────────────────────────────────
function snapshotKey(guildId) { return `security:snapshot:${guildId}`; }
function snapshotPrevKey(guildId) { return `security:snapshot_prev:${guildId}`; }
function snapshotIntervalKey(guildId) { return `security:snapshot_timer:${guildId}`; }

// ── Take a snapshot of the guild's roles and channel overwrites ──
export async function takeSnapshot(guild) {
  const timestamp = Date.now();

  // Capture roles
  const roles = {};
  const sortedRoles = [...guild.roles.cache.values()].sort((a, b) => b.position - a.position);
  for (const role of sortedRoles.slice(0, MAX_SNAPSHOT_SIZE)) {
    if (role.managed) continue; // skip integration/bot roles
    roles[role.id] = {
      name: role.name,
      permissions: role.permissions.bitfield.toString(),
      position: role.position,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
    };
  }

  // Capture channel permission overwrites (only text + voice)
  const overwrites = {};
  const channels = [...guild.channels.cache.values()]
    .filter(c => c.isTextBased() || c.isVoiceBased())
    .slice(0, MAX_SNAPSHOT_SIZE);

  for (const channel of channels) {
    const ow = [];
    for (const [targetId, perm] of channel.permissionOverwrites.cache) {
      ow.push({
        id: targetId,
        type: perm.type, // 0 = role, 1 = member
        allow: perm.allow.bitfield.toString(),
        deny: perm.deny.bitfield.toString(),
      });
    }
    overwrites[channel.id] = ow;
  }

  return { timestamp, roles, overwrites };
}

// ── Store snapshot: latest becomes previous, new becomes latest ──
export async function storeSnapshot(guildId, snapshot) {
  try {
    const latestKey = snapshotKey(guildId);
    const prevKey = snapshotPrevKey(guildId);

    // Move current latest to previous
    const current = await getFromDb(latestKey, null);
    if (current) {
      await setInDb(prevKey, current);
    }

    // Store new snapshot as latest
    await setInDb(latestKey, snapshot);
    return true;
  } catch (err) {
    logger.warn('Failed to store snapshot', { guildId, error: err.message });
    return false;
  }
}

// ── Get stored snapshots ───────────────────────────────────────
export async function getSnapshots(guildId) {
  try {
    const [latest, previous] = await Promise.all([
      getFromDb(snapshotKey(guildId), null),
      getFromDb(snapshotPrevKey(guildId), null),
    ]);
    return { latest, previous };
  } catch (err) {
    logger.warn('Failed to read snapshots', { guildId, error: err.message });
    return { latest: null, previous: null };
  }
}

// ── Compare two snapshots and detect dangerous changes ──────────
export function compareSnapshots(previous, current) {
  if (!previous || !current) return { changes: [], summary: 'No baseline snapshot to compare against.' };

  const changes = [];
  const prevRoles = previous.roles || {};
  const currRoles = current.roles || {};

  // 1. Check for new dangerous permissions on existing roles
  for (const [roleId, role] of Object.entries(currRoles)) {
    const prev = prevRoles[roleId];

    if (!prev) {
      // New role created - check for dangerous perms
      const dangerous = getDangerousPerms(role.permissions);
      if (dangerous.length > 0) {
        changes.push({
          type: 'new_dangerous_role',
          severity: dangerous.includes('Administrator') ? 'critical' : 'high',
          roleId,
          roleName: role.name,
          detail: `New role "${role.name}" has dangerous permissions: ${dangerous.join(', ')}`,
          permissions: dangerous,
        });
      }
      continue;
    }

    // Existing role - check permission changes
    const prevPerms = new Set(prev.permissions.split(','));
    const currPerms = new Set(role.permissions.split(','));
    const addedPerms = [...currPerms].filter(p => !prevPerms.has(p) && DANGEROUS_FLAG_SET.has(p));

    if (addedPerms.length > 0) {
      const permNames = addedPerms.map(p => DANGEROUS_PERMS[p] || p);
      changes.push({
        type: 'role_perms_added',
        severity: addedPerms.some(p => p === PermissionFlagsBits.Administrator.toString()) ? 'critical' : 'high',
        roleId,
        roleName: role.name,
        detail: `Role "${role.name}" gained dangerous permissions: ${permNames.join(', ')}`,
        permissions: permNames,
      });
    }

    // Check for position changes (role hierarchy manipulation)
    if (role.position !== prev.position && Math.abs(role.position - prev.position) >= 3) {
      changes.push({
        type: 'role_position_change',
        severity: 'medium',
        roleId,
        roleName: role.name,
        detail: `Role "${role.name}" moved from position ${prev.position} to ${role.position}`,
      });
    }
  }

  // 2. Check for deleted roles that had dangerous permissions
  for (const [roleId, role] of Object.entries(prevRoles)) {
    if (!currRoles[roleId]) {
      const dangerous = getDangerousPerms(role.permissions);
      if (dangerous.length > 0) {
        changes.push({
          type: 'dangerous_role_deleted',
          severity: 'medium',
          roleId,
          roleName: role.name,
          detail: `Role "${role.name}" (had ${dangerous.join(', ')}) was deleted`,
          permissions: dangerous,
        });
      }
    }
  }

  // 3. Check channel overwrites for new dangerous grants
  const prevOW = previous.overwrites || {};
  const currOW = current.overwrites || {};

  for (const [channelId, overrides] of Object.entries(currOW)) {
    const prevOverrides = (prevOW[channelId] || []).reduce((map, ow) => { map[`${ow.type}:${ow.id}`] = ow; return map; }, {});

    for (const ow of overrides) {
      const key = `${ow.type}:${ow.id}`;
      const prev = prevOverrides[key];

      if (!prev) {
        // New overwrite - check for dangerous allow permissions
        const dangerous = getDangerousPerms(ow.allow);
        if (dangerous.length > 0) {
          changes.push({
            type: 'new_dangerous_overwrite',
            severity: 'high',
            channelId,
            targetId: ow.id,
            targetType: ow.type === 0 ? 'role' : 'member',
            detail: `New channel overwrite grants ${dangerous.join(', ')} to ${ow.type === 0 ? 'role' : 'member'} <${ow.id}>`,
            permissions: dangerous,
          });
        }
        continue;
      }

      // Existing overwrite - check for newly allowed dangerous perms
      const prevAllow = new Set(prev.allow.split(','));
      const currAllow = new Set(ow.allow.split(','));
      const addedAllow = [...currAllow].filter(p => !prevAllow.has(p) && DANGEROUS_FLAG_SET.has(p));

      if (addedAllow.length > 0) {
        const permNames = addedAllow.map(p => DANGEROUS_PERMS[p] || p);
        changes.push({
          type: 'overwrite_perms_added',
          severity: 'high',
          channelId,
          targetId: ow.id,
          targetType: ow.type === 0 ? 'role' : 'member',
          detail: `Channel overwrite now grants ${permNames.join(', ')} to ${ow.type === 0 ? 'role' : 'member'} <${ow.id}>`,
          permissions: permNames,
        });
      }
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  changes.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  const summary = changes.length === 0
    ? 'No dangerous changes detected since last snapshot.'
    : `Detected ${changes.length} change(s): ${changes.filter(c => c.severity === 'critical').length} critical, ${changes.filter(c => c.severity === 'high').length} high, ${changes.filter(c => c.severity === 'medium').length} medium.`;

  return { changes, summary };
}

// ── Helper: extract dangerous permission names from a bigint string ──
function getDangerousPerms(permissionsStr) {
  return (permissionsStr || '').split(',').filter(p => DANGEROUS_FLAG_SET.has(p)).map(p => DANGEROUS_PERMS[p] || p);
}

// ── Run a full snapshot cycle: capture, compare, store, report ──
export async function runSnapshotCycle(guild, client) {
  const guildId = guild.id;
  let config;
  try {
    config = await getSecurityConfig(client, guildId);
  } catch {
    return;
  }

  if (!config.snapshot?.enabled && !config._manualSnapshot) return;

  try {
    // Take new snapshot
    const newSnapshot = await takeSnapshot(guild);

    // Get previous for comparison
    const { previous } = await getSnapshots(guildId);

    // Compare
    const { changes, summary } = compareSnapshots(previous, newSnapshot);

    // Store
    await storeSnapshot(guildId, newSnapshot);

    // Report if there are changes
    if (changes.length > 0) {
      const criticalCount = changes.filter(c => c.severity === 'critical').length;
      const color = criticalCount > 0 ? 0xed4245 : changes.some(c => c.severity === 'high') ? 0xf47b67 : 0xfee75c;

      const fields = changes.slice(0, 10).map((c, i) => ({
        name: `${i + 1}. [${c.severity.toUpperCase()}] ${c.type.replace(/_/g, ' ')}`,
        value: c.detail.slice(0, 1024),
        inline: false,
      }));

      if (changes.length > 10) {
        fields.push({ name: '...and more', value: `+${changes.length - 10} additional change(s) not shown.`, inline: false });
      }

      await sendSecurityLog(client, guild, {
        title: 'Snapshot Comparison Alert',
        description: summary,
        color,
        fields,
      });

      logger.info('Snapshot comparison detected changes', { guildId, changeCount: changes.length, critical: criticalCount });
    } else {
      logger.debug('Snapshot comparison: no changes', { guildId });
    }

    return { changes, summary, timestamp: newSnapshot.timestamp };
  } catch (err) {
    logger.error('Snapshot cycle failed', { guildId, error: err.message });
    return null;
  }
}

// ── Timer management ───────────────────────────────────────────
const activeTimers = new Map();

export function startSnapshotTimer(guild, client) {
  stopSnapshotTimer(guild.id);

  const intervalMs = DEFAULT_INTERVAL_MS;
  const timer = setInterval(() => {
    runSnapshotCycle(guild, client).catch(() => {});
  }, intervalMs);

  activeTimers.set(guild.id, timer);

  // Take initial snapshot after 30 seconds (let the bot fully load)
  setTimeout(() => {
    runSnapshotCycle(guild, client).catch(() => {});
  }, 30 * 1000);

  logger.info(`Snapshot timer started for ${guild.name} (interval: ${Math.round(intervalMs / 3600000)}h)`);
}

export function stopSnapshotTimer(guildId) {
  const timer = activeTimers.get(guildId);
  if (timer) {
    clearInterval(timer);
    activeTimers.delete(guildId);
  }
}

export function isSnapshotTimerActive(guildId) {
  return activeTimers.has(guildId);
}

// ── Generate a human-readable snapshot report for the dashboard ──
export async function generateSnapshotReport(guild, client) {
  const { latest, previous } = await getSnapshots(guild.id);

  if (!latest) {
    return { title: 'No snapshot available', description: 'A snapshot will be taken automatically within 30 seconds of bot startup. You can also trigger one manually.', color: 0x5865f2, fields: [] };
  }

  const age = Date.now() - latest.timestamp;
  const ageStr = age < 60000 ? 'just now' : age < 3600000 ? `${Math.round(age / 60000)}m ago` : `${Math.round(age / 3600000)}h ago`;

  let comparison = { changes: [], summary: 'No previous snapshot to compare.' };
  if (previous) {
    comparison = compareSnapshots(previous, latest);
  }

  const roleCount = Object.keys(latest.roles || {}).length;
  const channelCount = Object.keys(latest.overwrites || {}).length;

  const fields = [
    { name: 'Last Snapshot', value: ageStr, inline: true },
    { name: 'Roles Tracked', value: String(roleCount), inline: true },
    { name: 'Channels Tracked', value: String(channelCount), inline: true },
  { name: 'Previous Snapshot', value: previous ? new Date(previous.timestamp).toLocaleString() : 'None', inline: true },
  { name: 'Changes Detected', value: String(comparison.changes.length), inline: true },
  { name: 'Status', value: comparison.changes.length === 0 ? 'All clear' : `${comparison.changes.filter(c => c.severity === 'critical').length} critical issues`, inline: true },
  ];

  if (comparison.changes.length > 0) {
    for (const change of comparison.changes.slice(0, 6)) {
      fields.push({
        name: `[${change.severity.toUpperCase()}] ${change.type.replace(/_/g, ' ')}`,
        value: change.detail.slice(0, 500),
        inline: false,
      });
    }
  }

  const color = comparison.changes.some(c => c.severity === 'critical') ? 0xed4245
    : comparison.changes.some(c => c.severity === 'high') ? 0xf47b67
    : comparison.changes.length > 0 ? 0xfee75c
    : 0x57f287;

  return {
    title: 'Snapshot Comparison',
    description: comparison.summary,
    color,
    fields,
  };
}
