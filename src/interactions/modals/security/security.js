import { securityModalHandlers } from '../../../handlers/securityHandlers.js';
import { securityAdvancedModalHandlers } from '../../../handlers/securityAdvancedHandlers.js';
import { securityDashboardModalHandlers } from '../../../handlers/securityDashboardHandlers.js';
import securityDashboardFixes from '../../../handlers/securityDashboardFixes.js';

const ok = i => i.customId.split(':').at(-1) === i.user.id;
const deny = i => i.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });

export default [
  ...securityModalHandlers,
  ...securityAdvancedModalHandlers,
  ...securityDashboardModalHandlers,
  ...securityDashboardFixes.filter(h => h.name.endsWith('_modal')),
];
