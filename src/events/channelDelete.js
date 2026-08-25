import {
    getJoinToCreateConfig,
    removeJoinToCreateTrigger,
    unregisterTemporaryChannel,
} from '../utils/database.js';
import { logger } from '../utils/logger.js';

export default {
    name: 'channelDelete',
    async execute(channel) {
        if (channel.type !== 0 && channel.type !== 2 && channel.type !== 4) return;
        if (!channel.guild) return;

        const guildId = channel.guild.id;

        try {
            const config = await getJoinToCreateConfig(channel.client, guildId);
            if (!config?.enabled) return;

            if (config.triggerChannels?.includes(channel.id)) {
                await removeJoinToCreateTrigger(channel.client, guildId, channel.id);
                logger.info(`Removed deleted Join to Create trigger ${channel.id} from guild ${guildId}`);
            }

            if (config.temporaryChannels?.[channel.id]) {
                await unregisterTemporaryChannel(channel.client, guildId, channel.id);
                logger.info(`Cleaned deleted Join to Create temporary channel ${channel.id} from guild ${guildId}`);
            }

            if (config.categoryId === channel.id) {
                config.categoryId = null;
                config.enabled = false;
                await channel.client.db.set(`guild:${guildId}:jointocreate`, config);
                logger.warn(`Disabled Join to Create in guild ${guildId} because its category was deleted`);
            }
        } catch (error) {
            logger.error(`Error in channelDelete event for guild ${guildId}:`, error);
        }
    }
};
