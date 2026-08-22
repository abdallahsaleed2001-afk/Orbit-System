import { securityDashboardButtonHandlers } from './securityDashboardHandlers.js';

// Alias the original /security panel IDs to the new hierarchical dashboard.
// This keeps existing command messages/buttons compatible after deployment.
const names = new Set([
  'security_panel_nuke',
  'security_panel_raid',
  'security_panel_punishments',
  'security_panel_strikes',
  'security_panel_whitelist',
  'security_panel_logs',
  'security_panel_settings',
]);

const target = {
  security_panel_nuke: 'security_panel_nuke2',
  security_panel_raid: 'security_panel_raid2',
  security_panel_punishments: 'security_panel_punishments2',
  security_panel_strikes: 'security_panel_strikes2',
  security_panel_whitelist: 'security_panel_whitelist2',
  security_panel_logs: 'security_panel_logs2',
  security_panel_settings: 'security_panel_settings2',
};

export default [...names].map(name => ({
  name,
  execute: async (interaction, client) => {
    const handler = securityDashboardButtonHandlers.find(h => h.name === target[name]);
    if (!handler) return interaction.reply({ content: 'Security panel handler unavailable.', ephemeral: true });
    const original = interaction.customId;
    interaction.customId = `${target[name]}:${interaction.user.id}`;
    try {
      return await handler.execute(interaction, client);
    } finally {
      interaction.customId = original;
    }
  },
}));
