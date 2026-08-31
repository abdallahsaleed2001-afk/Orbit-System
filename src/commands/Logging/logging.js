import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import dashboard from './modules/logging_dashboard.js';
import channel from './modules/logging_channel.js';
import { setupLoggingSystem } from '../../services/loggingSetupService.js';

import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { successEmbed } from '../../utils/embeds.js';

const LOG_CHANNEL_CHOICES = [
    { name: 'Moderation Logs', value: 'moderation' },
    { name: 'Message Logs', value: 'message' },
    { name: 'Member Logs', value: 'member' },
    { name: 'Role Logs', value: 'role' },
    { name: 'Leveling Logs', value: 'leveling' },
    { name: 'Reaction Role Logs', value: 'reactionrole' },
    { name: 'Giveaway Logs', value: 'giveaway' },
    { name: 'Counter Logs', value: 'counter' },
    { name: 'Application Logs', value: 'application' },
    { name: 'Report Logs', value: 'report' },
];

export default {
    data: new SlashCommandBuilder()
        .setName('logging')
        .setDescription('Manage the server logging system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Automatically create the PlayArab logging category and channels.'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Open the logging dashboard.'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('channel')
                .setDescription('Set or clear one of the logging channels.')
                .addStringOption((option) =>
                    option
                        .setName('destination')
                        .setDescription('Which logging channel to configure.')
                        .setRequired(true)
                        .addChoices(...LOG_CHANNEL_CHOICES),
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('The text channel for this log type.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('disable')
                        .setDescription('Set to True to clear this logging channel.')
                        .setRequired(false),
                ),
        ),

    async execute(interaction, config, client) {
        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'setup') {
                await InteractionHelper.safeDefer(interaction, { ephemeral: true });
                const result = await setupLoggingSystem(client, interaction.guildId);
                const createdText = result.created.length
                    ? `Created **${result.created.length}** missing logging channel${result.created.length === 1 ? '' : 's'}.`
                    : 'All logging channels already existed; configuration was repaired.';

                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed(
                        'Logging System Ready',
                        `The **PLAYAR LOGS** category is ready.\n${createdText}\n\nUse \/logging dashboard to manage event categories and ignore filters.`,
                    )],
                });
            }

            if (subcommand === 'dashboard') {
                return await dashboard.execute(interaction, config, client);
            }

            if (subcommand === 'channel') {
                return await channel.execute(interaction, config, client);
            }

            await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'This subcommand is not recognised.' });
        } catch (error) {
            logger.error('logging command error:', error);
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: error?.message || 'An unexpected error occurred.' }).catch(() => {});
        }
    },
};
