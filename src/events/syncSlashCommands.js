import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';

// Reconcile only real slash commands. Prefix-only commands must never be sent to Discord's application-command API.
export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    setTimeout(async () => {
      try {
        const clientId = client.config?.bot?.clientId || process.env.CLIENT_ID;
        const guildId = client.config?.bot?.guildId || process.env.GUILD_ID;
        if (!clientId || !client.rest) return;

        const commands = [...client.commands.values()]
          .filter(command => command?.prefixOnly !== true)
          .filter(command => command?.data && typeof command.data.toJSON === 'function')
          .map(command => command.data.toJSON())
          .slice(0, 100);

        await client.rest.put(`/applications/${clientId}/commands`, { body: [] });
        if (guildId) {
          await client.rest.put(`/applications/${clientId}/guilds/${guildId}/commands`, { body: commands });
        }
        logger.info(`Slash command reconciliation complete: ${commands.length}/100 command(s) kept.`);
      } catch (error) {
        logger.error('Slash command reconciliation failed:', error);
      }
    }, 10000);
  },
};
