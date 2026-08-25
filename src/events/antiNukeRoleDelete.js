import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: 'roleDelete',
  async execute(role) {
    if (!role?.guild) return;
    await handleAntiNuke(role.guild, 'roleDelete', role.id);
  },
};
