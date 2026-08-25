import { handleAntiNuke } from '../services/security/antiNuke.js';

export default {
  name: 'channelCreate',
  async execute(channel) {
    if (!channel?.guild) return;
    await handleAntiNuke(channel.guild, 'channelCreate', channel.id);
  },
};
