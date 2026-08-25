import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    if (!member?.guild || !member.user?.bot) return;
    await handleAntiNuke(member.guild, 'botAdd', member.id);
  },
};
