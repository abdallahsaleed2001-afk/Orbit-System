import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

export async function sendPunishmentDM({ user, guild, type, duration = null, reason = 'No reason provided', caseId }) {
  try {
    const label = type === 'mute' ? '🔇 Mute' : '⏳ Timeout';
    const durationText = duration ? `\n**Duration:** ${duration}` : '';
    const embed = new EmbedBuilder().setColor(0xed4245).setTitle(`${label} Applied`).setDescription(`You have received a **${type}** in **${guild.name}**.${durationText}\n\n**Reason:** ${reason}\n**Case:** #${caseId || '—'}`);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`moderation_appeal:${guild.id}:${caseId || '0'}:${type}`).setLabel('Appeal / اعتراض').setStyle(ButtonStyle.Primary));
    await user.send({ embeds: [embed], components: [row] });
    return true;
  } catch { return false; }
}
