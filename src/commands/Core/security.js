import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { buildSecurityDashboard } from '../../handlers/securityDashboardHandlers.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('security')
    .setDescription('Open the server security control panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  category: 'Core',
  async execute(interaction, config, client) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: 'You need the Manage Server permission to use this panel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    if (!deferred) return;

    const view = await buildSecurityDashboard(client, interaction.guild, interaction.user.id);

    await InteractionHelper.safeEditReply(interaction, view);
  },
};
