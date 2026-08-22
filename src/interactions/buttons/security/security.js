import securityDashboardOverrides from '../../../handlers/securityDashboardOverrides.js';
import { securityDashboardButtonHandlers } from '../../../handlers/securityDashboardCore.js';
import securityDashboardRuleHandlers from '../../../handlers/securityDashboardRuleHandlers.js';
import securityAutoModDashboard from '../../../handlers/securityAutoModDashboard.js';

// Compatibility handlers must be registered first so legacy message buttons
// resolve to the intended dashboard/AutoMod behavior before duplicate IDs from
// the newer dashboard handlers are encountered.
export default [
  ...securityDashboardOverrides,
  ...securityDashboardButtonHandlers,
  ...securityDashboardRuleHandlers,
  ...securityAutoModDashboard,
];
