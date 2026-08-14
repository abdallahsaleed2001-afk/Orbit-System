import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getMaterials } from '../../services/propertyService.js';

export default {
    data: new SlashCommandBuilder().setName('materials').setDescription('View your building materials'),
    execute: withErrorHandling(async (interaction, config, client) => {
        if (!await InteractionHelper.safeDefer(interaction)) return;
        const materials = await getMaterials(client, interaction.guildId, interaction.user.id);
        const description = materials.length ? materials.map(item => `**${item.name}** × ${item.quantity.toLocaleString()}`).join('\n') : 'You do not own any building materials yet.';
        await InteractionHelper.safeEditReply(interaction, { embeds: [createEmbed({ title: '🧱 Building Materials', description })] });
    }, { command: 'materials' }),
};