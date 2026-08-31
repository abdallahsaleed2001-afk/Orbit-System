import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { successEmbed } from '../../utils/embeds.js';

export default {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send an image as the bot.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('image')
                .setDescription('Send an image from a URL or from your device.')
                .addStringOption((option) =>
                    option
                        .setName('url')
                        .setDescription('Direct URL of the image.')
                        .setRequired(false),
                )
                .addAttachmentOption((option) =>
                    option
                        .setName('file')
                        .setDescription('Upload an image from your device.')
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('message')
                        .setDescription('Optional message to send with the image.')
                        .setRequired(false)
                        .setMaxLength(2000),
                ),
        ),
    category: 'Core',

    async execute(interaction) {
        const url = interaction.options.getString('url');
        const file = interaction.options.getAttachment('file');
        const message = interaction.options.getString('message');

        if (!url && !file) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'You must provide either an image URL or upload an image from your device.',
            });
        }

        if (url && file) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Use either the image URL or the uploaded file, not both.',
            });
        }

        if (url) {
            try {
                const parsed = new URL(url);
                if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
            } catch {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'Please provide a valid HTTP/HTTPS image URL.',
                });
            }
        }

        if (file && file.contentType && !file.contentType.startsWith('image/')) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'The uploaded file must be an image.',
            });
        }

        const channel = interaction.channel;
        const botPermissions = channel?.permissionsFor(interaction.guild.members.me);
        if (!channel?.isTextBased() || !botPermissions?.has(PermissionFlagsBits.SendMessages)) {
            return replyUserError(interaction, {
                type: ErrorTypes.PERMISSION,
                message: 'I do not have permission to send images in this channel.',
            });
        }

        const imageSource = file?.url || url;
        const fileName = file?.name || 'image';

        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        const payload = {
            files: [new AttachmentBuilder(imageSource, { name: fileName })],
        };
        if (message) payload.content = message;

        const sentMessage = await channel.send(payload);

        return InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed('Image Sent', `The image was sent successfully. [Jump to message](${sentMessage.url})`)],
        });
    },
};
