import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getPortfolio } from '../../services/marketService.js';

export default {
    data: new SlashCommandBuilder().setName('portfolio').setDescription('View your investments'),
    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;
        const portfolio = await getPortfolio(client, interaction.guildId, interaction.user.id);
        const description = portfolio.positions.length
            ? portfolio.positions.map(p => `**${p.asset.symbol}** × ${p.quantity} — $${p.value.toLocaleString()} (${p.profit >= 0 ? '+' : ''}$${p.profit.toLocaleString()})`).join('\n')
            : 'You do not own any investments yet.';
        const embed = createEmbed({ title: '📊 Your Portfolio', description }).addFields({ name: 'Portfolio value', value: `$${portfolio.value.toLocaleString()}`, inline: true });
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'portfolio' }),
};