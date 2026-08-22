import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

const key = guildId => `partners:${guildId}`;

async function load(client, guildId) {
  const data = await client.db.get(key(guildId), {});
  return data && typeof data === 'object' ? data : {};
}

async function save(client, guildId, data) {
  await client.db.set(key(guildId), data);
}

export async function getPartnerData(client, guildId) {
  const data = await load(client, guildId);
  data.counter = Number(data.counter || 0);
  data.applications = Array.isArray(data.applications) ? data.applications : [];
  data.partners = Array.isArray(data.partners) ? data.partners : [];
  data.requirements = {
    minMembers: Number(data.requirements?.minMembers ?? 500),
    minAccountAgeDays: Number(data.requirements?.minAccountAgeDays ?? 0),
    requireInvite: data.requirements?.requireInvite !== false,
    requireActive: data.requirements?.requireActive !== false,
  };
  return data;
}

export async function savePartnerData(client, guildId, data) {
  await save(client, guildId, data);
}

export async function setupPartnerPanel(interaction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  const data = await getPartnerData(interaction.client, guild.id);

  let panelChannel = data.panelChannelId ? guild.channels.cache.get(data.panelChannelId) : null;
  if (!panelChannel) panelChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === 'partnerships');
  if (!panelChannel) {
    panelChannel = await guild.channels.create({
      name: 'partnerships', type: ChannelType.GuildText, reason: 'Partner system setup',
      permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] }],
    });
  }

  let requestChannel = data.requestChannelId ? guild.channels.cache.get(data.requestChannelId) : null;
  if (!requestChannel) requestChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === 'partnership-requests');
  if (!requestChannel) {
    requestChannel = await guild.channels.create({
      name: 'partnership-requests', type: ChannelType.GuildText, reason: 'Partner system request channel',
      permissionOverwrites: [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] }],
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2).setTitle('🤝 Server Partnerships')
    .setDescription('Interested in partnering with this server? Review the requirements and submit a request below.')
    .addFields({ name: 'Requirements', value: `• ${data.requirements.minMembers}+ members\n• ${data.requirements.requireInvite ? 'Valid invite link' : 'Invite link optional'}\n• ${data.requirements.requireActive ? 'Active community' : 'Activity check disabled'}\n• No recent serious violations` })
    .setFooter({ text: `${guild.name} • Partnership System` });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('partner_apply').setLabel('Apply for Partnership').setEmoji('🤝').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('partner_requirements').setLabel('Requirements').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('partner_list').setLabel('Partners').setEmoji('🤝').setStyle(ButtonStyle.Secondary),
  );

  let panelMessage = data.panelMessageId ? await panelChannel.messages.fetch(data.panelMessageId).catch(() => null) : null;
  if (panelMessage) await panelMessage.edit({ embeds: [embed], components: [row] });
  else panelMessage = await panelChannel.send({ embeds: [embed], components: [row] });

  data.panelChannelId = panelChannel.id;
  data.panelMessageId = panelMessage.id;
  data.requestChannelId = requestChannel.id;
  await savePartnerData(interaction.client, guild.id, data);
  return interaction.editReply({ content: `✅ Partner system is ready.\nPanel: ${panelChannel}\nRequests: ${requestChannel}` });
}

export async function partnerDashboard(interaction) {
  const data = await getPartnerData(interaction.client, interaction.guildId);
  const pending = data.applications.filter(a => a.status === 'pending').length;
  const active = data.partners.filter(p => p.status === 'active').length;
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('🤝 Partnership Management')
    .setDescription('Manage partnership requests and active partners from this dashboard.')
    .addFields(
      { name: 'Active Partners', value: String(active), inline: true },
      { name: 'Pending Requests', value: String(pending), inline: true },
      { name: 'Total Applications', value: String(data.applications.length), inline: true },
      { name: 'Requirements', value: `${data.requirements.minMembers}+ members • Invite ${data.requirements.requireInvite ? 'required' : 'optional'}` },
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('partner_pending').setLabel('Pending').setEmoji('🟡').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('partner_active').setLabel('Partners').setEmoji('🤝').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('partner_stats').setLabel('Statistics').setEmoji('📊').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('partner_settings').setLabel('Settings').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
  );
  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

export function applicationEmbed(app, guild) {
  const status = app.status === 'accepted' ? '🟢 Accepted' : app.status === 'rejected' ? '🔴 Rejected' : '🟡 Pending';
  return new EmbedBuilder().setColor(app.status === 'accepted' ? 0x57f287 : app.status === 'rejected' ? 0xed4245 : 0x5865f2)
    .setTitle(`🤝 Partnership Request #${app.id}`).addFields(
      { name: 'Server', value: app.serverName, inline: true },
      { name: 'Members', value: String(app.members), inline: true },
      { name: 'Status', value: status, inline: true },
      { name: 'Invite', value: app.invite, inline: false },
      { name: 'Applicant', value: `<@${app.applicantId}>`, inline: true },
      { name: 'Description', value: app.description || 'No description provided.' },
      { name: 'Submitted', value: `<t:${Math.floor(new Date(app.createdAt).getTime() / 1000)}:R>` },
      ...(app.reviewedBy ? [{ name: 'Reviewed By', value: `<@${app.reviewedBy}>`, inline: true }] : []),
    );
}

export function applicationButtons(app) {
  if (app.status !== 'pending') return [];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`partner_accept:${app.id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`partner_reject:${app.id}`).setLabel('Reject').setStyle(ButtonStyle.Danger),
  )];
}
