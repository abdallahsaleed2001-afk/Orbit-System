import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: 'roleUpdate',
  async execute(role) {
    if (!role?.guild) return;
    await handleAntiNuke(role.guild, 'roleUpdate', role.id);
  },
};
