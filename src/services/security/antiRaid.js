import { PermissionFlagsBits } from 'discord.js';
import { getSecurityConfig, isWhitelisted, sendSecurityLog } from './securityService.js';

const joins = new Map();
const lockdowns = new Map();

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

  if (raidDetected || accountTooNew) {
    if (config.antiRaid.action === 'kick' && member.kickable) {
      await member.kick(`Anti-Raid: ${raidDetected ? 'raid detected' : 'new account'}`).catch(() => {});
    } else if (member.moderatable) {
      await member.timeout(config.antiRaid.timeoutMs, `Anti-Raid: ${raidDetected ? 'raid detected' : 'new account'}`).catch(() => {});
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

  if (raidDetected && config.antiRaid.lockdown && !lockdowns.has(guild.id)) {
    lockdowns.set(guild.id, Date.now() + config.antiRaid.lockdownMs);
    const me = guild.members.me;
    if (me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      for (const channel of guild.channels.cache.values()) {
        if (!channel.isTextBased?.() || !channel.permissionOverwrites?.edit) continue;
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }, { reason: 'Anti-Raid lockdown' }).catch(() => {});
      }
    }
    setTimeout(() => lockdowns.delete(guild.id), config.antiRaid.lockdownMs).unref?.();
  }
}
