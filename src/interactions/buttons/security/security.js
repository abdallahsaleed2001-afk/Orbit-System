import { securityDashboardButtonHandlers } from '../../../handlers/securityDashboardHandlers.js';
import securityPanelOverrides from '../../../handlers/securityPanelOverrides.js';
import securityDashboardRuleHandlers from '../../../handlers/securityDashboardRuleHandlers.js';
import securityAutoModDashboard from '../../../handlers/securityAutoModDashboard.js';

export default [
  ...securityDashboardButtonHandlers,
  ...securityDashboardRuleHandlers,
  ...securityPanelOverrides,
  ...securityAutoModDashboard,
];
