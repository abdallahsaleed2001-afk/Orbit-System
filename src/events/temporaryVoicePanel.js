import { getTemporaryChannelInfo } from '../utils/database.js';
import { updatePanel } from '../services/temporaryVoicePanelService.js';
import { logger } from '../utils/logger.js';

export default {
    name: 'voiceStateUpdate',
    once: false,
    async execute(oldState, newState, client) {
        try {
            const guild = newState.guild || oldState.guild;
            if (!guild || !client || newState.member?.user?.bot) return;

            // The main voiceStateUpdate handler creates/deletes the room. This listener
            // only attaches/synchronizes the public control panel after those changes.
            if (newState.channelId) {
                const info = await getTemporaryChannelInfo(client, guild.id, newState.channelId);
                if (info && newState.channel) {
                    // Give the main JTC handler a moment to finish registering the room
                    // before attempting to persist the panel message id.
                    setTimeout(() => {
                        updatePanel(client, newState.channel).catch((error) =>
                            logger.debug(`Temporary voice panel sync failed: ${error.message}`)
                        );
                    }, 250);
                }
            }

            if (oldState.channelId && oldState.channelId !== newState.channelId) {
                const oldInfo = await getTemporaryChannelInfo(client, guild.id, oldState.channelId);
                if (oldInfo && oldState.channel) {
                    setTimeout(() => {
                        updatePanel(client, oldState.channel).catch(() => null);
                    }, 500);
                }
            }
        } catch (error) {
            logger.debug(`Temporary voice panel event error: ${error.message}`);
        }
    }
};
