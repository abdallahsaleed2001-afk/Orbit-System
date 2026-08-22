import { securityModalHandlers } from '../../../handlers/securityHandlers.js';
import { securityAdvancedModalHandlers } from '../../../handlers/securityAdvancedHandlers.js';
import { securityDashboardModalHandlers } from '../../../handlers/securityDashboardHandlers.js';

export default [
  ...securityModalHandlers,
  ...securityAdvancedModalHandlers,
  ...securityDashboardModalHandlers,
];
