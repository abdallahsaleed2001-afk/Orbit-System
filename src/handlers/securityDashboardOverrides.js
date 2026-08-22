import { buildSecurityDashboard, buildSecurityControls } from '../commands/Security/security.js';
import { getSecurityConfig } from '../services/security/securityService.js';

const ok = interaction => interaction.customId.split(':').at(-1) === interaction.user.id;
const deny = interaction => interaction.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });

async function main(interaction, client) {
  const config = await getSecurityConfig(client, interaction.guildId);
  return interaction.update({
    embeds: [buildSecurityDashboard(config, interaction.guild)],
    components: buildSecurityControls(interaction.user.id),
  });
}

export default [
  { name: 'security_main2', execute: async (i, c) => ok(i) ? main(i, c) : deny(i) },
  { name: 'security_back2', execute: async (i, c) => ok(i) ? main(i, c) : deny(i) },
  { name: 'security_back', execute: async (i, c) => ok(i) ? main(i, c) : deny(i) },
  { name: 'security_refresh', execute: async (i, c) => ok(i) ? main(i, c) : deny(i) },
];
