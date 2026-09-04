import { Events } from 'discord.js';
import { handleCustomTrigger } from '../services/customTriggerService.js';

export default {
  name: Events.MessageCreate,
  async execute(message, client) {
    try {
      await handleCustomTrigger(message, client);
    } catch {
      // The trigger service handles and logs its own execution errors.
    }
  },
};
