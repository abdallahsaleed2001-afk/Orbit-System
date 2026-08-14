import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { withdrawFromBank } from '../../services/orbitBankService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw money from your bank to your wallet')
        .addIntegerOption(option => option
            .setName('amount')
            .setDescription('Amount to withdraw')
            .setRequired(true)
            .setMinValue(1)),

    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;

        const result = await withdrawFromBank(
            client,
            interaction.guildId,
            interaction.user.id,
            interaction.options.getInteger('amount', true),
        );

        const embed = successEmbed('Withdrawal Successful', `Withdrew **$${result.transaction.amount.toLocaleString()}** from your bank.`)
            .addFields(
                { name: 'Cash', value: `$${result.wallet.toLocaleString()}`, inline: true },
                { name: 'Bank', value: `$${result.bank.toLocaleString()}`, inline: true },
                { name: 'Transaction', value: `\`${result.transaction.id}\``, inline: false },
            );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'withdraw' }),
};
