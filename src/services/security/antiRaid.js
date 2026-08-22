import { PermissionFlagsBits } from 'discord.js';
import { getSecurityConfig, isWhitelisted, sendSecurityLog } from './securityService.js';

const joins = new Map();
const lockdowns = new Map();

async function restoreLockdown(guild, state) {
  if (!state) return;

  for (const [channelId, previous] of state.channels) {
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.permissionOverwrites?.edit) continue;

    const everyoneId = guild.roles.everyone.id;
    const current = channel.permissionOverwrites.cache.get(everyoneId);

    if (!previous) {
      if (current) await current.delete('Anti-Raid lockdown ended').catch(() => {});
      continue;
    }

    const sendMessages = previous.sendMessages === null
      ? null
      : previous.sendMessages;

    await channel.permissionOverwrites.edit(
      guild.roles.everyone,
      { SendMessages: sendMessages },
      { reason: 'Anti-Raid lockdown ended' },
    ).catch(() => {});
  }
}

async function startLockdown(guild, config) {
  if (lockdowns.has(guild.id)) return;

  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) return;

  const state = {
    expiresAt: Date.now() + config.antiRaid.lockdownMs,
    channels: new Map(),
  };

  for (const channel of guild.channels.cache.values()) {
    if (!channel.permissionOverwrites?.edit || channel.isThread?.()) continue;

    const everyoneOverwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
    state.channels.set(channel.id, {
      sendMessages: everyoneOverwrite?.deny?.has(PermissionFlagsBits.SendMessages)
        ? false
        : everyoneOverwrite?.allow?.has(PermissionFlagsBits.SendMessages)
          ? true
          : null,
    });

    await channel.permissionOverwrites.edit(
      guild.roles.everyone,
      { SendMessages: false },
      { reason: 'Anti-Raid lockdown' },
    ).catch(() => {});
  }

  lockdowns.set(guild.id, state);

  const timer = setTimeout(async () => {
    const current = lockdowns.get(guild.id);
    if (current !== state) return;
    lockdowns.delete(guild.id);
    await restoreLockdown(guild, state);
    await sendSecurityLog(guild.client, guild, {
      title: 'Anti-Raid Lockdown Ended',
      description: 'The temporary raid lockdown has ended and previous channel permissions were restored.',
      color: 0x57F287,
    });
  }, Math.max(1000, config.antiRaid.lockdownMs));

  timer.unref?.();
}

export async function handleMemberJoin(member) {
  const guild = member.guild;
  const client = guild.client;
  const config = await getSecurityConfig(client, guild.id);
  if (!config.enabled || !config.antiRaid.enabled || isWhitelisted(member, config)) return;

  const now = Date.now();
  const listKey = guild.id;
  const list = (joins.get(listKey) || []).filter(t => now - t <= config.antiRaid.windowMs);
  list.push(now);
  joins.set(listKey, list);

  const accountTooNew = now - member.user.createdTimestamp < config.antiRaid.minAccountAgeMs;
  const raidDetected = list.length >= config.antiRaid.joins;
  const flagged = raidDetected || accountTooNew;

  if (flagged) {
    const reason = raidDetected ? 'raid detected' : 'new account';

    if (config.antiRaid.action === 'kick' && member.kickable) {
      await member.kick(`Anti-Raid: ${reason}`).catch(() => {});
    } else if (member.moderatable) {
      await member.timeout(config.antiRaid.timeoutMs, `Anti-Raid: ${reason}`).catch(() => {});
    }

    await sendSecurityLog(client, guild, {
      title: raidDetected ? 'Raid Detected' : 'New Account Protection',
      description: `${member} was flagged by Anti-Raid.`,
      fields: [
        { name: 'Account Age', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Joins in Window', value: String(list.length), inline: true },
        { name: 'Action', value: config.antiRaid.action, inline: true },
      ],
    });
  }

  if (raidDetected && config.antiRaid.lockdown) {
    await startLockdown(guild, config);
  }
}

export async function clearRaidLockdown(guild) {
  const state = lockdowns.get(guild.id);
  if (!state) return false;
  lockdowns.delete(guild.id);
  await restoreLockdown(guild, state);
  return true;
}

export function isRaidLockdownActive(guildId) {
  const state = lockdowns.get(guildId);
  return Boolean(state && state.expiresAt > Date.now());
}
