import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: 'roleCreate',
  async execute(role) {
    if (!role?.guild) return;
    await handleAntiNuke(role.guild, 'roleCreate', role.id);
  },
};
