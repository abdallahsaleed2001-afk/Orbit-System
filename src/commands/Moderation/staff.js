import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { calculateActivityScore, countWarnings, getStaffData, getStaffProfile } from '../../services/staffService.js';

export default {
  data: new SlashCommandBuilder().setName('staff').setDescription('View staff activity and moderation statistics.').addUserOption(o => o.setName('member').setDescription('Staff member to inspect').setRequired(false)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  category: 'moderation',
  async execute(interaction) {
    const target = interaction.options.getUser('member') || interaction.user;
    const profile = await getStaffProfile(interaction.guildId, target.id);
    const data = await getStaffData(interaction.guildId);
    const top = Object.entries(data.members).map(([id, p]) => ({ id, score: calculateActivityScore(p) })).sort((a,b) => b.score-a.score).slice(0, 10);
    const ranking = top.findIndex(x => x.id === target.id);
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`👮 Staff Actions • ${target.tag}`).setThumbnail(target.displayAvatarURL()).addFields(
      { name: 'Activity', value: `**${calculateActivityScore(profile)}%**`, inline: true },
      { name: 'Moderation Actions', value: `**${profile.activity?.moderationActions || 0}**`, inline: true },
      { name: 'Warnings', value: `**${countWarnings(profile)}**`, inline: true },
      { name: 'Tickets', value: `**${profile.activity?.ticketsHandled || 0}**`, inline: true },
      { name: 'Promotions', value: `**${profile.promotions?.length || 0}**`, inline: true },
      { name: 'Demotions', value: `**${profile.demotions?.length || 0}**`, inline: true },
      { name: 'Top 10 Rank', value: ranking >= 0 ? `#${ranking + 1}` : 'Not ranked', inline: true },
    )], ephemeral: true });
  },
};
