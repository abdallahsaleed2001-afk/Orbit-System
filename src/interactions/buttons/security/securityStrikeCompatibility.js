import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getStrikes, clearStrikes, sendSecurityLog } from '../../../services/security/securityService.js';

const ok = interaction => interaction.customId.split(':').at(-1) === interaction.user.id;
const deny = interaction => interaction.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });
const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

async function manage(interaction, client, userId) {
  const strike = await getStrikes(client, interaction.guildId, userId).catch(() => ({ count: 0, lastReason: '' }));
  return interaction.update({
    embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle('🏆 إدارة Strikes').setDescription(`<@${userId}>\n\n**Strikes:** ${strike.count || 0}\n**آخر سبب:** ${strike.lastReason || '—'}`)],
    components: [new ActionRowBuilder().addComponents(
      button(`strike_reset2:${userId}:${interaction.user.id}`, '🧹 Reset Strikes', ButtonStyle.Danger),
      button(`strikes_back2:${interaction.user.id}`, '← Back')
    )]
  });
}

async function reset(interaction, client, userId) {
  await clearStrikes(client, interaction.guildId, userId);
  await sendSecurityLog(client, interaction.guild, {
    title: 'Strikes Reset',
    description: `<@${userId}> strikes reset by <@${interaction.user.id}>`,
    color: 0x57f287,
  });
  return manage(interaction, client, userId);
}

export default [
  { name: 'strike_manage2', execute: async (i, c, args) => ok(i) ? manage(i, c, args[0]) : deny(i) },
  { name: 'strike_reset2', execute: async (i, c, args) => ok(i) ? reset(i, c, args[0]) : deny(i) },
  { name: 'strikes_back2', execute: async (i, c) => ok(i) ? i.update({ components: [new ActionRowBuilder().addComponents(button(`security_back2:${i.user.id}`, '← Back'))] }) : deny(i) },
];