import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { setupPartnerPanel } from '../../utils/partner.js';

export default {
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('Manage the server partnership system')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Create the partnership panel'))
    .addSubcommand(sub => sub
      .setName('dashboard')
      .setDescription('Open the partnership management dashboard'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'setup') return setupPartnerPanel(interaction);
    return interaction.reply({
      content: 'The partnership dashboard will be available after setup.',
      ephemeral: true,
    });
  },
};
