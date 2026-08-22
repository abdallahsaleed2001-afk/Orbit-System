import { securityButtonHandlers } from '../../../handlers/securityHandlers.js';
import { securityAdvancedButtonHandlers } from '../../../handlers/securityAdvancedHandlers.js';
import { securityDashboardButtonHandlers } from '../../../handlers/securityDashboardHandlers.js';

// Order matters: the hierarchical dashboard handlers are last so their
// dedicated IDs take precedence over the older flat panel controls.
export default [
  ...securityButtonHandlers,
  ...securityAdvancedButtonHandlers,
  ...securityDashboardButtonHandlers,
];
