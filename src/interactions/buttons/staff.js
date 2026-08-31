import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { calculateActivityScore, countWarnings, getStaffData, getStaffProfile, syncStaffRoleMembers, STAFF_ROLE_ID } from '../../services/staffService.js';

function nav() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('staff_my_profile').setLabel('My Profile').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('staff_activity').setLabel('Activity').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('staff_list').setLabel('Staff List').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('staff_warnings').setLabel('Warnings').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('staff_promotions').setLabel('Promotions').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('staff_demotions').setLabel('Demotions').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('staff_notes').setLabel('Notes').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function back() {
  return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('staff_home').setLabel('Back').setStyle(ButtonStyle.Secondary))];
}

async function getActiveStaffData(guild) {
  const data = await syncStaffRoleMembers(guild);
  const members = await guild.members.fetch().catch(() => guild.members.cache);
  const activeIds = new Set([...members.values()].filter(member => !member.user.bot && member.roles.cache.has(STAFF_ROLE_ID)).map(member => member.id));
  return { data, activeIds };
}

async function render(interaction, embed) {
  return interaction.update({ embeds: [embed], components: back() });
}

export default [
  {
    name: 'staff_home',
    async execute(interaction) {
      const { data, activeIds } = await getActiveStaffData(interaction.guild);
      const activeEntries = Object.entries(data.members).filter(([id]) => activeIds.has(id));
      const warned = activeEntries.filter(([, m]) => countWarnings(m) > 0).length;
      await interaction.update({
        embeds: [new EmbedBuilder().setTitle('Staff Management').setDescription(`**${interaction.guild.name}**\nCentralized staff management, activity and history.`).addFields(
          { name: 'Staff', value: `**${activeEntries.length}**`, inline: true },
          { name: 'With Warnings', value: `**${warned}**`, inline: true },
          { name: 'Review Threshold', value: `**${data.config.warningsBeforeReview}** warnings`, inline: true },
        )],
        components: nav(),
      });
    },
  },
  {
    name: 'staff_my_profile',
    async execute(interaction) {
      const profile = await getStaffProfile(interaction.guildId, interaction.user.id);
      await render(interaction, new EmbedBuilder().setTitle('Staff Profile').setDescription(`${interaction.user}`).addFields(
        { name: 'Activity', value: `**${calculateActivityScore(profile)}%**`, inline: true },
        { name: 'Warnings', value: `**${countWarnings(profile)}**`, inline: true },
        { name: 'Moderation Actions', value: `**${profile.activity?.moderationActions || 0}**`, inline: true },
        { name: 'Tickets Handled', value: `**${profile.activity?.ticketsHandled || 0}**`, inline: true },
        { name: 'Promotions', value: `**${profile.promotions.length}**`, inline: true },
        { name: 'Demotions', value: `**${profile.demotions.length}**`, inline: true },
      ).setThumbnail(interaction.user.displayAvatarURL()));
    },
  },
  {
    name: 'staff_activity',
    async execute(interaction) {
      const { data, activeIds } = await getActiveStaffData(interaction.guild);
      const rows = Object.entries(data.members).filter(([id]) => activeIds.has(id)).map(([id, profile]) => ({ id, score: calculateActivityScore(profile) })).sort((a, b) => b.score - a.score).slice(0, 10);
      const description = rows.length ? rows.map((row, i) => `${i + 1}. <@${row.id}> — **${row.score}%**`).join('\n') : 'No staff activity has been recorded yet.';
      await render(interaction, new EmbedBuilder().setTitle('Staff Activity').setDescription(description));
    },
  },
  {
    name: 'staff_list',
    async execute(interaction) {
      const { data, activeIds } = await getActiveStaffData(interaction.guild);
      const entries = Object.entries(data.members).filter(([id]) => activeIds.has(id)).slice(0, 20);
      const description = entries.length ? entries.map(([id, profile]) => `<@${id}> — **${calculateActivityScore(profile)}%** activity • **${countWarnings(profile)}** warnings`).join('\n') : 'No staff members with the Staff role were found.';
      await render(interaction, new EmbedBuilder().setTitle('Staff List').setDescription(description));
    },
  },
  {
    name: 'staff_warnings',
    async execute(interaction) {
      const { data, activeIds } = await getActiveStaffData(interaction.guild);
      const entries = Object.entries(data.members).filter(([id, p]) => activeIds.has(id) && countWarnings(p) > 0).slice(0, 10);
      const description = entries.length ? entries.map(([id, p]) => `<@${id}> — **${countWarnings(p)}** warnings`).join('\n') : 'No staff warnings.';
      await render(interaction, new EmbedBuilder().setTitle('Staff Warnings').setDescription(description));
    },
  },
  {
    name: 'staff_promotions',
    async execute(interaction) {
      const { data, activeIds } = await getActiveStaffData(interaction.guild);
      const records = Object.entries(data.members).filter(([id]) => activeIds.has(id)).flatMap(([id, p]) => (p.promotions || []).map((record) => ({ id, ...record }))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10);
      const description = records.length ? records.map((r) => `<@${r.id}> — **${r.fromRoleName}** → **${r.toRoleName}**\n${r.reason}`).join('\n\n') : 'No promotions recorded.';
      await render(interaction, new EmbedBuilder().setTitle('Staff Promotions').setDescription(description));
    },
  },
  {
    name: 'staff_demotions',
    async execute(interaction) {
      const { data, activeIds } = await getActiveStaffData(interaction.guild);
      const records = Object.entries(data.members).filter(([id]) => activeIds.has(id)).flatMap(([id, p]) => (p.demotions || []).map((record) => ({ id, ...record }))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10);
      const description = records.length ? records.map((r) => `<@${r.id}> — **${r.fromRoleName}** → **${r.toRoleName}**\n${r.reason}`).join('\n\n') : 'No demotions recorded.';
      await render(interaction, new EmbedBuilder().setTitle('Staff Demotions').setDescription(description));
    },
  },
  {
    name: 'staff_notes',
    async execute(interaction) {
      const { data, activeIds } = await getActiveStaffData(interaction.guild);
      const records = Object.entries(data.members).filter(([id]) => activeIds.has(id)).flatMap(([id, p]) => (p.notes || []).map((record) => ({ id, ...record }))).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10);
      const description = records.length ? records.map((r) => `<@${r.id}> — ${r.note}`).join('\n') : 'No staff notes.';
      await render(interaction, new EmbedBuilder().setTitle('Staff Notes').setDescription(description));
    },
  },
];
