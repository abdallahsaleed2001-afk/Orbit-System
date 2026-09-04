import { Events, PermissionFlagsBits } from 'discord.js';
import { getCustomTriggers, handleCustomTrigger } from '../services/customTriggerService.js';

async function handleExtraTrigger(message, client) {
  if (!message.guild || message.author.bot) return false;
  const content = String(message.content || '').trim();
  if (!content) return false;
  const triggers = await getCustomTriggers(client, message.guild.id);
  const trigger = triggers.find(item => ['change_nickname', 'change_channel_name'].includes(item.action) && (content === String(item.trigger).trim() || content.startsWith(`${String(item.trigger).trim()} `)));
  if (!trigger) return false;

  if (trigger.action === 'change_channel_name') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return false;
    const triggerText = String(trigger.trigger).trim();
    const newName = content.slice(triggerText.length).trim();
    if (!newName || newName.length > 100) return false;
    await message.channel.setName(newName, `Custom trigger "${trigger.trigger}" used by ${message.author.tag}`);
    await message.react('✅').catch(() => null);
    return true;
  }

  if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) return false;
  const target = message.mentions.members.first() || await message.guild.members.fetch(message.content.match(/(?:^|\s)(\d{17,20})(?:\s|$)/)?.[1]).catch(() => null);
  if (!target || target.id === message.guild.ownerId || target.id === message.client.user.id) return false;
  const triggerText = String(trigger.trigger).trim();
  const remainder = content.slice(triggerText.length).trim();
  const targetMention = message.mentions.users.first()?.id;
  const nickname = targetMention ? remainder.replace(/^<@!?\d{17,20}>\s*/, '').trim() : remainder.replace(/^\d{17,20}\s*/, '').trim();
  if (!nickname || nickname.length > 32) return false;
  if (!target.manageable) return false;
  await target.setNickname(nickname, `Custom trigger "${trigger.trigger}" used by ${message.author.tag}`);
  await message.react('✅').catch(() => null);
  return true;
}

export default {
  name: Events.MessageCreate,
  async execute(message, client) {
    try {
      if (await handleExtraTrigger(message, client)) return;
      await handleCustomTrigger(message, client);
    } catch {
      // The trigger service handles and logs its own execution errors.
    }
  },
};