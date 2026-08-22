import securityDashboardOverrides from '../../../handlers/securityDashboardOverrides.js';
import { securityDashboardButtonHandlers } from '../../../handlers/securityDashboardCore.js';
import securityDashboardRuleHandlers from '../../../handlers/securityDashboardRuleHandlers.js';
import securityAutoModDashboard from '../../../handlers/securityAutoModDashboard.js';

// Load the core/dashboard handlers first, then AutoMod, and finally the
// compatibility overrides so Back/Refresh always return to the exact
// original /security dashboard UI.
export default [
  ...securityDashboardButtonHandlers,
  ...securityDashboardRuleHandlers,
  ...securityAutoModDashboard,
  ...securityDashboardOverrides,
];
