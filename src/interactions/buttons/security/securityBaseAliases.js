import { buildSecurityPanel, buildSecurityPanelControls, buildSecurityDashboard, buildSecurityControls } from '../../../commands/Security/security.js';
import { getSecurityConfig, getStrikes, clearStrikes, updateSecurityConfig } from '../../../services/security/securityService.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

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
    const count = Number(strike?.count || 0);
    if (count > 0) entries.push({ id: member.id, count });
  }
  entries.sort((a, b) => b.count - a.count);
  const description = entries.slice(0, 10).map((x, n) => `${n + 1}. <@${x.id}> — **${x.count}** strikes`).join('\n') || 'No active strikes.';
  const rows = [row(btn(`security_back:${i.user.id}`, '← Back'), btn(`security_strikes_refresh:${i.user.id}`, '🔄 Refresh', ButtonStyle.Success))];
  for (let n = 0; n < Math.min(entries.length, 8); n += 4) {
    rows.push(row(...entries.slice(n, n + 4).map(x => btn(`strike_manage2:${x.id}:${i.user.id}`, `<@${x.id}>`, ButtonStyle.Primary))));
  }
  return i.update({ embeds: [new EmbedBuilder().setAuthor({ name: 'Infinity Security Center', iconURL: i.guild.iconURL({ size: 128 }) || undefined }).setTitle('🏆 Strikes').setDescription(`**${i.guild.name}**\n\n${description}`).setColor(0xfee75c)], components: rows });
}

async function whitelist(i, c) {
  const config = await getSecurityConfig(c, i.guildId);
  return i.update({ embeds: [new EmbedBuilder().setAuthor({ name: 'Infinity Security Center', iconURL: i.guild.iconURL({ size: 128 }) || undefined }).setTitle('👤 Whitelist').setDescription(`Trusted users, roles and bots bypass security actions.\n\n**Users:** ${config.whitelist?.users?.length || 0}\n**Roles:** ${config.whitelist?.roles?.length || 0}\n**Bots:** ${config.whitelist?.bots?.length || 0}`).setColor(0x57f287)], components: [row(btn(`security_back:${i.user.id}`, '← Back'), btn(`security_whitelist_users:${i.user.id}`, '👤 Users', ButtonStyle.Primary), btn(`security_whitelist_roles:${i.user.id}`, '🎭 Roles', ButtonStyle.Primary), btn(`security_whitelist_bots:${i.user.id}`, '🤖 Bots', ButtonStyle.Primary))] });
}

async function whitelistModal(i, c, type, title, label) {
  const config = await getSecurityConfig(c, i.guildId);
  const current = Array.isArray(config.whitelist?.[type]) ? config.whitelist[type] : [];
  return i.showModal(new ModalBuilder().setCustomId(`security_whitelist_${type}_modal:${i.user.id}`).setTitle(title).addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel(label).setPlaceholder('ID or mention, multiple values supported').setStyle(TextInputStyle.Paragraph).setRequired(false).setValue(current.join('\n').slice(0, 4000))));
}

const panels = ['nuke', 'raid', 'automod', 'punishments', 'strikes', 'whitelist', 'logs', 'settings'];
const panelHandlers = panels.flatMap(type => [
  { name: `security_panel_${type}`, execute: async (i, c) => { if (!owned(i)) return deny(i); return type === 'strikes' ? strikes(i, c) : type === 'whitelist' ? whitelist(i, c) : panel(i, c, type); } },
  { name: `security_panel_${type}2`, execute: async (i, c) => { if (!owned(i)) return deny(i); return type === 'strikes' ? strikes(i, c) : type === 'whitelist' ? whitelist(i, c) : panel(i, c, type); } },
]);

export default [
  ...panelHandlers,
  { name: 'security_back', execute: async (i, c) => owned(i) ? dashboard(i, c) : deny(i) },
  { name: 'security_back2', execute: async (i, c) => owned(i) ? dashboard(i, c) : deny(i) },
  { name: 'security_refresh', execute: async (i, c) => owned(i) ? dashboard(i, c) : deny(i) },
  { name: 'security_strikes_refresh', execute: async (i, c) => owned(i) ? strikes(i, c) : deny(i) },
  { name: 'strikes_refresh2', execute: async (i, c) => owned(i) ? strikes(i, c) : deny(i) },
  { name: 'strike_reset2', execute: async (i, c, args) => { if (!owned(i)) return deny(i); await clearStrikes(c, i.guildId, args[0]); return strikes(i, c); } },
  { name: 'security_whitelist_users', execute: async (i, c) => owned(i) ? whitelistModal(i, c, 'users', 'Whitelist Users', 'User IDs') : deny(i) },
  { name: 'security_whitelist_roles', execute: async (i, c) => owned(i) ? whitelistModal(i, c, 'roles', 'Whitelist Roles', 'Role IDs') : deny(i) },
  { name: 'security_whitelist_bots', execute: async (i, c) => owned(i) ? whitelistModal(i, c, 'bots', 'Whitelist Bots', 'Bot IDs') : deny(i) },
  { name: 'security_whitelist_user', execute: async (i, c) => owned(i) ? whitelistModal(i, c, 'users', 'Whitelist Users', 'User IDs') : deny(i) },
  { name: 'security_whitelist_role', execute: async (i, c) => owned(i) ? whitelistModal(i, c, 'roles', 'Whitelist Roles', 'Role IDs') : deny(i) },
  { name: 'security_whitelist_bot', execute: async (i, c) => owned(i) ? whitelistModal(i, c, 'bots', 'Whitelist Bots', 'Bot IDs') : deny(i) },
];