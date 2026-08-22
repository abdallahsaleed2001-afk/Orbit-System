import securityDashboardOverrides from '../../../handlers/securityDashboardOverrides.js';
import { securityDashboardButtonHandlers } from '../../../handlers/securityDashboardCore.js';
import securityDashboardRuleHandlers from '../../../handlers/securityDashboardRuleHandlers.js';
import securityAutoModDashboard from '../../../handlers/securityAutoModDashboard.js';
import securityDashboardFixes from '../../../handlers/securityDashboardFixes.js';

// Compatibility handlers first, then the core dashboard, then targeted fixes.
// The final array order intentionally lets the fixes replace broken/legacy IDs.
export default [
  ...securityDashboardOverrides,
  ...securityDashboardButtonHandlers,
  ...securityDashboardRuleHandlers,
  ...securityAutoModDashboard,
  ...securityDashboardFixes,
];
