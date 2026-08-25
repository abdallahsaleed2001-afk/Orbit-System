import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { WarningService, applyWarningEscalation } from '../../services/moderation/warningService.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { sendPunishmentDM } from '../../services/moderation/punishmentDM.js';

export default {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a user")
        .addUserOption((o) => o.setName("target").setRequired(true).setDescription("User to warn"))
        .addStringOption((o) => o.setName("reason").setRequired(true).setDescription("Reason for the warning"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) return;

        const target = interaction.options.getUser("target");
        const member = interaction.options.getMember("target");
        const reason = interaction.options.getString("reason");
        const moderator = interaction.user;
        const guildId = interaction.guildId;

        if (!target) throw new TitanBotError('Missing target user', ErrorTypes.USER_INPUT, 'You must specify a user to warn.');
        if (!reason) throw new TitanBotError('Missing warning reason', ErrorTypes.VALIDATION, 'You must provide a reason for the warning.');
        if (!member) throw new TitanBotError("Target not found", ErrorTypes.USER_INPUT, "The target user is not currently in this server.");

        ModerationService.assertModerationHierarchy(interaction.member, member, 'warn');

        const { id, totalCount } = await WarningService.addWarning({
            guildId,
            userId: target.id,
            moderatorId: moderator.id,
            reason,
            timestamp: Date.now()
        });

        const caseId = await logModerationAction({
            client,
            guild: interaction.guild,
            event: {
                action: "User Warned",
                target: `${target.tag} (${target.id})`,
                executor: `${moderator.tag} (${moderator.id})`,
                reason,
                metadata: {
                    userId: target.id,
                    moderatorId: moderator.id,
                    totalWarns: totalCount,
                    warningNumber: totalCount,
                    warningId: id
                }
            }
        });
        await WarningService.attachCaseId(guildId, target.id, id, caseId);

        await sendPunishmentDM({
            user: target,
            guild: interaction.guild,
            type: 'warn',
            reason,
            caseId,
        });

        let escalation;
        try {
            escalation = await applyWarningEscalation({
                guild: interaction.guild,
                member,
                moderator: interaction.member,
                warningCount: totalCount,
                reason,
                client,
            });
        } catch (error) {
            logger.error('Warning escalation failed:', { error: error?.message, guildId, userId: target.id, warningCount: totalCount });
            escalation = { action: 'none', level: totalCount };
        }

        if (escalation.action === 'timeout') {
            await sendPunishmentDM({
                user: target,
                guild: interaction.guild,
                type: 'timeout',
                duration: '1 day',
                reason: `Warning #${totalCount} escalation: ${reason}`,
                caseId,
            });
            await logModerationAction({
                client,
                guild: interaction.guild,
                event: {
                    action: 'Warning Escalation - 1 Day Timeout',
                    target: `${target.tag} (${target.id})`,
                    executor: `${moderator.tag} (${moderator.id})`,
                    reason: `Warning #${totalCount}: ${reason}`,
                    metadata: { userId: target.id, moderatorId: moderator.id, warningNumber: totalCount, durationMs: escalation.durationMs, warningCaseId: caseId }
                }
            });
        } else if (escalation.action === 'kick') {
            await logModerationAction({
                client,
                guild: interaction.guild,
                event: {
                    action: 'Warning Escalation - Kick',
                    target: `${target.tag} (${target.id})`,
                    executor: `${moderator.tag} (${moderator.id})`,
                    reason: `Warning #${totalCount}: ${reason}`,
                    metadata: { userId: target.id, moderatorId: moderator.id, warningNumber: totalCount, warningCaseId: caseId }
                }
            });
            try {
                await target.send({ content: `You have been **kicked** from **${interaction.guild.name}** بسبب reaching warning #${totalCount}.\n**Reason:** ${reason}\n**Warning Case:** #${caseId}` });
            } catch {}
        }

        const escalationText = escalation.action === 'warning_role'
            ? `\n**Warning Role:** ${totalCount <= 3 ? `<@&${escalation.roleId}>` : 'Applied'}`
            : escalation.action === 'timeout'
                ? '\n**Escalation:** ⏳ 1 day timeout'
                : escalation.action === 'kick'
                    ? '\n**Escalation:** 👢 Kicked'
                    : '';

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(`⚠️ **Warned** ${target.tag}`, `**Reason:** ${reason}\n**Total Warns:** ${totalCount}\n**Case:** #${caseId}${escalationText}`)],
        });
    }
};
