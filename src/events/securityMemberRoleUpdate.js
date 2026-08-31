import { Events } from 'discord.js';
import { handleMassRoleAssign } from '../services/security/massRoleAssign.js';

export default {
  name: Events.GuildMemberUpdate,
  once: false,
  async execute(oldMember, newMember) {
    try {
      await handleMassRoleAssign(oldMember, newMember);
    } catch (error) {
      // Logged inside handleMassRoleAssign
    }
  },
};
