import { Events, PermissionFlagsBits } from 'discord.js';
import { getColorConfig, getColorByNumber, isColorSelection, parseColorNumber } from '../services/colorService.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message.guild || message.author.bot) return;
      const config = await getColorConfig(message.client, message.guild.id);
      if (!config?.enabled || !config.channelId || message.channel.id !== config.channelId) return;
      if (!isColorSelection(message.content)) return;

      const number = parseColorNumber(message.content);
      const color = await getColorByNumber(message.client, message.guild.id, number);
      if (!color) {
        await message.reply({ content: '❌ اختر رقمًا من **1 إلى 100**.' }).catch(() => {});
        return;
      }

      const roleId = config.roleIds?.[number - 1];
      const role = roleId
        ? (message.guild.roles.cache.get(roleId) || await message.guild.roles.fetch(roleId).catch(() => null))
        : null;
      if (!role) {
        await message.reply({ content: '❌ هذا اللون غير متاح حاليًا.' }).catch(() => {});
        return;
      }

      const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member) return;
      if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        await message.reply({ content: '❌ البوت يحتاج صلاحية **Manage Roles**.' }).catch(() => {});
        return;
      }
      if (role.position >= message.guild.members.me.roles.highest.position) {
        await message.reply({ content: '❌ رتبة اللون أعلى من أعلى رتبة للبوت.' }).catch(() => {});
        return;
      }

      const colorRoleIds = new Set(config.roleIds || []);
      const oldRoles = member.roles.cache.filter((r) => colorRoleIds.has(r.id));
      if (oldRoles.size) await member.roles.remove([...oldRoles.values()]).catch(() => {});
      await member.roles.add(role);

      const confirmation = await message.reply({ content: `🎨 تم اختيار اللون **${number}** — **${color.hex}**.` }).catch(() => null);
      setTimeout(() => {
        message.delete().catch(() => {});
        confirmation?.delete().catch(() => {});
      }, 5000);
    } catch (error) {
      console.error('Color selection handler error:', error);
    }
  },
};
