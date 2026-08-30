import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import dashboard from './modules/logging_dashboard.js';
import channel from './modules/logging_channel.js';
import { setupLoggingSystem } from '../../services/loggingSetupService.js';

import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { successEmbed } from '../../utils/embeds.js';

export default {
    data: new SlashCommandBuilder()
        .setName('logging')
        .setDescription('Manage server logging — channels, filters, and event categories.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Automatically create the Orbit logging category and channels.'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Open the logging dashboard — set channels, filters, and toggle categories.'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('channel')
                .setDescription('Quick-set a log channel without opening the dashboard.')
                .addStringOption((option) =>
                    option
                        .setName('destination')
                        .setDescription('Which log destination to configure.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Audit (moderation, messages, members…)', value: 'audit' },
                            { name: 'Applications', value: 'applications' },
                            { name: 'Reports', value: 'reports' },
                        ),
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('The text channel for logs.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('disable')
                        .setDescription('Set to True to clear this log channel.')
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
                        `The **ORBIT LOGS** category is ready.\n${createdText}\n\nUse \/logging dashboard to manage event categories and ignore filters.`,
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
