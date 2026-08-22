import { buildSecurityPanel, buildSecurityPanelControls, buildSecurityDashboard, buildSecurityControls } from '../../../commands/Security/security.js';
import { getSecurityConfig, getStrikes, clearStrikes } from '../../../services/security/securityService.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

const owned = interaction => interaction.customId.split(':').at(-1) === interaction.user.id;
const deny = interaction => interaction.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });
const btn = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);

async function dashboard(i, c) {
  const config = await getSecurityConfig(c, i.guildId);
  return i.update({ embeds: [buildSecurityDashboard(config, i.guild)], components: buildSecurityControls(i.user.id) });
}

async function panel(i, c, type) {
  const config = await getSecurityConfig(c, i.guildId);
  return i.update({ embeds: [buildSecurityPanel(config, i.guild, type)], components: buildSecurityPanelControls(i.user.id, type, config) });
}

async function strikes(i, c) {
  const members = await i.guild.members.fetch().catch(() => i.guild.members.cache);
  const entries = [];
  for (const member of members.values()) {
    if (member.user.bot) continue;
    const strike = await getStrikes(c, i.guildId, member.id).catch(() => ({ count: 0 }));
    if (Number(strike?.count || 0) > 0) entries.push({ id: member.id, count: Number(strike.count) });
  }
  entries.sort((a, b) => b.count - a.count);
  const description = entries.slice(0, 10).map((x, n) => `${n + 1}. <@${x.id}> — **${x.count}** strikes`).join('\n') || 'No active strikes.';
  const rows = [row(btn(`security_back:${i.user.id}`, '← Back'), btn(`security_strikes_refresh:${i.user.id}`, '🔄 Refresh', ButtonStyle.Success))];
  for (let n = 0; n < Math.min(entries.length, 8); n += 4) rows.push(row(...entries.slice(n, n + 4).map(x => btn(`strike_manage2:${x.id}:${i.user.id}`, `<@${x.id}>`, ButtonStyle.Primary))));
  return i.update({ embeds: [new EmbedBuilder().setAuthor({ name: 'Infinity Security Center', iconURL: i.guild.iconURL({ size: 128 }) || undefined }).setTitle('🏆 Strikes').setDescription(`**${i.guild.name}**\n\n${description}`).setColor(0xfee75c)], components: rows });
}

const panels = ['nuke', 'raid', 'automod', 'punishments', 'strikes', 'whitelist', 'logs', 'settings'];

export default [
  ...panels.flatMap(type => [
    { name: `security_panel_${type}`, execute: async (i, c) => { if (!owned(i)) return deny(i); return type === 'strikes' ? strikes(i, c) : panel(i, c, type); } },
    { name: `security_panel_${type}2`, execute: async (i, c) => { if (!owned(i)) return deny(i); return type === 'strikes' ? strikes(i, c) : panel(i, c, type); } },
  ]),
  { name: 'security_back', execute: async (i, c) => owned(i) ? dashboard(i, c) : deny(i) },
  { name: 'security_back2', execute: async (i, c) => owned(i) ? dashboard(i, c) : deny(i) },
  { name: 'security_refresh', execute: async (i, c) => owned(i) ? dashboard(i, c) : deny(i) },
  { name: 'security_strikes_refresh', execute: async (i, c) => owned(i) ? strikes(i, c) : deny(i) },
  { name: 'strikes_refresh2', execute: async (i, c) => owned(i) ? strikes(i, c) : deny(i) },
  { name: 'strike_reset2', execute: async (i, c, args) => { if (!owned(i)) return deny(i); await clearStrikes(c, i.guildId, args[0]); return strikes(i, c); } },
];