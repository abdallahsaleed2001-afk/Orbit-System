import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getPropertyCatalog } from '../../services/propertyService.js';

export default {
    data: new SlashCommandBuilder().setName('properties').setDescription('View available Orbit properties'),
    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;
        const properties = await getPropertyCatalog(client, interaction.guildId);
        const embed = createEmbed({ title: '🏠 Orbit Properties', description: 'Buy with your bank balance. Upgrades need materials.' });
        for (const property of properties) {
            embed.addFields({ name: `${property.emoji} ${property.name}`, value: `Buy: **$${property.price.toLocaleString()}**\nIncome: **$${property.income.toLocaleString()}/hour**\nMax level: **${property.maxLevel}**`, inline: true });
        }
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'properties' }),
};