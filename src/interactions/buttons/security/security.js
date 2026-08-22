import securityDashboardOverrides from '../../../handlers/securityDashboardOverrides.js';
import { securityDashboardButtonHandlers } from '../../../handlers/securityDashboardCore.js';
import securityDashboardRuleHandlers from '../../../handlers/securityDashboardRuleHandlers.js';
import securityAutoModDashboard from '../../../handlers/securityAutoModDashboard.js';

export default [
  ...securityDashboardOverrides,
  ...securityDashboardButtonHandlers,
  ...securityDashboardRuleHandlers,
  ...securityAutoModDashboard,
];
