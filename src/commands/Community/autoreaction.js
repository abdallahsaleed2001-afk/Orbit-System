import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getGuildConfig, updateGuildConfig } from '../../services/config/guildConfig.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

function normalizeEmoji(value) {
  return String(value ?? '').trim();
}

function normalizeRooms(value) {
  if (Array.isArray(value)) return value.filter((room) => room && typeof room === 'object');
  if (value?.enabled && value?.channelId && value?.reaction) {
    return [{ slot: 1, enabled: true, channelId: value.channelId, reaction: value.reaction }];
  }
  return [];
}

export default {
  data: new SlashCommandBuilder()
    .setName('autoreaction')
    .setDescription('Manage automatic reactions for multiple channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('setup')
      .setDescription('Set or update an automatic reaction room')
      .addIntegerOption((opt) => opt
        .setName('room')
        .setDescription('Room number to configure')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(true))
      .addChannelOption((opt) => opt
        .setName('channel')
        .setDescription('Channel where every new message gets the reaction')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addStringOption((opt) => opt
        .setName('reaction')
        .setDescription('Emoji or custom Discord emoji')
        .setRequired(true)
        .setMaxLength(100)))
    .addSubcommand((sub) => sub
      .setName('disable')
      .setDescription('Disable one automatic reaction room')
      .addIntegerOption((opt) => opt
        .setName('room')
        .setDescription('Room number to disable')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('status')
      .setDescription('Show all automatic reaction rooms')),
  category: 'Community',
  execute: withErrorHandling(async (interaction, guildConfig) => {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const config = guildConfig || await getGuildConfig(interaction.client, interaction.guildId);
    const rooms = normalizeRooms(config.autoReaction);
    const sub = interaction.options.getSubcommand();

    if (sub === 'disable') {
      const roomNumber = interaction.options.getInteger('room', true);
      const index = rooms.findIndex((room) => Number(room.slot) === roomNumber);
      if (index === -1) {
        return interaction.reply({ content: `Room ${roomNumber} is not configured.`, ephemeral: true });
      }

      rooms[index] = { ...rooms[index], enabled: false };
      await updateGuildConfig(interaction.client, interaction.guildId, { autoReaction: rooms });
      return interaction.reply({ content: `Auto Reaction Room ${roomNumber} has been disabled.`, ephemeral: true });
    }

    if (sub === 'status') {
      const enabledRooms = rooms.filter((room) => room.enabled && room.channelId && room.reaction);
      if (!enabledRooms.length) {
        return interaction.reply({ content: 'Automatic reactions are currently disabled.', ephemeral: true });
      }

      const lines = enabledRooms
        .sort((a, b) => Number(a.slot) - Number(b.slot))
        .map((room) => `**Room ${room.slot}:** <#${room.channelId}> → ${room.reaction}`);

      return interaction.reply({
        content: `**Auto Reaction**\n${lines.join('\n')}`,
        ephemeral: true,
      });
    }

    const roomNumber = interaction.options.getInteger('room', true);
    const channel = interaction.options.getChannel('channel', true);
    const reaction = normalizeEmoji(interaction.options.getString('reaction', true));
    if (!reaction) return interaction.reply({ content: 'The reaction cannot be empty.', ephemeral: true });

    const me = interaction.guild.members.me;
    if (!me?.permissionsIn(channel).has('AddReactions')) {
      return interaction.reply({ content: 'I need the Add Reactions permission in that channel.', ephemeral: true });
    }

    const existingIndex = rooms.findIndex((room) => Number(room.slot) === roomNumber);
    const roomConfig = {
      slot: roomNumber,
      enabled: true,
      channelId: channel.id,
      reaction,
    };

    if (existingIndex === -1) rooms.push(roomConfig);
    else rooms[existingIndex] = roomConfig;

    rooms.sort((a, b) => Number(a.slot) - Number(b.slot));
    await updateGuildConfig(interaction.client, interaction.guildId, { autoReaction: rooms });

    return interaction.reply({
      content: `Auto Reaction Room ${roomNumber} enabled.\nChannel: <#${channel.id}>\nReaction: ${reaction}`,
      ephemeral: true,
    });
  }),
};
