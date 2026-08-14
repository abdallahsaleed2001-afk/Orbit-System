import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, warningEmbed, buildUserErrorEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { BotConfig } from '../../config/bot.js';
import { executeRobbery } from '../../services/securityService.js';

const economyConfig = BotConfig.economy || {};

export default {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to rob another user (very risky)')
        .addUserOption(option => option
            .setName('user')
            .setDescription('User to rob')
            .setRequired(true)),

    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;

        const victim = interaction.options.getUser('user', true);
        if (victim.bot) {
            throw createError('Cannot rob bot', ErrorTypes.VALIDATION, 'You cannot rob a bot.');
        }

        const result = await executeRobbery(client, interaction.guildId, interaction.user.id, victim.id, {
            cooldownMs: economyConfig.cooldowns?.rob ?? 4 * 60 * 60 * 1000,
            successChance: economyConfig.robSuccessRate ?? 0.4,
        });

        const embed = result.success
            ? successEmbed('Robbery Successful', `You stole **$${result.stolen.toLocaleString()}** from ${victim.username}.`)
            : buildUserErrorEmbed('unknown', `You were caught. Fine: **$${result.fine.toLocaleString()}**.`, { titleOverride: 'Robbery Failed' });

        if (result.success) {
            embed.addFields(
                { name: 'Protection', value: result.protection.level, inline: true },
                { name: 'Protection blocked', value: `$${result.blocked.toLocaleString()}`, inline: true },
            );
        }
        embed.addFields(
            { name: 'Your cash', value: `$${result.robberWallet.toLocaleString()}`, inline: true },
            { name: `${victim.username}'s cash`, value: `$${result.victimWallet.toLocaleString()}`, inline: true },
            { name: 'Transaction', value: `\`${result.transaction.id}\``, inline: false },
        ).setFooter({ text: `Next robbery in ${Math.ceil(result.cooldownMs / 3600000)} hours.` });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'rob' }),
};
