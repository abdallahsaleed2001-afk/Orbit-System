import { Events } from 'discord.js';
import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: Events.GuildRoleCreate,
  execute(role) {
    if (role?.guild) return handleAntiNuke(role.guild, 'roleCreate', role.id);
  },
};
