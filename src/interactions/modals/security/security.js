import { securityModalHandlers } from '../../../handlers/securityHandlers.js';
import { securityAdvancedModalHandlers } from '../../../handlers/securityAdvancedHandlers.js';

export default [...securityModalHandlers, ...securityAdvancedModalHandlers];
