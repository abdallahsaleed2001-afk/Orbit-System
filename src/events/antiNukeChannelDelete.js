import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel?.guild) return;
    await handleAntiNuke(channel.guild, 'channelDelete', channel.id);
  },
};
