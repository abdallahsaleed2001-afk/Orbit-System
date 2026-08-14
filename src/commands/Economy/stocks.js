import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getMarketAssets } from '../../services/marketService.js';

export default {
    data: new SlashCommandBuilder().setName('stocks').setDescription('View Orbit market prices'),
    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;
        const assets = await getMarketAssets(client, interaction.guildId);
        const embed = createEmbed({ title: '📈 Orbit Market', description: 'Prices are shown per unit. Purchases use your bank balance.' });
        for (const asset of assets) {
            const change = ((asset.price - asset.openPrice) / asset.openPrice) * 100;
            embed.addFields({ name: `${asset.symbol} — ${asset.name}`, value: `$${asset.price.toLocaleString()} • ${change >= 0 ? '▲' : '▼'} ${change.toFixed(2)}%`, inline: true });
        }
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'stocks' }),
};