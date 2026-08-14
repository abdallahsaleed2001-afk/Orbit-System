import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { purchaseProperty, upgradeProperty, collectPropertyIncome } from '../../services/propertyService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('property')
        .setDescription('Buy, upgrade, or collect from a property')
        .addStringOption(option => option.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Buy', value: 'buy' }, { name: 'Upgrade', value: 'upgrade' }, { name: 'Collect income', value: 'collect' }))
        .addStringOption(option => option.setName('id').setDescription('Property id, e.g. apartment').setRequired(true)),
    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;
        const action = interaction.options.getString('action', true);
        const id = interaction.options.getString('id', true);
        const args = [client, interaction.guildId, interaction.user.id, id];
        const result = action === 'buy' ? await purchaseProperty(...args)
            : action === 'upgrade' ? await upgradeProperty(...args)
            : await collectPropertyIncome(...args);
        const title = action === 'buy' ? 'Property Purchased' : action === 'upgrade' ? 'Property Upgraded' : 'Income Collected';
        const details = action === 'collect'
            ? `Gross: **$${result.gross.toLocaleString()}**\nMaintenance: **$${result.maintenance.toLocaleString()}**\nNet income: **$${result.net.toLocaleString()}**`
            : action === 'upgrade'
                ? `${result.property.name} is now level **${result.ownership.level}**.`
                : `You bought **${result.property.name}**.`;
        const embed = successEmbed(title, details).addFields({ name: 'Transaction', value: `\`${result.transaction.id}\``, inline: false });
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'property' }),
};