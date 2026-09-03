import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

const ok = interaction => interaction.customId.split(':').at(-1) === interaction.user.id;
const deny = interaction => interaction.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });
const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...buttons) => new ActionRowBuilder().addComponents(buttons);

function embed(title, description, guild) {
  return new EmbedBuilder()
    .setAuthor({ name: 'Infinity Security Center', iconURL: guild.iconURL({ size: 128 }) || undefined })
    .setTitle(title)
    .setDescription(description)
    .setColor(0xfee75c)
    .setFooter({ text: 'Infinity System • Changes save automatically' })
    .setTimestamp();
}

async function renderStrikes(interaction) {
  if (!ok(interaction)) return deny(interaction);
  await interaction.deferUpdate().catch(() => null);

  const prefix = `security:strikes:${interaction.guildId}:`;
  const keys = await interaction.client.db.list(prefix).catch(() => []);
  const results = await Promise.all(keys.map(async key => {
    const userId = key.slice(prefix.length);
    if (!userId) return null;
    const strike = await interaction.client.db.get(key, null).catch(() => null);
    const count = Number(strike?.count || 0);
    if (count <= 0) return null;
    const member = interaction.guild.members.cache.get(userId);
    return { id: userId, name: member?.displayName || member?.user?.username || userId, count };
  }));

  const entries = results.filter(Boolean).sort((a, b) => b.count - a.count);
  const text = entries.slice(0, 10).map((entry, index) => `${index + 1}. <@${entry.id}> — **${entry.count}** strikes`).join('\n') || 'No active strikes.';
  const components = [row(button(`security_back2:${interaction.user.id}`, '← Back'), button(`strikes_refresh2:${interaction.user.id}`, '🔄 Refresh', ButtonStyle.Success))];
  for (let i = 0; i < Math.min(entries.length, 8); i += 4) {
    components.push(row(...entries.slice(i, i + 4).map(entry => button(`strike_manage2:${entry.id}:${interaction.user.id}`, entry.name.slice(0, 80), ButtonStyle.Primary))));
  }

  return interaction.editReply({
    embeds: [embed('🏆 Strikes', `**${interaction.guild.name}**\n\n${text}\n\nSelect a member to manage their strikes.`, interaction.guild)],
    components,
  });
}

export default [
  { name: 'security_panel_strikes2', execute: renderStrikes },
  { name: 'security_panel_strikes', execute: renderStrikes },
  { name: 'strikes_refresh2', execute: renderStrikes },
];
