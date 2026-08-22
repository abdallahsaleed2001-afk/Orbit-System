import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { getSecurityConfig } from '../../services/security/securityService.js';
import { buildSecurityDashboard } from '../../handlers/securityHandlers.js';
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
      await interaction.reply({ content: 'You need the Manage Server permission to use this panel.', flags: MessageFlags.Ephemeral });
      return;
    }

    const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
    if (!deferred) return;

    const securityConfig = await getSecurityConfig(client, interaction.guildId);
    const view = await buildSecurityDashboard(client, interaction.guild);
    view.components = view.components.map((row) => {
      const json = row.toJSON();
      json.components = json.components.map((component) => ({
        ...component,
        custom_id: component.custom_id.replace(':pending', `:${interaction.user.id}`),
      }));
      return json;
    });

    await InteractionHelper.safeEditReply(interaction, {
      embeds: [view.embeds[0]],
      components: view.components,
    });
  },
};
