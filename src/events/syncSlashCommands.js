import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';

// Discord keeps registered slash commands independently from the command files.
// Reconcile them after startup so commands deleted from the code cannot remain visible.
export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    // Give the normal startup registration a moment to finish first.
    setTimeout(async () => {
      try {
        const clientId = client.config?.bot?.clientId || process.env.CLIENT_ID;
        const guildId = client.config?.bot?.guildId || process.env.GUILD_ID;

        if (!clientId || !client.rest) {
          logger.warn('Slash command reconciliation skipped: client ID or REST client is missing.');
          return;
        }

        const commands = [...client.commands.values()]
          .filter((command) => command?.data && typeof command.data.toJSON === 'function')
          .map((command) => command.data.toJSON());

        // Remove stale global commands left by older versions of Orbit/TitanBot.
        await client.rest.put(`/applications/${clientId}/commands`, { body: [] });

        // Guild commands are the source of truth for this bot.
        if (guildId) {
          await client.rest.put(`/applications/${clientId}/guilds/${guildId}/commands`, {
            body: commands,
          });
        }

        logger.info(`Slash command reconciliation complete: ${commands.length} command(s) kept.`);
      } catch (error) {
        logger.error('Slash command reconciliation failed:', error);
      }
    }, 10000);
  },
};
