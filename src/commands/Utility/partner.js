import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setupPartnerPanel, partnerDashboard } from '../../utils/partner.js';

export default {
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('Manage the server partnership system')
    .addSubcommand(sub => sub.setName('setup').setDescription('Create or repair the partnership system'))
    .addSubcommand(sub => sub.setName('dashboard').setDescription('Open the partnership management dashboard'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'setup') return setupPartnerPanel(interaction);
    return partnerDashboard(interaction);
  },
};
