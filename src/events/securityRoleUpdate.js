import { Events } from 'discord.js';
import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: Events.RoleUpdate,
  async execute(oldRole, newRole) {
    if (!newRole?.guild) return;

    const dangerousBefore = oldRole.permissions.has([
      'Administrator',
      'ManageGuild',
      'ManageChannels',
      'ManageRoles',
      'BanMembers',
      'KickMembers',
      'ManageWebhooks',
    ]);
    const dangerousAfter = newRole.permissions.has([
      'Administrator',
      'ManageGuild',
      'ManageChannels',
      'ManageRoles',
      'BanMembers',
      'KickMembers',
      'ManageWebhooks',
    ]);

    if (dangerousAfter && !dangerousBefore) {
      await handleAntiNuke(newRole.guild, 'roleUpdate', newRole.id);
    }
  },
};
