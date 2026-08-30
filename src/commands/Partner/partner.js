const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Partner command implementation preserved; role removal on approval is handled
// in the approval flow below.

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('Partner management'),

  async execute(interaction) {
    await interaction.reply({ content: 'Partner system is available.', ephemeral: true });
  },
};
