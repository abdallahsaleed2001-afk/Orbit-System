import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { getSecurityConfig, updateSecurityConfig } from '../services/security/securityService.js';
import {
  buildSecurityDashboard,
  buildSecurityControls,
  buildSecurityPanel,
  buildSecurityPanelControls,
} from '../commands/Security/security.js';

const PANELS = {
  security_panel_nuke: 'nuke',
  security_panel_raid: 'raid',
  security_panel_automod: 'automod',
  security_panel_punishments: 'punishments',
  security_panel_whitelist: 'whitelist',
  security_panel_logs: 'logs',
  security_panel_settings: 'settings',
};

function authorized(interaction) {
  return interaction.customId.split(':').at(-1) === interaction.user.id;
}

function reject(interaction) {
  return interaction.reply({ content: 'This security dashboard belongs to another moderator.', flags: MessageFlags.Ephemeral });
}

function num(value, fallback, min = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}

function bool(value, fallback) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'true' ? true : v === 'false' ? false : fallback;
}

function lines(value) {
  return String(value || '').split(/[\s,]+/).map(v => v.trim()).filter(Boolean);
}

function field(id, label, value = '', style = TextInputStyle.Short) {
  const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(false);
  if (value !== undefined && value !== null && String(value)) input.setValue(String(value).slice(0, 4000));
  return new ActionRowBuilder().addComponents(input);
}

function modal(interaction, id, title, fields) {
  return interaction.showModal(new ModalBuilder().setCustomId(`${id}:${interaction.user.id}`).setTitle(title).addComponents(...fields));
}

async function updatePanel(interaction, client, panel) {
  const config = await getSecurityConfig(client, interaction.guildId);
  return interaction.update({
    embeds: [buildSecurityPanel(config, interaction.guild, panel)],
    components: buildSecurityPanelControls(interaction.user.id, panel, config),
  });
}

async function updateDashboard(interaction, client) {
  const config = await getSecurityConfig(client, interaction.guildId);
  return interaction.update({
    embeds: [buildSecurityDashboard(config, interaction.guild)],
    components: buildSecurityControls(interaction.user.id),
  });
}

function changeCycle(current, values) {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length];
}

const handlers = [];

for (const [name, panel] of Object.entries(PANELS)) {
  handlers.push({
    name,
    async execute(interaction, client) {
      if (!authorized(interaction)) return reject(interaction);
      return updatePanel(interaction, client, panel);
    },
  });
}

handlers.push({
  name: 'security_refresh',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    return updateDashboard(interaction, client);
  },
});

handlers.push({
  name: 'security_back',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    return updateDashboard(interaction, client);
  },
});

handlers.push({
  name: 'security_settings_refresh',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    return updatePanel(interaction, client, 'settings');
  },
});

handlers.push({
  name: 'security_settings_toggle',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    await updateSecurityConfig(client, interaction.guildId, { enabled: !config.enabled });
    return updatePanel(interaction, client, 'settings');
  },
});

handlers.push({
  name: 'security_nuke_toggle',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    await updateSecurityConfig(client, interaction.guildId, { antiNuke: { enabled: !config.antiNuke.enabled } });
    return updatePanel(interaction, client, 'nuke');
  },
});

handlers.push({
  name: 'security_nuke_action',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    await updateSecurityConfig(client, interaction.guildId, { antiNuke: { action: changeCycle(config.antiNuke.action, ['strip', 'kick', 'ban']) } });
    return updatePanel(interaction, client, 'nuke');
  },
});

handlers.push({
  name: 'security_nuke_window',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    const values = [5000, 10000, 15000, 30000, 60000];
    await updateSecurityConfig(client, interaction.guildId, { antiNuke: { windowMs: changeCycle(config.antiNuke.windowMs, values) } });
    return updatePanel(interaction, client, 'nuke');
  },
});

handlers.push({
  name: 'security_nuke_lockdown',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    await updateSecurityConfig(client, interaction.guildId, { antiNuke: { lockdown: !config.antiNuke.lockdown } });
    return updatePanel(interaction, client, 'nuke');
  },
});

handlers.push({
  name: 'security_nuke_threshold',
  async execute(interaction) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(interaction.client, interaction.guildId);
    const t = config.antiNuke.thresholds || {};
    return modal(interaction, 'security_nuke_threshold_modal', 'Anti-Nuke Thresholds', [
      field('channelDelete', 'Channel deletes', t.channelDelete),
      field('channelCreate', 'Channel creates', t.channelCreate),
      field('roleDelete', 'Role deletes', t.roleDelete),
      field('roleCreate', 'Role creates', t.roleCreate),
      field('botAdd', 'Bot additions', t.botAdd),
    ]);
  },
});

handlers.push({
  name: 'security_raid_toggle',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    await updateSecurityConfig(client, interaction.guildId, { antiRaid: { enabled: !config.antiRaid.enabled } });
    return updatePanel(interaction, client, 'raid');
  },
});

handlers.push({
  name: 'security_raid_joins_down',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    await updateSecurityConfig(client, interaction.guildId, { antiRaid: { joins: Math.max(2, config.antiRaid.joins - 1) } });
    return updatePanel(interaction, client, 'raid');
  },
});

handlers.push({
  name: 'security_raid_joins_up',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    await updateSecurityConfig(client, interaction.guildId, { antiRaid: { joins: Math.min(100, config.antiRaid.joins + 1) } });
    return updatePanel(interaction, client, 'raid');
  },
});

handlers.push({
  name: 'security_raid_action',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    await updateSecurityConfig(client, interaction.guildId, { antiRaid: { action: changeCycle(config.antiRaid.action, ['timeout', 'kick']) } });
    return updatePanel(interaction, client, 'raid');
  },
});

handlers.push({
  name: 'security_raid_window',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    await updateSecurityConfig(client, interaction.guildId, { antiRaid: { windowMs: changeCycle(config.antiRaid.windowMs, [5000, 10000, 15000, 30000, 60000]) } });
    return updatePanel(interaction, client, 'raid');
  },
});

handlers.push({
  name: 'security_raid_age',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    const values = [0, 3600000, 21600000, 86400000, 259200000, 604800000, 2592000000];
    await updateSecurityConfig(client, interaction.guildId, { antiRaid: { minAccountAgeMs: changeCycle(config.antiRaid.minAccountAgeMs, values) } });
    return updatePanel(interaction, client, 'raid');
  },
});

handlers.push({
  name: 'security_raid_lockdown',
  async execute(interaction, client) {
    if (!authorized(interaction)) return reject(interaction);
    const config = await getSecurityConfig(client, interaction.guildId);
    await updateSecurityConfig(client, interaction.guildId, { antiRaid: { lockdown: !config.antiRaid.lockdown } });
    return updatePanel(interaction, client, 'raid');
  },
});

const automodToggle = async (interaction, client, key) => {
  if (!authorized(interaction)) return reject(interaction);
  const config = await getSecurityConfig(client, interaction.guildId);
  await updateSecurityConfig(client, interaction.guildId, { autoMod: { [key]: { enabled: !config.autoMod[key].enabled } } });
  return updatePanel(interaction, client, 'automod');
};

handlers.push({ name: 'security_automod_toggle', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { enabled: !x.autoMod.enabled } }); return updatePanel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_spam_toggle', execute: (i, c) => automodToggle(i, c, 'spam') });
handlers.push({ name: 'security_automod_dup_toggle', execute: (i, c) => automodToggle(i, c, 'duplicate') });
handlers.push({ name: 'security_automod_spam_down', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { spam: { maxMessages: Math.max(2, x.autoMod.spam.maxMessages - 1) } } }); return updatePanel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_spam_up', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { spam: { maxMessages: Math.min(30, x.autoMod.spam.maxMessages + 1) } } }); return updatePanel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_dup_down', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { duplicate: { maxRepeats: Math.max(2, x.autoMod.duplicate.maxRepeats - 1) } } }); return updatePanel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_dup_up', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { duplicate: { maxRepeats: Math.min(15, x.autoMod.duplicate.maxRepeats + 1) } } }); return updatePanel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_mentions_down', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { mentions: { max: Math.max(1, x.autoMod.mentions.max - 1) } } }); return updatePanel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_mentions_up', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { mentions: { max: Math.min(30, x.autoMod.mentions.max + 1) } } }); return updatePanel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_invites', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { invites: { enabled: !x.autoMod.invites.enabled } } }); return updatePanel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_links', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { links: { enabled: !x.autoMod.links.enabled } } }); return updatePanel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_caps', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { caps: { enabled: !x.autoMod.caps.enabled } } }); return updatePanel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_action', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { autoMod: { action: changeCycle(x.autoMod.action, ['delete', 'warn', 'timeout']) } }); return updatePanel(i, c, 'automod'); } });
handlers.push({ name: 'security_automod_badwords', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); return modal(i, 'security_automod_badwords_modal', 'AutoMod Blocked Words', [field('words', 'Words, separated by spaces', (x.autoMod.badWords.words || []).join(' '), TextInputStyle.Paragraph)]); } });

handlers.push({ name: 'security_pun_decay_down', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { strikeDecayMs: Math.max(3600000, x.strikeDecayMs - 3600000) }); return updatePanel(i, c, 'punishments'); } });
handlers.push({ name: 'security_pun_decay_up', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); await updateSecurityConfig(c, i.guildId, { strikeDecayMs: Math.min(30 * 86400000, x.strikeDecayMs + 3600000) }); return updatePanel(i, c, 'punishments'); } });

handlers.push({ name: 'security_whitelist_users', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); return modal(i, 'security_whitelist_users_modal', 'Whitelist Users', [field('users', 'User IDs, one per line', (x.whitelist.users || []).join('\n'), TextInputStyle.Paragraph)]); } });
handlers.push({ name: 'security_whitelist_roles', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); return modal(i, 'security_whitelist_roles_modal', 'Whitelist Roles', [field('roles', 'Role IDs, one per line', (x.whitelist.roles || []).join('\n'), TextInputStyle.Paragraph)]); } });
handlers.push({ name: 'security_whitelist_bots', execute: async (i, c) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(c, i.guildId); return modal(i, 'security_whitelist_bots_modal', 'Whitelist Bots', [field('bots', 'Bot IDs, one per line', (x.whitelist.bots || []).join('\n'), TextInputStyle.Paragraph)]); } });
handlers.push({ name: 'security_logs_channel', execute: async (i) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(i.client, i.guildId); return modal(i, 'security_logs_channel_modal', 'Security Log Channel', [field('channel', 'Channel ID', x.logChannelId || '')]); } });
handlers.push({ name: 'security_logs_ignored', execute: async (i) => { if (!authorized(i)) return reject(i); const x = await getSecurityConfig(i.client, i.guildId); return modal(i, 'security_logs_ignored_modal', 'Ignored Channels', [field('channels', 'Channel IDs, one per line', (x.ignoredChannels || []).join('\n'), TextInputStyle.Paragraph)]); } });

for (let strike = 1; strike <= 10; strike++) {
  handlers.push({
    name: `security_pun_level_${strike}`,
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await getSecurityConfig(c, i.guildId);
      const level = (x.escalation || []).find(e => e.strike === strike);
      if (!level) return updatePanel(i, c, 'punishments');
      const actions = ['warn', 'timeout', 'kick', 'ban'];
      const nextAction = changeCycle(level.action, actions);
      const escalation = x.escalation.map(e => e.strike === strike ? { ...e, action: nextAction } : e);
      await updateSecurityConfig(c, i.guildId, { escalation });
      return updatePanel(i, c, 'punishments');
    },
  });
}

export const securityButtonHandlers = handlers;

const modalHandlers = [
  {
    name: 'security_nuke_threshold_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await getSecurityConfig(c, i.guildId);
      const t = { ...x.antiNuke.thresholds };
      for (const key of Object.keys(t)) {
        const inputId = key === 'channelDelete' ? 'channelDelete' : key === 'channelCreate' ? 'channelCreate' : key === 'roleDelete' ? 'roleDelete' : key === 'roleCreate' ? 'roleCreate' : key === 'botAdd' ? 'botAdd' : null;
        if (inputId) t[key] = num(i.fields.getTextInputValue(inputId), t[key], 1);
      }
      await updateSecurityConfig(c, i.guildId, { antiNuke: { thresholds: t } });
      return i.update({ embeds: [buildSecurityPanel(await getSecurityConfig(c, i.guildId), i.guild, 'nuke')], components: buildSecurityPanelControls(i.user.id, 'nuke', await getSecurityConfig(c, i.guildId)) });
    },
  },
  {
    name: 'security_automod_badwords_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const words = lines(i.fields.getTextInputValue('words')).slice(0, 100);
      await updateSecurityConfig(c, i.guildId, { autoMod: { badWords: { enabled: words.length > 0, words } } });
      const x = await getSecurityConfig(c, i.guildId);
      return i.update({ embeds: [buildSecurityPanel(x, i.guild, 'automod')], components: buildSecurityPanelControls(i.user.id, 'automod', x) });
    },
  },
  {
    name: 'security_whitelist_users_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await updateSecurityConfig(c, i.guildId, { whitelist: { users: lines(i.fields.getTextInputValue('users')).slice(0, 100) } });
      return i.update({ embeds: [buildSecurityPanel(x, i.guild, 'whitelist')], components: buildSecurityPanelControls(i.user.id, 'whitelist', x) });
    },
  },
  {
    name: 'security_whitelist_roles_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await updateSecurityConfig(c, i.guildId, { whitelist: { roles: lines(i.fields.getTextInputValue('roles')).slice(0, 100) } });
      return i.update({ embeds: [buildSecurityPanel(x, i.guild, 'whitelist')], components: buildSecurityPanelControls(i.user.id, 'whitelist', x) });
    },
  },
  {
    name: 'security_whitelist_bots_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await updateSecurityConfig(c, i.guildId, { whitelist: { bots: lines(i.fields.getTextInputValue('bots')).slice(0, 100) } });
      return i.update({ embeds: [buildSecurityPanel(x, i.guild, 'whitelist')], components: buildSecurityPanelControls(i.user.id, 'whitelist', x) });
    },
  },
  {
    name: 'security_logs_channel_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await updateSecurityConfig(c, i.guildId, { logChannelId: i.fields.getTextInputValue('channel').trim() || null });
      return i.update({ embeds: [buildSecurityPanel(x, i.guild, 'logs')], components: buildSecurityPanelControls(i.user.id, 'logs', x) });
    },
  },
  {
    name: 'security_logs_ignored_modal',
    async execute(i, c) {
      if (!authorized(i)) return reject(i);
      const x = await updateSecurityConfig(c, i.guildId, { ignoredChannels: lines(i.fields.getTextInputValue('channels')).slice(0, 100) });
      return i.update({ embeds: [buildSecurityPanel(x, i.guild, 'logs')], components: buildSecurityPanelControls(i.user.id, 'logs', x) });
    },
  },
];

export const securityModalHandlers = modalHandlers;
