// Legacy Security aliases were retired.
// Keep the legacy back button registered as a standalone fallback so an
// existing Security panel can still navigate back if the canonical handler
// registry is unavailable.
export default [
  {
    name: 'security_back2',
    execute: async interaction => {
      const { buildSecurityDashboard } = await import('../../../handlers/securityDashboardCore.js');
      return interaction.update(await buildSecurityDashboard(interaction.client, interaction.guild, interaction.user.id));
    },
  },
];
