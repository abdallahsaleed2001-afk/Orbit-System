import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getModerationCases } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription('View moderation cases and audit logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
    .setDMPermission(false)
    .addStringOption(option => option.setName('filter').setDescription('Filter cases by type or user').addChoices(
      { name: 'All Cases', value: 'all' },
      { name: 'Bans', value: 'Member Banned' },
      { name: 'Kicks', value: 'Member Kicked' },
      { name: 'Timeouts', value: 'Member Timed Out' },
      { name: 'Warnings', value: 'User Warned' },
      { name: 'Mutes', value: 'Member Muted' },
      { name: 'Unmutes', value: 'Member Unmuted' },
      { name: 'Unbans', value: 'Member Unbanned' },
    ))
    .addUserOption(option => option.setName('user').setDescription('Filter cases by specific user'))
    .addIntegerOption(option => option.setName('limit').setDescription('Number of cases to show (default: 10)').setMinValue(1).setMaxValue(50)),
  category: 'moderation',

  async execute(interaction, config, client) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;
    try {
      const filterType = interaction.options.getString('filter') || 'all';
      const targetUser = interaction.options.getUser('user');
      const limit = interaction.options.getInteger('limit') || 10;
      const cases = await getModerationCases(interaction.guild.id, { limit, action: filterType === 'all' ? undefined : filterType, userId: targetUser?.id });
      if (!cases.length) throw new Error(targetUser ? `No moderation cases found for ${targetUser.tag}` : `No ${filterType === 'all' ? '' : filterType} cases found in this server.`);

      const CASES_PER_PAGE = 5;
      const totalPages = Math.ceil(cases.length / CASES_PER_PAGE);
      let currentPage = 1;
      const createCasesEmbed = page => {
        const pageCases = cases.slice((page - 1) * CASES_PER_PAGE, page * CASES_PER_PAGE);
        const embed = createEmbed({ title: 'Moderation Cases', description: `Showing moderation cases for **${interaction.guild.name}**\n\n**Page ${page} of ${totalPages}**` });
        pageCases.forEach(case_ => {
          const date = new Date(case_.createdAt).toLocaleDateString();
          const time = new Date(case_.createdAt).toLocaleTimeString();
          embed.addFields({ name: `Case #${case_.caseId} - ${case_.action}`, value: `**Target:** ${case_.target}\n**Moderator:** ${case_.executor}\n**Date:** ${date} at ${time}\n**Reason:** ${case_.reason || 'No reason provided'}${case_.duration ? `\n**Duration:** ${case_.duration}` : ''}`, inline: false });
        });
        embed.setFooter({ text: `Total cases: ${cases.length} | Filter: ${filterType}${targetUser ? ` | User: ${targetUser.tag}` : ''}` });
        return embed;
      };
      const createNavigationRow = page => {
        const row = new ActionRowBuilder();
        row.addComponents(
          new ButtonBuilder().setCustomId('prev_page').setLabel('⬅️ Previous').setStyle(ButtonStyle.Secondary).setDisabled(page === 1),
          new ButtonBuilder().setCustomId('page_info').setLabel(`Page ${page}/${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('next_page').setLabel('Next ➡️').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages),
        );
        return row;
      };
      const message = await interaction.editReply({ embeds: [createCasesEmbed(currentPage)], components: [createNavigationRow(currentPage)] });
      const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });
      collector.on('collect', async buttonInteraction => {
        if (buttonInteraction.user.id !== interaction.user.id) return buttonInteraction.reply({ content: 'You cannot use these buttons. Run `/cases` to get your own case view.', flags: MessageFlags.Ephemeral });
        await buttonInteraction.deferUpdate();
        if (buttonInteraction.customId === 'prev_page' && currentPage > 1) currentPage--;
        else if (buttonInteraction.customId === 'next_page' && currentPage < totalPages) currentPage++;
        await interaction.editReply({ embeds: [createCasesEmbed(currentPage)], components: [createNavigationRow(currentPage)] });
      });
      collector.on('end', async () => {
        const disabledRow = createNavigationRow(currentPage);
        disabledRow.components.forEach(button => button.setDisabled(true));
        await message.edit({ components: [disabledRow] }).catch(() => {});
      });
    } catch (error) {
      logger.error('Error in cases command:', error);
      return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'An error occurred while retrieving moderation cases. Please try again later.' });
    }
  }
};
