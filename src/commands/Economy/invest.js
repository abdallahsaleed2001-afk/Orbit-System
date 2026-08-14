import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { buyMarketAsset, sellMarketAsset } from '../../services/marketService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('invest')
        .setDescription('Buy or sell an Orbit market asset')
        .addStringOption(option => option.setName('action').setDescription('Buy or sell').setRequired(true).addChoices({ name: 'Buy', value: 'buy' }, { name: 'Sell', value: 'sell' }))
        .addStringOption(option => option.setName('symbol').setDescription('Asset symbol, e.g. NVDA or GOLD').setRequired(true))
        .addIntegerOption(option => option.setName('quantity').setDescription('Number of units').setRequired(true).setMinValue(1)),
    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;
        const action = interaction.options.getString('action', true);
        const symbol = interaction.options.getString('symbol', true);
        const quantity = interaction.options.getInteger('quantity', true);
        const result = action === 'buy'
            ? await buyMarketAsset(client, interaction.guildId, interaction.user.id, symbol, quantity)
            : await sellMarketAsset(client, interaction.guildId, interaction.user.id, symbol, quantity);
        const verb = action === 'buy' ? 'Purchased' : 'Sold';
        const embed = successEmbed(`${verb} ${result.asset.symbol}`, `${verb} **${result.quantity}** unit(s) for **$${result.total.toLocaleString()}**.`)
            .addFields({ name: 'Bank balance', value: `$${result.bank.toLocaleString()}`, inline: true }, { name: 'Transaction', value: `\`${result.transaction.id}\``, inline: false });
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'invest' }),
};