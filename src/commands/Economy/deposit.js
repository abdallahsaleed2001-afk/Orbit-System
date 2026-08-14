import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { depositAllToBank, depositToBank } from '../../services/orbitBankService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit money from your wallet into your bank')
        .addStringOption(option => option
            .setName('amount')
            .setDescription('Amount to deposit (number or "all")')
            .setRequired(true)),

    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;

        const input = interaction.options.getString('amount', true).trim().toLowerCase();
        let result;

        if (input === 'all') {
            result = await depositAllToBank(client, interaction.guildId, interaction.user.id);
        } else {
            if (!/^\d+$/.test(input)) {
                throw createError('Invalid deposit amount', ErrorTypes.VALIDATION, 'Enter a positive whole number or "all".');
            }
            result = await depositToBank(client, interaction.guildId, interaction.user.id, Number(input));
        }

        const embed = successEmbed('Deposit Successful', `Deposited **$${result.transaction.amount.toLocaleString()}** into your bank.`)
            .addFields(
                { name: 'Cash', value: `$${result.wallet.toLocaleString()}`, inline: true },
                { name: 'Bank', value: `$${result.bank.toLocaleString()} / $${result.capacity.toLocaleString()}`, inline: true },
                { name: 'Transaction', value: `\`${result.transaction.id}\``, inline: false },
            );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'deposit' }),
};
