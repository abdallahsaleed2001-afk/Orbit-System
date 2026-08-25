import { logger } from '../utils/logger.js';
import { getReactionRoleKey } from '../utils/database/keys.js';
import { getAllReactionRoleMessages } from './reactionRoleService.js';
import { getReactionRolePanelStatus } from '../utils/panelStatus.js';

async function persistReactionRoleMessageId(client, guildId, panelData, messageId) {
  if (!messageId || panelData.messageId === messageId) return;
  const oldKey = getReactionRoleKey(guildId, panelData.messageId);
  panelData.messageId = messageId;
  const newKey = getReactionRoleKey(guildId, messageId);
  await client.db.set(newKey, panelData);
  await client.db.delete(oldKey).catch(() => {});
}

export async function reconcileReactionRolePanelHealth(client) {
  const summary = { scannedGuilds: 0, scannedPanels: 0, healthyPanels: 0, deletedPanels: 0, missingChannels: 0, recoveredIds: 0, errors: 0 };

  for (const guild of client.guilds.cache.values()) {
    summary.scannedGuilds += 1;
    try {
      const panels = await getAllReactionRoleMessages(client, guild.id);
      if (!panels?.length) continue;

      for (const panelData of panels) {
        if (!panelData?.channelId || !panelData?.messageId) continue;
        summary.scannedPanels += 1;
        const panelStatus = await getReactionRolePanelStatus(client, guild, panelData);

        if (panelStatus.recoveredId) {
          summary.recoveredIds += 1;
          await persistReactionRoleMessageId(client, guild.id, panelData, panelStatus.recoveredId);
        }
        if (panelStatus.exists) summary.healthyPanels += 1;
        else if (panelStatus.reason === 'channel_missing') {
          summary.missingChannels += 1;
          logger.warn(`Reaction role panel channel missing for guild ${guild.id}, message ${panelData.messageId}`);
        } else if (panelStatus.reason === 'panel_deleted') {
          summary.deletedPanels += 1;
          logger.warn(`Reaction role panel deleted for guild ${guild.id} — repost from /reactroles dashboard`);
        }
      }
    } catch (error) {
      summary.errors += 1;
      logger.warn(`Reaction role panel health check failed for guild ${guild.id}:`, error.message);
    }
  }
  return summary;
}
