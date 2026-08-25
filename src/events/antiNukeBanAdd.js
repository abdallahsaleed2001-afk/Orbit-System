import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: 'guildBanAdd',
  async execute(ban) {
    if (!ban?.guild || !ban.user) return;
    await handleAntiNuke(ban.guild, 'ban', ban.user.id);
  },
};
