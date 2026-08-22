import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { getSecurityConfig, updateSecurityConfig } from '../services/security/securityService.js';

const BUTTONS = [
  ['security_panel_nuke', 'Anti-Nuke'], ['security_panel_raid', 'Anti-Raid'],
  ['security_panel_automod', 'AutoMod'], ['security_panel_punishments', 'Punishments'],
  ['security_panel_whitelist', 'Whitelist'], ['security_panel_logs', 'Logs'],
  ['security_panel_settings', 'Settings'],
];

function dashboard(config, guild) {
  return new EmbedBuilder().setTitle('🛡️ Infinity Security Dashboard')
    .setDescription(`Security control center for **${guild.name}**. All settings are stored persistently.`)
    .setColor(0x5865F2)
    .addFields(
      { name: '🛡️ Anti-Nuke', value: config.antiNuke.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
      { name: '🚨 Anti-Raid', value: config.antiRaid.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
      { name: '🤖 AutoMod', value: config.autoMod.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
      { name: '⚡ Punishments', value: `${config.escalation.length} escalation levels`, inline: true },
      { name: '👤 Whitelist', value: `${config.whitelist.users.length} users / ${config.whitelist.roles.length} roles / ${config.whitelist.bots.length} bots`, inline: true },
      { name: '📋 Logs', value: config.logChannelId ? `<#${config.logChannelId}>` : 'Not configured', inline: true },
      { name: '⏱️ Strike Decay', value: `${Math.round((config.strikeDecayMs || 86400000) / 3600000)}h`, inline: true },
      { name: '🔒 Global Security', value: config.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
    ).setFooter({ text: 'Only the moderator who opened this panel can use its controls.' });
}

function controls(userId, disabled = false) {
  const rows = [];
  for (let i = 0; i < BUTTONS.length; i += 4) {
    rows.push(new ActionRowBuilder().addComponents(...BUTTONS.slice(i, i + 4).map(([id, label]) => new ButtonBuilder()
      .setCustomId(`${id}:${userId}`).setLabel(label)
      .setStyle(label === 'Punishments' ? ButtonStyle.Danger : label === 'Settings' ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disabled))));
  }
  return rows;
}

function authorized(interaction) { return interaction.customId.split(':').at(-1) === interaction.user.id; }
function reject(interaction) { return interaction.reply({ content: 'This security dashboard belongs to another moderator.', flags: MessageFlags.Ephemeral }); }
function input(id, label, value = '', style = TextInputStyle.Short) {
  const x = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(false);
  if (value !== undefined && value !== null && String(value)) x.setValue(String(value).slice(0, 4000));
  return new ActionRowBuilder().addComponents(x);
}
function modal(interaction, id, title, rows) {
  return interaction.showModal(new ModalBuilder().setCustomId(`${id}:${interaction.user.id}`).setTitle(title).addComponents(...rows));
}
function lines(value) { return String(value || '').split(/[\s,]+/).map(v => v.trim()).filter(Boolean); }
function num(value, fallback, min = 0) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, n) : fallback; }
function bool(value, fallback) { const v = String(value ?? '').trim().toLowerCase(); return v === 'true' ? true : v === 'false' ? false : fallback; }
function escalationText(config) { return (config.escalation || []).map(e => `${e.strike}:${e.action}:${e.durationMs || 0}`).join('\n'); }
function parseEscalation(value) {
  const allowed = new Set(['warn', 'timeout', 'kick', 'ban']);
  return String(value || '').split('\n').map(x => x.trim()).filter(Boolean).map(line => {
    const [s, a, d] = line.split(':').map(x => x.trim());
    const strike = Number(s);
    if (!Number.isInteger(strike) || strike < 1 || strike > 10 || !allowed.has(a)) return null;
    return { strike, action: a, durationMs: num(d, 0) };
  }).filter(Boolean).sort((a, b) => a.strike - b.strike).slice(0, 10);
}

const buttonHandlers = [
  { name: 'security_panel_nuke', async execute(i, c) { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); return modal(i, 'security_nuke_modal', 'Anti-Nuke Settings', [input('enabled','Enabled: true/false',x.antiNuke.enabled),input('window','Detection window ms',x.antiNuke.windowMs),input('thresholds','One threshold per line: key=value',Object.entries(x.antiNuke.thresholds).map(([k,v])=>`${k}=${v}`).join('\n'),TextInputStyle.Paragraph),input('action','Action: strip, kick, ban',x.antiNuke.action),input('lockdown','Lockdown alert: true/false',x.antiNuke.lockdown)]); } },
  { name: 'security_panel_raid', async execute(i,c) { if (!authorized(i)) return reject(i); const x=await getSecurityConfig(c,i.guildId); return modal(i,'security_raid_modal','Anti-Raid Settings',[input('enabled','Enabled: true/false',x.antiRaid.enabled),input('joins','Joins required',x.antiRaid.joins),input('window','Join window ms',x.antiRaid.windowMs),input('accountAge','Minimum account age hours',Math.round(x.antiRaid.minAccountAgeMs/3600000)),input('action','Action: timeout or kick',x.antiRaid.action)]); } },
  { name: 'security_panel_automod', async execute(i,c) { if (!authorized(i)) return reject(i); const x=await getSecurityConfig(c,i.guildId); return modal(i,'security_automod_modal','AutoMod Settings',[input('enabled','Enabled: true/false',x.autoMod.enabled),input('spam','Spam: enabled,maxMessages,windowMs',`${x.autoMod.spam.enabled},${x.autoMod.spam.maxMessages},${x.autoMod.spam.windowMs}`),input('duplicate','Duplicate: enabled,maxRepeats,windowMs',`${x.autoMod.duplicate.enabled},${x.autoMod.duplicate.maxRepeats},${x.autoMod.duplicate.windowMs}`),input('content','Mentions,invites,links,caps',''+x.autoMod.mentions.max+','+x.autoMod.invites.enabled+','+x.autoMod.links.enabled+','+x.autoMod.caps.enabled),input('badWords','Bad words, one per line',(x.autoMod.badWords.words||[]).join('\n'),TextInputStyle.Paragraph)]); } },
  { name: 'security_panel_punishments', async execute(i,c) { if (!authorized(i)) return reject(i); const x=await getSecurityConfig(c,i.guildId); return modal(i,'security_punishments_modal','Punishment Escalation',[input('levels','strike:action:durationMs per line',escalationText(x),TextInputStyle.Paragraph),input('decay','Strike decay hours',Math.round((x.strikeDecayMs||86400000)/3600000))]); } },
  { name: 'security_panel_whitelist', async execute(i,c) { if (!authorized(i)) return reject(i); const x=await getSecurityConfig(c,i.guildId); return modal(i,'security_whitelist_modal','Security Whitelist',[input('users','User IDs',(x.whitelist.users||[]).join('\n'),TextInputStyle.Paragraph),input('roles','Role IDs',(x.whitelist.roles||[]).join('\n'),TextInputStyle.Paragraph),input('bots','Bot IDs',(x.whitelist.bots||[]).join('\n'),TextInputStyle.Paragraph)]); } },
  { name: 'security_panel_logs', async execute(i,c) { if (!authorized(i)) return reject(i); const x=await getSecurityConfig(c,i.guildId); return modal(i,'security_logs_modal','Security Logs',[input('channel','Security log channel ID',x.logChannelId||''),input('ignored','Ignored channel IDs',(x.ignoredChannels||[]).join('\n'),TextInputStyle.Paragraph)]); } },
  { name: 'security_panel_settings', async execute(i,c) { if (!authorized(i)) return reject(i); const x=await getSecurityConfig(c,i.guildId); return modal(i,'security_settings_modal','Security Settings',[input('enabled','Global security enabled: true/false',x.enabled),input('info','Ignored by parser','No value needed')]); } },
  { name: 'security_refresh', async execute(i,c) { if (!authorized(i)) return reject(i); const x=await getSecurityConfig(c,i.guildId); return i.update({embeds:[dashboard(x,i.guild)],components:controls(i.user.id)}); } },
];

const modalHandlers = [
  { name:'security_nuke_modal', async execute(i,c){ if(!authorized(i))return reject(i); const x=await getSecurityConfig(c,i.guildId); const thresholds={...x.antiNuke.thresholds}; for(const line of i.fields.getTextInputValue('thresholds').split('\n')){const [k,v]=line.split('=').map(z=>z.trim());if(Object.prototype.hasOwnProperty.call(thresholds,k))thresholds[k]=num(v,thresholds[k],1);} const action=i.fields.getTextInputValue('action').trim().toLowerCase(); const u=await updateSecurityConfig(c,i.guildId,{antiNuke:{enabled:bool(i.fields.getTextInputValue('enabled'),x.antiNuke.enabled),windowMs:num(i.fields.getTextInputValue('window'),x.antiNuke.windowMs,1000),thresholds,action:['strip','kick','ban'].includes(action)?action:x.antiNuke.action,lockdown:bool(i.fields.getTextInputValue('lockdown'),x.antiNuke.lockdown)}}); return i.reply({embeds:[dashboard(u,i.guild)],components:controls(i.user.id),flags:MessageFlags.Ephemeral}); } },
  { name:'security_raid_modal', async execute(i,c){ if(!authorized(i))return reject(i); const x=await getSecurityConfig(c,i.guildId); const a=i.fields.getTextInputValue('action').trim().toLowerCase(); const u=await updateSecurityConfig(c,i.guildId,{antiRaid:{enabled:bool(i.fields.getTextInputValue('enabled'),x.antiRaid.enabled),joins:num(i.fields.getTextInputValue('joins'),x.antiRaid.joins,2),windowMs:num(i.fields.getTextInputValue('window'),x.antiRaid.windowMs,1000),minAccountAgeMs:num(i.fields.getTextInputValue('accountAge'),x.antiRaid.minAccountAgeMs/3600000,0)*3600000,action:['timeout','kick'].includes(a)?a:x.antiRaid.action}}); return i.reply({embeds:[dashboard(u,i.guild)],components:controls(i.user.id),flags:MessageFlags.Ephemeral}); } },
  { name:'security_automod_modal', async execute(i,c){ if(!authorized(i))return reject(i); const x=await getSecurityConfig(c,i.guildId); const [se,sm,sw]=i.fields.getTextInputValue('spam').split(','); const [de,dm,dw]=i.fields.getTextInputValue('duplicate').split(','); const [mm,inv,ln,cp]=i.fields.getTextInputValue('content').split(','); const u=await updateSecurityConfig(c,i.guildId,{autoMod:{enabled:bool(i.fields.getTextInputValue('enabled'),x.autoMod.enabled),spam:{enabled:bool(se,x.autoMod.spam.enabled),maxMessages:num(sm,x.autoMod.spam.maxMessages,2),windowMs:num(sw,x.autoMod.spam.windowMs,1000)},duplicate:{enabled:bool(de,x.autoMod.duplicate.enabled),maxRepeats:num(dm,x.autoMod.duplicate.maxRepeats,2),windowMs:num(dw,x.autoMod.duplicate.windowMs,1000)},mentions:{enabled:true,max:num(mm,x.autoMod.mentions.max,1)},invites:{enabled:bool(inv,x.autoMod.invites.enabled)},links:{enabled:bool(ln,x.autoMod.links.enabled)},caps:{...x.autoMod.caps,enabled:bool(cp,x.autoMod.caps.enabled)},badWords:{enabled:true,words:lines(i.fields.getTextInputValue('badWords')).slice(0,100)}}}); return i.reply({embeds:[dashboard(u,i.guild)],components:controls(i.user.id),flags:MessageFlags.Ephemeral}); } },
  { name:'security_punishments_modal', async execute(i,c){ if(!authorized(i))return reject(i); const x=await getSecurityConfig(c,i.guildId); const parsed=parseEscalation(i.fields.getTextInputValue('levels')); const u=await updateSecurityConfig(c,i.guildId,{escalation:parsed.length?parsed:x.escalation,strikeDecayMs:num(i.fields.getTextInputValue('decay'),24,1)*3600000}); return i.reply({embeds:[dashboard(u,i.guild)],components:controls(i.user.id),flags:MessageFlags.Ephemeral}); } },
  { name:'security_whitelist_modal', async execute(i,c){ if(!authorized(i))return reject(i); const u=await updateSecurityConfig(c,i.guildId,{whitelist:{users:lines(i.fields.getTextInputValue('users')),roles:lines(i.fields.getTextInputValue('roles')),bots:lines(i.fields.getTextInputValue('bots'))}}); return i.reply({embeds:[dashboard(u,i.guild)],components:controls(i.user.id),flags:MessageFlags.Ephemeral}); } },
  { name:'security_logs_modal', async execute(i,c){ if(!authorized(i))return reject(i); const u=await updateSecurityConfig(c,i.guildId,{logChannelId:i.fields.getTextInputValue('channel').trim()||null,ignoredChannels:lines(i.fields.getTextInputValue('ignored'))}); return i.reply({embeds:[dashboard(u,i.guild)],components:controls(i.user.id),flags:MessageFlags.Ephemeral}); } },
  { name:'security_settings_modal', async execute(i,c){ if(!authorized(i))return reject(i); const x=await getSecurityConfig(c,i.guildId); const u=await updateSecurityConfig(c,i.guildId,{enabled:bool(i.fields.getTextInputValue('enabled'),x.enabled)}); return i.reply({embeds:[dashboard(u,i.guild)],components:controls(i.user.id),flags:MessageFlags.Ephemeral}); } },
];

export const securityButtonHandlers = buttonHandlers;
export const securityModalHandlers = modalHandlers;
