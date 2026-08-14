import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { buyCar, sellCar } from '../../services/carService.js';

export default {
    data: new SlashCommandBuilder().setName('car').setDescription('Buy or sell a car')
        .addStringOption(option => option.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Buy', value: 'buy' }, { name: 'Sell', value: 'sell' }))
        .addStringOption(option => option.setName('id').setDescription('Catalog ID to buy or garage instance ID to sell').setRequired(true)),
    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;
        const action = interaction.options.getString('action', true);
        const id = interaction.options.getString('id', true);
        const result = action === 'buy' ? await buyCar(client, interaction.guildId, interaction.user.id, id) : await sellCar(client, interaction.guildId, interaction.user.id, id);
        const embed = action === 'buy'
            ? successEmbed('Car Purchased', 'You bought **' + result.car.name + '**.').addFields({ name: 'Garage ID', value: '`' + result.car.instanceId + '`', inline: false }, { name: 'Transaction', value: '`' + result.transaction.id + '`', inline: false })
            : successEmbed('Car Sold', 'You sold **' + result.car.name + '** for **$' + result.saleValue.toLocaleString() + '**.').addFields({ name: 'Transaction', value: '`' + result.transaction.id + '`', inline: false });
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'car' }),
};