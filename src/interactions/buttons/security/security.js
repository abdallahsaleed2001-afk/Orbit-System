import { securityButtonHandlers } from '../../../handlers/securityHandlers.js';
import { securityAdvancedButtonHandlers } from '../../../handlers/securityAdvancedHandlers.js';
import { securityDashboardButtonHandlers } from '../../../handlers/securityDashboardHandlers.js';
import securityPanelOverrides from '../../../handlers/securityPanelOverrides.js';

export default [
  ...securityButtonHandlers,
  ...securityAdvancedButtonHandlers,
  ...securityDashboardButtonHandlers,
  ...securityPanelOverrides,
];
