import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { getPartnerData, savePartnerData, applicationEmbed, applicationButtons } from '../../utils/partner.js';

async function renderApplications(interaction, filter) {
  const data = await getPartnerData(interaction.client, interaction.guildId);
  const items = filter === 'active' ? data.partners.filter(p => p.status === 'active') : data.applications.filter(a => a.status === 'pending');
  const title = filter === 'active' ? '🤝 Active Partners' : '🟡 Pending Partnership Requests';
  if (!items.length) return interaction.update({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(title).setDescription('Nothing to display.')], components: [] });
  const description = items.slice(0, 15).map((x, i) => filter === 'active'
    ? `**${i + 1}. ${x.serverName}** • ${x.members} members • <t:${Math.floor(new Date(x.acceptedAt || x.createdAt).getTime()/1000)}:R>`
    : `**#${x.id} — ${x.serverName}** • ${x.members} members • <@${x.applicantId}>`).join('\n');
  const rows = [];
  if (filter !== 'active') rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('partner_back_dashboard').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  else rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('partner_back_dashboard').setLabel('Back').setStyle(ButtonStyle.Secondary)));
  return interaction.update({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(title).setDescription(description)], components: rows });
}

export default [
  { name: 'partner_apply', async execute(interaction) {
    const modal = new ModalBuilder().setCustomId('partner_apply_modal').setTitle('Partnership Request');
    const fields = [
      ['server_name', 'Server name', TextInputStyle.Short, 100],
      ['invite', 'Invite link', TextInputStyle.Short, 200],
      ['members', 'Member count', TextInputStyle.Short, 10],
      ['description', 'Server description', TextInputStyle.Paragraph, 1000],
    ];
    modal.addComponents(...fields.map(([id, label, style, max]) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(true).setMaxLength(max))));
    return interaction.showModal(modal);
  }},
  { name: 'partner_requirements', async execute(interaction) {
    const data = await getPartnerData(interaction.client, interaction.guildId);
    return interaction.reply({ content: `📋 **Partnership Requirements**\n\n• ${data.requirements.minMembers}+ members\n• ${data.requirements.requireInvite ? 'Valid invite link' : 'Invite optional'}\n• ${data.requirements.requireActive ? 'Active community' : 'Activity check disabled'}\n• No recent serious violations`, ephemeral: true });
  }},
  { name: 'partner_list', async execute(interaction) {
    const data = await getPartnerData(interaction.client, interaction.guildId);
    const active = data.partners.filter(p => p.status === 'active');
    const description = active.length ? active.slice(0, 25).map((p, i) => `**${i + 1}. ${p.serverName}** • ${p.members} members • ${p.invite}`).join('\n') : 'No active partners yet.';
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🤝 Partners').setDescription(description)], ephemeral: true });
  }},
  { name: 'partner_pending', async execute(interaction) { return renderApplications(interaction, 'pending'); } },
  { name: 'partner_active', async execute(interaction) { return renderApplications(interaction, 'active'); } },
  { name: 'partner_stats', async execute(interaction) {
    const data = await getPartnerData(interaction.client, interaction.guildId);
    const accepted = data.applications.filter(a => a.status === 'accepted').length;
    const rejected = data.applications.filter(a => a.status === 'rejected').length;
    const pending = data.applications.filter(a => a.status === 'pending').length;
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('📊 Partnership Statistics').addFields(
      { name: 'Active Partners', value: String(data.partners.filter(p => p.status === 'active').length), inline: true },
      { name: 'Accepted', value: String(accepted), inline: true },
      { name: 'Rejected', value: String(rejected), inline: true },
      { name: 'Pending', value: String(pending), inline: true },
      { name: 'Total Applications', value: String(data.applications.length), inline: true },
    )], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('partner_back_dashboard').setLabel('Back').setStyle(ButtonStyle.Secondary))] });
  }},
  { name: 'partner_settings', async execute(interaction) {
    const data = await getPartnerData(interaction.client, interaction.guildId);
    const modal = new ModalBuilder().setCustomId('partner_settings_modal').setTitle('Partnership Settings').addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('min_members').setLabel('Minimum members').setStyle(TextInputStyle.Short).setValue(String(data.requirements.minMembers)).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('require_invite').setLabel('Require invite? yes/no').setStyle(TextInputStyle.Short).setValue(data.requirements.requireInvite ? 'yes' : 'no').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('require_active').setLabel('Require active community? yes/no').setStyle(TextInputStyle.Short).setValue(data.requirements.requireActive ? 'yes' : 'no').setRequired(true)),
    );
    return interaction.showModal(modal);
  }},
  { name: 'partner_back_dashboard', async execute(interaction) {
    const data = await getPartnerData(interaction.client, interaction.guildId);
    const pending = data.applications.filter(a => a.status === 'pending').length;
    const active = data.partners.filter(p => p.status === 'active').length;
    return interaction.update({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🤝 Partnership Management').setDescription('Manage partnership requests and active partners.').addFields(
      { name: 'Active Partners', value: String(active), inline: true }, { name: 'Pending Requests', value: String(pending), inline: true }, { name: 'Total Applications', value: String(data.applications.length), inline: true },
    )], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('partner_pending').setLabel('Pending').setEmoji('🟡').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('partner_active').setLabel('Partners').setEmoji('🤝').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('partner_stats').setLabel('Statistics').setEmoji('📊').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('partner_settings').setLabel('Settings').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
    )] });
  }},
  { name: 'partner_accept', async execute(interaction, client, args) { return review(interaction, client, args[0], 'accepted'); } },
  { name: 'partner_reject', async execute(interaction, client, args) { return review(interaction, client, args[0], 'rejected'); } },
];

async function review(interaction, client, id, status) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ You need Manage Server permission.', ephemeral: true });
  await interaction.deferUpdate();
  const data = await getPartnerData(client, interaction.guildId);
  const app = data.applications.find(a => String(a.id) === String(id));
  if (!app || app.status !== 'pending') return interaction.followUp({ content: '❌ Partnership request not found or already reviewed.', ephemeral: true });
  app.status = status;
  app.reviewedBy = interaction.user.id;
  app.reviewedAt = new Date().toISOString();
  if (status === 'accepted') data.partners.push({ ...app, status: 'active', acceptedAt: app.reviewedAt });
  await savePartnerData(client, interaction.guildId, data);
  const channel = interaction.guild.channels.cache.get(data.requestChannelId);
  const message = channel ? await channel.messages.fetch(app.messageId).catch(() => null) : null;
  if (message) await message.edit({ embeds: [applicationEmbed(app, interaction.guild)], components: applicationButtons(app) });
  return interaction.followUp({ content: `✅ Partnership request #${app.id} ${status}.`, ephemeral: true });
}
