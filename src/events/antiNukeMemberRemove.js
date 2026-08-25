import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: 'guildMemberRemove',
  async execute(member) {
    if (!member?.guild) return;
    await handleAntiNuke(member.guild, 'kick', member.id);
  },
};
