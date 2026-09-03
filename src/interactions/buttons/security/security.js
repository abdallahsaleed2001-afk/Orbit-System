import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import securityDashboardOverrides from '../../../handlers/securityDashboardOverrides.js';
import { securityDashboardButtonHandlers } from '../../../handlers/securityDashboardCore.js';
import securityDashboardRuleHandlers from '../../../handlers/securityDashboardRuleHandlers.js';
import securityAutoModDashboard from '../../../handlers/securityAutoModDashboard.js';
import securityDashboardFixes from '../../../handlers/securityDashboardFixes.js';
import securityFinalOverrides from './securityFinalOverrides.js';
import securityStrikeCompatibility from './securityStrikeCompatibility.js';

const showSecurityLogChannelModal = async interaction => {
  const userId = interaction.customId.split(':').at(-1);
  if (userId !== interaction.user.id) {
    return interaction.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });
  }

  return interaction.showModal(
    new ModalBuilder()
      .setCustomId(`logs_channel_modal2:${interaction.user.id}`)
      .setTitle('Security Log Channel')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('value')
            .setLabel('Channel ID')
            .setPlaceholder('123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
      ),
  );
};

// Keep the Security handlers in one deterministic registration point.
// The final override/compatibility handlers intentionally come last so legacy
// dashboard buttons cannot replace the current handlers.
export default [
  ...securityDashboardButtonHandlers,
  ...securityDashboardRuleHandlers,
  ...securityAutoModDashboard,
  ...securityDashboardFixes,
  // Direct fallback for the log-channel button.
  { name: 'logs_channel2', execute: showSecurityLogChannelModal },
  ...securityFinalOverrides,
  ...securityStrikeCompatibility,
  ...securityDashboardOverrides,
];