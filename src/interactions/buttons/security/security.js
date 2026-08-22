import { securityButtonHandlers } from '../../../handlers/securityHandlers.js';
import { securityAdvancedButtonHandlers } from '../../../handlers/securityAdvancedHandlers.js';

// Advanced handlers are last so they intentionally override the older flat
// AutoMod/Strike handlers while preserving every other Security control.
export default [...securityButtonHandlers, ...securityAdvancedButtonHandlers];
