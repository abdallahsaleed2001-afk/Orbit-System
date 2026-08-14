import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getCarCatalog, getGarage } from '../../services/carService.js';

export default {
    data: new SlashCommandBuilder().setName('cars').setDescription('View available cars or your garage')
        .addBooleanOption(option => option.setName('garage').setDescription('Show your garage instead')),
    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;
        if (interaction.options.getBoolean('garage')) {
            const garage = await getGarage(client, interaction.guildId, interaction.user.id);
            const description = garage.length ? garage.map(car => '**' + car.name + '**\nID: `' + car.instanceId + '` • Value: $' + car.currentValue.toLocaleString() + ' • Condition: ' + car.condition + '%').join('\n\n') : 'Your garage is empty.';
            return InteractionHelper.safeEditReply(interaction, { embeds: [createEmbed({ title: '🚗 Your Garage', description })] });
        }
        const cars = await getCarCatalog(client, interaction.guildId);
        const embed = createEmbed({ title: '🚘 Orbit Motors', description: 'Use /car to purchase from your bank balance.' });
        for (const car of cars) embed.addFields({ name: (car.emoji || '🚗') + ' ' + car.name, value: car.category + ' • **$' + car.price.toLocaleString() + '**\nID: `' + car.id + '`', inline: true });
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'cars' }),
};