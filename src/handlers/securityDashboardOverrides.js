import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getSecurityConfig, updateSecurityConfig } from '../services/security/securityService.js';
import { buildSecurityDashboard, buildSecurityControls } from '../commands/Security/security.js';

const ok = interaction => interaction.customId.split(':').at(-1) === interaction.user.id;
const deny = interaction => interaction.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });
const button = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

async function main(interaction, client) {
  const config = await getSecurityConfig(client, interaction.guildId);
  return interaction.update({
    embeds: [buildSecurityDashboard(config, interaction.guild)],
    components: buildSecurityControls(interaction.user.id),
  });
}

async function automod(interaction, client) {
  const config = await getSecurityConfig(client, interaction.guildId);
  const auto = config.autoMod || {};
  const enabled = !!auto.enabled;
  const row1 = new ActionRowBuilder().addComponents(
    button(`security_main2:${interaction.user.id}`, '← Back'),
    button(`security_automod_toggle3:${interaction.user.id}`, enabled ? '🟢 Disable AutoMod' : '🔴 Enable AutoMod', enabled ? ButtonStyle.Danger : ButtonStyle.Success),
    button(`pun_auto2:${interaction.user.id}`, '⚖️ Punishments', ButtonStyle.Primary),
  );
  const rows = [row1];
  const labels = { spam: 'Spam', duplicate: 'Duplicate', mentions: 'Mentions', invites: 'Invites', links: 'Links', caps: 'Caps', badWords: 'Bad Words' };
  rows.push(new ActionRowBuilder().addComponents(
    ...Object.entries(labels).slice(0, 4).map(([key, label]) => button(`auto_pun2:${key}:${interaction.user.id}`, `${label}: ${auto[key]?.punishment || 'delete'}`, ButtonStyle.Primary)),
  ));
  rows.push(new ActionRowBuilder().addComponents(
    ...Object.entries(labels).slice(4).map(([key, label]) => button(`auto_pun2:${key}:${interaction.user.id}`, `${label}: ${auto[key]?.punishment || 'delete'}`, ButtonStyle.Primary)),
  ));
  return interaction.update({
    embeds: [new EmbedBuilder()
      .setTitle('🤖 AutoMod')
      .setDescription(`**Status:** ${enabled ? '🟢 ACTIVE' : '🔴 OFF'}\n\nConfigure AutoMod punishments below. Each rule can use its own punishment.`)
      .setColor(0x5865f2)
      .setFooter({ text: 'Infinity System • Security Center • Changes save automatically' })],
    components: rows,
  });
}

export default [
  { name: 'security_panel_automod', execute: async (i, c) => ok(i) ? automod(i, c) : deny(i) },
  { name: 'security_panel_automod2', execute: async (i, c) => ok(i) ? automod(i, c) : deny(i) },
  { name: 'security_main2', execute: async (i, c) => ok(i) ? main(i, c) : deny(i) },
  { name: 'security_back2', execute: async (i, c) => ok(i) ? main(i, c) : deny(i) },
  { name: 'security_back', execute: async (i, c) => ok(i) ? main(i, c) : deny(i) },
  { name: 'security_refresh', execute: async (i, c) => ok(i) ? main(i, c) : deny(i) },
  { name: 'security_automod_toggle3', execute: async (i, c) => {
    if (!ok(i)) return deny(i);
    const x = await getSecurityConfig(c, i.guildId);
    await updateSecurityConfig(c, i.guildId, { autoMod: { enabled: !x.autoMod.enabled } });
    return automod(i, c);
  } },
];
