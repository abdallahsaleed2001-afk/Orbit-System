import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getEconomyData } from '../../utils/economy.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getAccountProtection } from '../../services/securityService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('protection')
        .setDescription('View your active Orbit Bank protection'),

    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;

        const account = await getEconomyData(client, interaction.guildId, interaction.user.id);
        const protection = getAccountProtection(account);
        const expiry = protection.expiresAt
            ? `<t:${Math.floor(protection.expiresAt / 1000)}:R>`
            : 'No active expiry';

        const embed = createEmbed({
            title: '🛡️ Orbit Protection',
            description: 'Account protection reduces the cash that can be taken by a successful robbery.',
        }).addFields(
            { name: 'Account protection', value: protection.level, inline: true },
            { name: 'Robbery reduction', value: `${Math.round(protection.reduction * 100)}%`, inline: true },
            { name: 'Expires', value: expiry, inline: true },
            { name: 'Property protection', value: 'Coming with the property system', inline: true },
            { name: 'Car protection', value: 'Coming with the car system', inline: true },
            { name: 'Investment protection', value: 'Coming with the investment system', inline: true },
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'protection' }),
};
