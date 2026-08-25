import { PermissionFlagsBits } from 'discord.js';

export const EMERGENCY_ADMIN_CATEGORY_ID = '1534949380757393439';

const state = new Map();

export async function emergencyLockdown(guild, reason = 'Emergency lockdown') {
  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) throw new Error('Bot needs Manage Channels permission.');

  const key = guild.id;
  if (state.has(key)) return { active: true, changed: 0 };

  const snapshots = new Map();
  for (const channel of guild.channels.cache.values()) {
    if (!channel?.permissionOverwrites || channel.parentId === EMERGENCY_ADMIN_CATEGORY_ID || channel.id === EMERGENCY_ADMIN_CATEGORY_ID) continue;
    const everyone = guild.roles.everyone;
    const existing = channel.permissionOverwrites.cache.get(everyone.id);
    snapshots.set(channel.id, existing ? { allow: existing.allow.bitfield.toString(), deny: existing.deny.bitfield.toString() } : null);
    await channel.permissionOverwrites.edit(everyone, { SendMessages: false, AddReactions: false, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false }, { reason }).catch(() => {});
  }
  state.set(key, snapshots);
  return { active: true, changed: snapshots.size };
}

export async function releaseEmergencyLockdown(guild, reason = 'Emergency lockdown released') {
  const snapshots = state.get(guild.id);
  if (!snapshots) return { active: false, changed: 0 };

  for (const [channelId, snapshot] of snapshots) {
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.permissionOverwrites) continue;
    const everyone = guild.roles.everyone;
    if (!snapshot) await channel.permissionOverwrites.delete(everyone, reason).catch(() => {});
    else await channel.permissionOverwrites.edit(everyone, { allow: BigInt(snapshot.allow), deny: BigInt(snapshot.deny) }, { reason }).catch(() => {});
  }
  state.delete(guild.id);
  return { active: false, changed: snapshots.size };
}

export function isEmergencyLockdownActive(guildId) { return state.has(guildId); }
