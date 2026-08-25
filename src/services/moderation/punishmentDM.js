import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';

export async function sendPunishmentDM({ user, guild, type, duration = null, reason = 'No reason provided', caseId }) {
  if (!user?.send || !guild?.id) {
    logger.warn('Punishment DM skipped: invalid user or guild', {
      event: 'moderation.punishment_dm.invalid_target',
      guildId: guild?.id,
      userId: user?.id,
      type,
      caseId,
    });
    return false;
  }

  try {
    const label = type === 'mute' ? '🔇 Mute' : '⏳ Timeout';
    const actionText = type === 'mute' ? 'Muted' : 'Timed Out';
    const durationText = duration ? `\n**Duration:** ${duration}` : '\n**Duration:** Permanent';

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(`${label} Applied`)
      .setDescription(
        `You have been **${actionText.toLowerCase()}** in **${guild.name}**.` +
        `${durationText}\n\n**Reason:** ${reason}\n**Case:** #${caseId || '—'}`
      )
      .setFooter({ text: 'If you believe this punishment was issued incorrectly, you can appeal below.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`moderation_appeal:${guild.id}:${caseId || '0'}:${type}`)
        .setLabel('Appeal / اعتراض')
        .setStyle(ButtonStyle.Primary)
    );

    await user.send({ embeds: [embed], components: [row] });

    logger.info('Punishment DM sent successfully', {
      event: 'moderation.punishment_dm.sent',
      guildId: guild.id,
      userId: user.id,
      type,
      caseId,
    });

    return true;
  } catch (error) {
    logger.warn('Could not send punishment DM', {
      event: 'moderation.punishment_dm.failed',
      guildId: guild?.id,
      userId: user?.id,
      type,
      caseId,
      error: error?.message || String(error),
      code: error?.code,
    });
    return false;
  }
}
