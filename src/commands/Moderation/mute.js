import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

const MUTED_ROLE_NAME = 'muted';

export default {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mutes a member by giving them the Muted role.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The member to mute.')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  category: 'moderation',

  async execute(interaction, config, client) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;

    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id);

    const mutedRole = interaction.guild.roles.cache.find(
      role => role.name.toLowerCase() === MUTED_ROLE_NAME.toLowerCase()
    );

    if (!mutedRole) {
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: 'The `Muted` role could not be found.'
      });
    }

    if (member.roles.cache.has(mutedRole.id)) {
      return await replyUserError(interaction, {
        type: ErrorTypes.UNKNOWN,
        message: `${member} is already muted.`
      });
    }

    if (
      member.id === interaction.guild.ownerId ||
      member.roles.highest.position >= interaction.member.roles.highest.position
    ) {
      return await replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'You cannot mute this member because their highest role is equal to or higher than yours.'
      });
    }

    if (mutedRole.position >= interaction.guild.members.me.roles.highest.position) {
      return await replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'My role must be above the `Muted` role.'
      });
    }

    try {
      await member.roles.add(
        mutedRole,
        `Muted by ${interaction.user.tag}`
      );

      await logEvent({
        client,
        guild: interaction.guild,
        event: {
          action: 'Member Muted',
          target: `${member.user.tag} (${member.id})`,
          executor: `${interaction.user.tag} (${interaction.user.id})`,
          metadata: {
            userId: member.id,
            roleId: mutedRole.id,
            moderatorId: interaction.user.id
          }
        }
      });

      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          successEmbed(
            '🔇 Member Muted',
            `${member} has been muted successfully.`
          )
        ]
      });
    } catch (error) {
      logger.error('Mute command error:', error);

      await replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'I could not give the Muted role to this member. Check my Manage Roles permission and role position.'
      });
    }
  }
};
