import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { getSecurityConfig, updateSecurityConfig, getStrikes, clearStrikes, sendSecurityLog } from '../services/security/securityService.js';

const ok = i => i.customId.split(':').at(-1) === i.user.id;
const deny = i => i.reply({ content: 'This security dashboard belongs to another moderator.', flags: MessageFlags.Ephemeral });
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);
const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const modalField = (id, label, value = '', style = TextInputStyle.Paragraph) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(false).setValue(String(value).slice(0, 4000)));

async function whitelist(i, c) {
  const x = await getSecurityConfig(c, i.guildId);
  return i.update({
    embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('👤 Whitelist').setDescription(`الحسابات المضافة هنا تتجاوز إجراءات الحماية.\n\n**الأشخاص:** ${x.whitelist.users.length}\n**الرتب:** ${x.whitelist.roles.length}\n**البوتات:** ${x.whitelist.bots.length}`)],
    components: [row(button(`security_back2:${i.user.id}`, '← Back'), button(`wl_users2:${i.user.id}`, '👤 الأشخاص', ButtonStyle.Primary), button(`wl_roles2:${i.user.id}`, '🎭 الرتب', ButtonStyle.Primary), button(`wl_bots2:${i.user.id}`, '🤖 البوتات', ButtonStyle.Primary))],
  });
}

function showWhitelistModal(i, type, title, label, current) {
  return i.showModal(new ModalBuilder().setCustomId(`security_wl_${type}_modal:${i.user.id}`).setTitle(title).addComponents(modalField('value', label, current)));
}

async function strikes(i, c) {
  const members = await i.guild.members.fetch().catch(() => i.guild.members.cache);
  const entries = [];
  for (const m of members.values()) {
    if (m.user.bot) continue;
    const s = await getStrikes(c, i.guildId, m.id).catch(() => ({ count: 0 }));
    if (s.count) entries.push({ id: m.id, count: Number(s.count) });
  }
  entries.sort((a, b) => b.count - a.count);
  const text = entries.slice(0, 10).map((e, n) => `${n + 1}. <@${e.id}> — **${e.count}** strikes`).join('\n') || 'لا توجد Strikes فعالة';
  const rows = [row(button(`security_back2:${i.user.id}`, '← Back'), button(`security_strikes_refresh2:${i.user.id}`, '🔄 Refresh', ButtonStyle.Success))];
  if (entries.length) rows.push(row(...entries.slice(0, 4).map(e => button(`security_strike_manage:${e.id}:${i.user.id}`, `Manage ${e.count}`, ButtonStyle.Primary))));
  return i.update({ embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle('🏆 Strikes').setDescription(`**${i.guild.name}**\n\n${text}\n\nيمكنك تصفير الـStrike من صفحة العضو.`)], components: rows });
}

async function strikeMember(i, c, userId) {
  const s = await getStrikes(c, i.guildId, userId).catch(() => ({ count: 0, lastReason: '' }));
  return i.update({
    embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle('🏆 إدارة Strikes').setDescription(`<@${userId}>\n\n**Strikes:** ${s.count || 0}\n**آخر سبب:** ${s.lastReason || '—'}`)],
    components: [row(button(`security_strike_reset:${userId}:${i.user.id}`, '🧹 Reset Strikes', ButtonStyle.Danger), button(`security_strikes_refresh2:${i.user.id}`, '← Back'))],
  });
}

export default [
  { name: 'security_panel_whitelist2', execute: async (i, c) => ok(i) ? whitelist(i, c) : deny(i) },
  { name: 'wl_users2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); return showWhitelistModal(i, 'users', 'Whitelist Users', 'User IDs, one per line', x.whitelist.users.join('\n')); } },
  { name: 'wl_roles2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); return showWhitelistModal(i, 'roles', 'Whitelist Roles', 'Role IDs, one per line', x.whitelist.roles.join('\n')); } },
  { name: 'wl_bots2', execute: async (i, c) => { if (!ok(i)) return deny(i); const x = await getSecurityConfig(c, i.guildId); return showWhitelistModal(i, 'bots', 'Whitelist Bots', 'Bot IDs, one per line', x.whitelist.bots.join('\n')); } },
  { name: 'security_panel_strikes2', execute: async (i, c) => ok(i) ? strikes(i, c) : deny(i) },
  { name: 'security_strikes_refresh2', execute: async (i, c) => ok(i) ? strikes(i, c) : deny(i) },
  { name: 'security_strike_manage', execute: async (i, c, args) => ok(i) ? strikeMember(i, c, args[0]) : deny(i) },
  { name: 'security_strike_reset', execute: async (i, c, args) => { if (!ok(i)) return deny(i); const userId = args[0]; await clearStrikes(c, i.guildId, userId); await sendSecurityLog(c, i.guild, { title: 'Strikes Reset', description: `<@${userId}> strikes reset by <@${i.user.id}>`, color: 0x57f287 }); return strikeMember(i, c, userId); } },
  { name: 'security_wl_users_modal', execute: async (i, c) => { if (!ok(i)) return deny(i); const users = String(i.fields.getTextInputValue('value') || '').split(/\s+/).filter(Boolean).slice(0, 100); await updateSecurityConfig(c, i.guildId, { whitelist: { users } }); return whitelist(i, c); } },
  { name: 'security_wl_roles_modal', execute: async (i, c) => { if (!ok(i)) return deny(i); const roles = String(i.fields.getTextInputValue('value') || '').split(/\s+/).filter(Boolean).slice(0, 100); await updateSecurityConfig(c, i.guildId, { whitelist: { roles } }); return whitelist(i, c); } },
  { name: 'security_wl_bots_modal', execute: async (i, c) => { if (!ok(i)) return deny(i); const bots = String(i.fields.getTextInputValue('value') || '').split(/\s+/).filter(Boolean).slice(0, 100); await updateSecurityConfig(c, i.guildId, { whitelist: { bots } }); return whitelist(i, c); } },
];
