import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export async function setupPartnerPanel(interaction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  let channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === 'partnerships');
  if (!channel) {
    channel = await guild.channels.create({
      name: 'partnerships',
      type: ChannelType.GuildText,
      reason: 'Partner system setup',
      permissionOverwrites: [
        { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
      ],
    });
  }

  let requestChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === 'partnership-requests');
  if (!requestChannel) {
    requestChannel = await guild.channels.create({
      name: 'partnership-requests',
      type: ChannelType.GuildText,
      reason: 'Partner system request channel',
      permissionOverwrites: [
        { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
      ],
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🤝 Server Partnerships')
    .setDescription('Interested in partnering with this server?\n\nReview the requirements and submit your partnership request using the buttons below.')
    .addFields({ name: 'Requirements', value: '• Active community\n• Valid invite link\n• No recent serious violations\n• Server must meet the configured member/activity requirements' })
    .setFooter({ text: `${guild.name} • Partnership System` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('partner_apply').setLabel('Apply for Partnership').setEmoji('🤝').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('partner_requirements').setLabel('Requirements').setEmoji('📋').setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [embed], components: [row] });
  return interaction.editReply({ content: `Partnership panel is ready in ${channel}.\nRequests: ${requestChannel}` });
}
