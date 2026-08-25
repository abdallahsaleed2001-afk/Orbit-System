import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getAppeals, reviewAppeal } from '../../../services/moderation/appealService.js';
import { sendSecurityLog } from '../../../services/security/securityService.js';

const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const allowed = interaction => interaction.customId.split(':').at(-1) === interaction.user.id;

function listEmbed(guild, appeals) {
  const lines = appeals.length
    ? appeals.slice(0, 10).map((a, i) => `${i + 1}. **#${a.id}** — <@${a.userId}> • **${a.type}** • Case **#${a.caseId}**`).join('\n')
    : '✅ No pending appeals.';
  return new EmbedBuilder()
    .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle('📨 Appeals')
    .setDescription(`Pending moderation appeals for **${guild.name}**.\n\n${lines}`)
    .setColor(0x5865f2)
    .setFooter({ text: 'Select an appeal below to review it.' })
    .setTimestamp();
}

async function renderList(interaction) {
  const appeals = await getAppeals(interaction.guildId, 'pending');
  const components = [new ActionRowBuilder().addComponents(button(`security_back:${interaction.user.id}`, '← Back'))];
  for (let i = 0; i < Math.min(appeals.length, 10); i += 5) {
    components.push(new ActionRowBuilder().addComponents(...appeals.slice(i, i + 5).map(a => button(`security_appeal_view:${a.id}:${interaction.user.id}`, `#${a.id}` , ButtonStyle.Primary))));
  }
  return interaction.update({ embeds: [listEmbed(interaction.guild, appeals)], components });
}

async function viewAppeal(interaction, appealId) {
  const appeal = (await getAppeals(interaction.guildId)).find(a => String(a.id) === String(appealId));
  if (!appeal) return interaction.reply({ content: 'This appeal no longer exists.', ephemeral: true });
  const status = appeal.status === 'pending' ? '🟡 Pending' : `**${appeal.status}**`;
  return interaction.update({
    embeds: [new EmbedBuilder().setTitle(`📨 Appeal #${appeal.id}`).setDescription(`**Member:** <@${appeal.userId}>\n**Type:** ${appeal.type}\n**Case:** #${appeal.caseId}\n**Status:** ${status}\n\n**Reason:**\n${String(appeal.reason || '—').slice(0, 3500)}`).setColor(0x5865f2).setTimestamp()],
    components: [new ActionRowBuilder().addComponents(
      button(`security_appeal_accept:${appeal.id}:${interaction.user.id}`, '✅ قبول الاعتراض', ButtonStyle.Success),
      button(`security_appeal_reject:${appeal.id}:${interaction.user.id}`, '❌ رفض الاعتراض', ButtonStyle.Danger),
      button(`security_appeal_close:${appeal.id}:${interaction.user.id}`, '🔒 إغلاق', ButtonStyle.Secondary),
    ), new ActionRowBuilder().addComponents(button(`security_appeals:${interaction.user.id}`, '← Appeals'))]
  });
}

async function decide(interaction, client, appealId, status) {
  const appeal = (await getAppeals(interaction.guildId, 'pending')).find(a => String(a.id) === String(appealId));
  if (!appeal) return interaction.reply({ content: 'This appeal is already reviewed or does not exist.', ephemeral: true });

  const member = await interaction.guild.members.fetch(appeal.userId).catch(() => null);
  let action = 'No punishment change was required.';
  if (status === 'approved' && member) {
    if (appeal.type === 'timeout' || appeal.type === 'mute') {
      if (member.communicationDisabledUntilTimestamp) {
        await member.timeout(null, `Appeal #${appeal.id} approved by ${interaction.user.tag}`).catch(() => {});
        action = 'Active timeout removed.';
      } else if (appeal.type === 'mute') {
        const muteRole = interaction.guild.roles.cache.get('1535481560172728402');
        if (muteRole && member.roles.cache.has(muteRole.id)) {
          await member.roles.remove(muteRole, `Appeal #${appeal.id} approved by ${interaction.user.tag}`).catch(() => {});
          action = 'Mute role removed.';
        }
      }
    }
  }

  const reviewed = await reviewAppeal(interaction.guildId, appeal.id, status, interaction.user.id, action);
  await sendSecurityLog(client, interaction.guild, {
    title: status === 'approved' ? '✅ Appeal Approved' : '❌ Appeal Rejected',
    description: `Appeal **#${appeal.id}** for <@${appeal.userId}> was **${status}** by <@${interaction.user.id}>.`,
    color: status === 'approved' ? 0x57f287 : 0xed4245,
    fields: [
      { name: 'Case', value: `#${appeal.caseId}`, inline: true },
      { name: 'Type', value: appeal.type, inline: true },
      { name: 'Action', value: action, inline: false },
    ],
  }).catch(() => {});

  const user = await client.users.fetch(appeal.userId).catch(() => null);
  await user?.send({ embeds: [new EmbedBuilder().setTitle(status === 'approved' ? '✅ Appeal Accepted' : '❌ Appeal Rejected').setDescription(`Your appeal **#${appeal.id}** has been **${status === 'approved' ? 'accepted' : 'rejected'}** by the server staff.\n\n${action}`).setColor(status === 'approved' ? 0x57f287 : 0xed4245)] }).catch(() => {});
  return renderList(interaction);
}

export default [
  { name: 'security_panel_appeals', execute: async (i, c) => allowed(i) ? renderList(i) : i.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true }) },
  { name: 'security_appeals', execute: async (i, c) => allowed(i) ? renderList(i) : i.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true }) },
  { name: 'security_appeal_view', execute: async (i, c, args) => allowed(i) ? viewAppeal(i, args[0]) : i.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true }) },
  { name: 'security_appeal_accept', execute: async (i, c, args) => allowed(i) ? decide(i, c, args[0], 'approved') : i.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true }) },
  { name: 'security_appeal_reject', execute: async (i, c, args) => allowed(i) ? decide(i, c, args[0], 'rejected') : i.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true }) },
  { name: 'security_appeal_close', execute: async (i, c, args) => allowed(i) ? decide(i, c, args[0], 'closed') : i.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true }) },
];