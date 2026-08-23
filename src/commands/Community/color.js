import {
  AttachmentBuilder,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  buildColors,
  buildColorImageSvg,
  getColorConfig,
  saveColorConfig,
} from '../../services/colorService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('color')
    .setDescription('Manage the server color system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('setup')
      .setDescription('Create the 100 server colors and colors channel'))
    .addSubcommand((sub) => sub
      .setName('panel')
      .setDescription('Resend the color image in the configured channel'))
    .addSubcommand((sub) => sub
      .setName('reset')
      .setDescription('Remove the color system configuration')),
  category: 'Community',

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const existing = await getColorConfig(interaction.client, interaction.guildId);

    if (sub === 'reset') {
      if (!existing) {
        return interaction.reply({ content: 'The color system is not configured.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      for (const roleId of existing.roleIds || []) {
        const role = interaction.guild.roles.cache.get(roleId) || await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (role) await role.delete('Color system reset').catch(() => {});
      }
      if (existing.channelId) {
        const channel = interaction.guild.channels.cache.get(existing.channelId) || await interaction.guild.channels.fetch(existing.channelId).catch(() => null);
        if (channel) await channel.delete('Color system reset').catch(() => {});
      }
      await interaction.client.db.delete?.(`colors:${interaction.guildId}`).catch?.(() => {});
      if (!interaction.client.db.delete) await saveColorConfig(interaction.client, interaction.guildId, null);
      return interaction.editReply('Color system reset successfully.');
    }

    if (sub === 'panel') {
      if (!existing?.enabled || !existing.channelId) {
        return interaction.reply({ content: 'Run `/color setup` first.', ephemeral: true });
      }
      const channel = interaction.guild.channels.cache.get(existing.channelId) || await interaction.guild.channels.fetch(existing.channelId).catch(() => null);
      if (!channel?.isTextBased()) {
        return interaction.reply({ content: 'The configured color channel no longer exists.', ephemeral: true });
      }
      await sendColorImage(channel, existing.colors);
      return interaction.reply({ content: 'Color image sent.', ephemeral: true });
    }

    if (existing?.enabled) {
      return interaction.reply({ content: `The color system is already configured in <#${existing.channelId}>.`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const me = interaction.guild.members.me || await interaction.guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles) || !me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply('I need **Manage Roles** and **Manage Channels** permissions to set up the color system.');
    }

    const colors = buildColors();
    const roleIds = [];

    for (const color of colors) {
      const role = await interaction.guild.roles.create({
        name: `Color ${String(color.number).padStart(3, '0')}`,
        color: color.hex,
        reason: 'Color system setup',
      });
      roleIds.push(role.id);
    }

    const channel = await interaction.guild.channels.create({
      name: 'colors',
      type: ChannelType.GuildText,
      topic: 'Choose your server color by typing: لون 40',
    });

    const config = {
      enabled: true,
      channelId: channel.id,
      roleIds,
      colors,
      createdAt: new Date().toISOString(),
    };
    await saveColorConfig(interaction.client, interaction.guildId, config);
    await sendColorImage(channel, colors);

    return interaction.editReply(`Color system created successfully.\nChannel: <#${channel.id}>\nColors created: **100**\nUse **لون 1** through **لون 100** to select a color.`);
  },
};

async function sendColorImage(channel, colors) {
  const svg = buildColorImageSvg(colors);
  const attachment = new AttachmentBuilder(Buffer.from(svg, 'utf8'), { name: 'server-colors.svg' });
  await channel.send({ content: '🎨 **Server Colors**\nاكتب `لون رقم` لاختيار لونك، مثل `لون 40`.', files: [attachment] });
}
