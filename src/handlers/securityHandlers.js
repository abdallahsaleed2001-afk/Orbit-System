import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { getSecurityConfig, updateSecurityConfig } from '../services/security/securityService.js';
import { buildSecurityDashboard, buildSecurityControls } from '../commands/Security/security.js';

const BUTTONS = [
  'security_panel_nuke',
  'security_panel_raid',
  'security_panel_automod',
  'security_panel_punishments',
  'security_panel_whitelist',
  'security_panel_logs',
  'security_panel_settings',
];

function authorized(interaction) {
  return interaction.customId.split(':').at(-1) === interaction.user.id;
}

function reject(interaction) {
  return interaction.reply({
    content: 'This security dashboard belongs to another moderator.',
    flags: MessageFlags.Ephemeral,
  });
}

function lines(value) {
  return String(value || '').split(/[\s,]+/).map(v => v.trim()).filter(Boolean);
}

function num(value, fallback, min = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}

function bool(value, fallback) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'true' ? true : v === 'false' ? false : fallback;
}

function input(id, label, value = '', style = TextInputStyle.Short) {
  const field = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setRequired(false);

  if (value !== undefined && value !== null && String(value)) {
    field.setValue(String(value).slice(0, 4000));
  }

  return new ActionRowBuilder().addComponents(field);
}

function openModal(interaction, id, title, rows) {
  return interaction.showModal(
    new ModalBuilder()
      .setCustomId(`${id}:${interaction.user.id}`)
      .setTitle(title)
      .addComponents(...rows),
  );
}

function escalationText(config) {
  return (config.escalation || [])
    .map(e => `${e.strike}:${e.action}:${e.durationMs || 0}`)
    .join('\n');
}

function parseEscalation(value) {
  const allowed = new Set(['warn', 'timeout', 'kick', 'ban']);
  return String(value || '')
    .split('\n')
    .map(x => x.trim())
    .filter(Boolean)
    .map(line => {
      const [strikeValue, action, duration] = line.split(':').map(x => x.trim());
      const strike = Number(strikeValue);
      if (!Number.isInteger(strike) || strike < 1 || strike > 10 || !allowed.has(action)) return null;
      return { strike, action, durationMs: num(duration, 0) };
    })
    .filter(Boolean)
    .sort((a, b) => a.strike - b.strike)
    .slice(0, 10);
}

async function showUpdated(interaction, client, config) {
  return interaction.reply({
    embeds: [buildSecurityDashboard(config, interaction.guild)],
    components: buildSecurityControls(interaction.user.id),
    flags: MessageFlags.Ephemeral,
  });
}

const buttonHandlers = BUTTONS.map(name => ({
  name,
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);

    const config = await getSecurityConfig(client, interaction.guildId);

    const modals = {
      security_panel_nuke: ['security_nuke_modal', '🛡️ Anti-Nuke Configuration', [
        input('enabled', 'Enabled: true/false', config.antiNuke.enabled),
        input('window', 'Detection window (ms)', config.antiNuke.windowMs),
        input('thresholds', 'Thresholds: key=value per line', Object.entries(config.antiNuke.thresholds).map(([k, v]) => `${k}=${v}`).join('\n'), TextInputStyle.Paragraph),
        input('action', 'Action: strip, kick, ban', config.antiNuke.action),
        input('lockdown', 'Lockdown: true/false', config.antiNuke.lockdown),
      ]],
      security_panel_raid: ['security_raid_modal', '🚨 Anti-Raid Configuration', [
        input('enabled', 'Enabled: true/false', config.antiRaid.enabled),
        input('joins', 'Joins required', config.antiRaid.joins),
        input('window', 'Join window (ms)', config.antiRaid.windowMs),
        input('accountAge', 'Minimum account age (hours)', Math.round(config.antiRaid.minAccountAgeMs / 3600000)),
        input('action', 'Action: timeout or kick', config.antiRaid.action),
      ]],
      security_panel_automod: ['security_automod_modal', '🤖 AutoMod Configuration', [
        input('enabled', 'Enabled: true/false', config.autoMod.enabled),
        input('spam', 'Spam: enabled,maxMessages,windowMs', `${config.autoMod.spam.enabled},${config.autoMod.spam.maxMessages},${config.autoMod.spam.windowMs}`),
        input('duplicate', 'Duplicate: enabled,maxRepeats,windowMs', `${config.autoMod.duplicate.enabled},${config.autoMod.duplicate.maxRepeats},${config.autoMod.duplicate.windowMs}`),
        input('content', 'Mentions, invites, links, caps', `${config.autoMod.mentions.max},${config.autoMod.invites.enabled},${config.autoMod.links.enabled},${config.autoMod.caps.enabled}`),
        input('badWords', 'Blocked words (one per line)', (config.autoMod.badWords.words || []).join('\n'), TextInputStyle.Paragraph),
      ]],
      security_panel_punishments: ['security_punishments_modal', '⚖️ Punishment Escalation', [
        input('levels', 'strike:action:durationMs per line', escalationText(config), TextInputStyle.Paragraph),
        input('decay', 'Strike decay (hours)', Math.round((config.strikeDecayMs || 86400000) / 3600000)),
      ]],
      security_panel_whitelist: ['security_whitelist_modal', '👤 Security Whitelist', [
        input('users', 'User IDs', (config.whitelist.users || []).join('\n'), TextInputStyle.Paragraph),
        input('roles', 'Role IDs', (config.whitelist.roles || []).join('\n'), TextInputStyle.Paragraph),
        input('bots', 'Bot IDs', (config.whitelist.bots || []).join('\n'), TextInputStyle.Paragraph),
      ]],
      security_panel_logs: ['security_logs_modal', '📋 Security Logs', [
        input('channel', 'Security log channel ID', config.logChannelId || ''),
        input('ignored', 'Ignored channel IDs', (config.ignoredChannels || []).join('\n'), TextInputStyle.Paragraph),
      ]],
      security_panel_settings: ['security_settings_modal', '⚙️ Security Settings', [
        input('enabled', 'Global security enabled: true/false', config.enabled),
      ]],
    };

    const [id, title, rows] = modals[name];
    return openModal(interaction, id, title, rows);
  },
}));

buttonHandlers.push({
  name: 'security_refresh',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    return interaction.update({
      embeds: [buildSecurityDashboard(config, interaction.guild)],
      components: buildSecurityControls(interaction.user.id),
    });
  },
});

const modalHandlers = [
  {
    name: 'security_nuke_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await getSecurityConfig(c, i.guildId);
      const thresholds = { ...x.antiNuke.thresholds };
      for (const line of i.fields.getTextInputValue('thresholds').split('\n')) {
        const [key, value] = line.split('=').map(v => v.trim());
        if (Object.prototype.hasOwnProperty.call(thresholds, key)) thresholds[key] = num(value, thresholds[key], 1);
      }
      const action = i.fields.getTextInputValue('action').trim().toLowerCase();
      const u = await updateSecurityConfig(c, i.guildId, { antiNuke: {
        enabled: bool(i.fields.getTextInputValue('enabled'), x.antiNuke.enabled),
        windowMs: num(i.fields.getTextInputValue('window'), x.antiNuke.windowMs, 1000),
        thresholds,
        action: ['strip', 'kick', 'ban'].includes(action) ? action : x.antiNuke.action,
        lockdown: bool(i.fields.getTextInputValue('lockdown'), x.antiNuke.lockdown),
      }});
      return showUpdated(i, c, u);
    },
  },
  {
    name: 'security_raid_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await getSecurityConfig(c, i.guildId);
      const action = i.fields.getTextInputValue('action').trim().toLowerCase();
      const u = await updateSecurityConfig(c, i.guildId, { antiRaid: {
        enabled: bool(i.fields.getTextInputValue('enabled'), x.antiRaid.enabled),
        joins: num(i.fields.getTextInputValue('joins'), x.antiRaid.joins, 2),
        windowMs: num(i.fields.getTextInputValue('window'), x.antiRaid.windowMs, 1000),
        minAccountAgeMs: num(i.fields.getTextInputValue('accountAge'), x.antiRaid.minAccountAgeMs / 3600000, 0) * 3600000,
        action: ['timeout', 'kick'].includes(action) ? action : x.antiRaid.action,
      }});
      return showUpdated(i, c, u);
    },
  },
  {
    name: 'security_automod_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await getSecurityConfig(c, i.guildId);
      const [spamEnabled, spamMax, spamWindow] = i.fields.getTextInputValue('spam').split(',');
      const [dupEnabled, dupMax, dupWindow] = i.fields.getTextInputValue('duplicate').split(',');
      const [mentionMax, invites, links, caps] = i.fields.getTextInputValue('content').split(',');
      const u = await updateSecurityConfig(c, i.guildId, { autoMod: {
        enabled: bool(i.fields.getTextInputValue('enabled'), x.autoMod.enabled),
        spam: { enabled: bool(spamEnabled, x.autoMod.spam.enabled), maxMessages: num(spamMax, x.autoMod.spam.maxMessages, 2), windowMs: num(spamWindow, x.autoMod.spam.windowMs, 1000) },
        duplicate: { enabled: bool(dupEnabled, x.autoMod.duplicate.enabled), maxRepeats: num(dupMax, x.autoMod.duplicate.maxRepeats, 2), windowMs: num(dupWindow, x.autoMod.duplicate.windowMs, 1000) },
        mentions: { enabled: true, max: num(mentionMax, x.autoMod.mentions.max, 1) },
        invites: { enabled: bool(invites, x.autoMod.invites.enabled) },
        links: { enabled: bool(links, x.autoMod.links.enabled) },
        caps: { ...x.autoMod.caps, enabled: bool(caps, x.autoMod.caps.enabled) },
        badWords: { enabled: true, words: lines(i.fields.getTextInputValue('badWords')).slice(0, 100) },
      }});
      return showUpdated(i, c, u);
    },
  },
  {
    name: 'security_punishments_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await getSecurityConfig(c, i.guildId);
      const parsed = parseEscalation(i.fields.getTextInputValue('levels'));
      const u = await updateSecurityConfig(c, i.guildId, {
        escalation: parsed.length ? parsed : x.escalation,
        strikeDecayMs: num(i.fields.getTextInputValue('decay'), 24, 1) * 3600000,
      });
      return showUpdated(i, c, u);
    },
  },
  {
    name: 'security_whitelist_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const u = await updateSecurityConfig(c, i.guildId, { whitelist: {
        users: lines(i.fields.getTextInputValue('users')),
        roles: lines(i.fields.getTextInputValue('roles')),
        bots: lines(i.fields.getTextInputValue('bots')),
      }});
      return showUpdated(i, c, u);
    },
  },
  {
    name: 'security_logs_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const u = await updateSecurityConfig(c, i.guildId, {
        logChannelId: i.fields.getTextInputValue('channel').trim() || null,
        ignoredChannels: lines(i.fields.getTextInputValue('ignored')),
      });
      return showUpdated(i, c, u);
    },
  },
  {
    name: 'security_settings_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await getSecurityConfig(c, i.guildId);
      const u = await updateSecurityConfig(c, i.guildId, { enabled: bool(i.fields.getTextInputValue('enabled'), x.enabled) });
      return showUpdated(i, c, u);
    },
  },
];

export const securityButtonHandlers = buttonHandlers;
export const securityModalHandlers = modalHandlers;
