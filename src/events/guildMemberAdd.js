import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getColor, botConfig } from '../config/bot.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import { getWelcomeConfig, setBirthday as dbSetBirthday } from '../utils/database.js';
import { formatWelcomeMessage } from '../utils/welcome.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { logger } from '../utils/logger.js';

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    try {
      const { guild, user } = member;
      await getGuildConfig(member.client, guild.id);
      const welcomeConfig = await getWelcomeConfig(member.client, guild.id);
      const welcomeChannelId = welcomeConfig?.channelId;

      if (welcomeConfig?.enabled && welcomeChannelId) {
        const channel = guild.channels.cache.get(welcomeChannelId);
        const me = guild.members.me;
        const permissions = channel?.isTextBased?.() && me ? channel.permissionsFor(me) : null;
        if (permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
          const formatData = { user, guild, member };
          const welcomeMessage = formatWelcomeMessage(welcomeConfig.welcomeMessage || welcomeConfig.welcomeEmbed?.description || botConfig.welcome?.defaultWelcomeMessage || 'Welcome {user} to {server}!', formatData);
          const messageContent = welcomeConfig.welcomePing ? user.toString() : null;
          const embedTitle = formatWelcomeMessage(welcomeConfig.welcomeEmbed?.title || '🎉 Welcome!', formatData);
          const embedFooter = welcomeConfig.welcomeEmbed?.footer ? formatWelcomeMessage(welcomeConfig.welcomeEmbed.footer, formatData) : `Welcome to ${guild.name}!`;
          const canEmbed = permissions.has(PermissionFlagsBits.EmbedLinks);
          if (!canEmbed) await channel.send({ content: messageContent || welcomeMessage });
          else {
            const embed = new EmbedBuilder().setColor(welcomeConfig.welcomeEmbed?.color || getColor('success')).setTitle(embedTitle).setDescription(welcomeMessage).setThumbnail(user.displayAvatarURL()).addFields(
              { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
              { name: 'Member Count', value: guild.memberCount.toString(), inline: true }
            ).setTimestamp().setFooter({ text: embedFooter });
            if (welcomeConfig.welcomeImage) embed.setImage(welcomeConfig.welcomeImage);
            else if (welcomeConfig.welcomeEmbed?.image?.url) embed.setImage(welcomeConfig.welcomeEmbed.image.url);
            await channel.send({ content: messageContent, embeds: [embed] });
          }
        }
      }

      if (welcomeConfig?.roleIds?.length) {
        const delay = welcomeConfig.autoRoleDelay || 0;
        const roleId = welcomeConfig.roleIds[0];
        const assign = async () => {
          const role = guild.roles.cache.get(roleId);
          if (role) await assignRoleSafely(member, role);
        };
        if (delay > 0) {
          const timeout = setTimeout(assign, delay * 1000);
          if (typeof timeout.unref === 'function') timeout.unref();
        } else await assign();
      }

      try {
        await logEvent({ client: member.client, guildId: guild.id, eventType: EVENT_TYPES.MEMBER_JOIN, data: {
          title: 'User joined',
          lines: [`**User:** ${user.toString()} (${user.displayName !== user.username ? `@${user.displayName}` : user.tag})`, `**ID:** \`${user.id}\``, `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`, `**Members:** ${guild.memberCount}`],
          quoted: false, thumbnail: user.displayAvatarURL({ dynamic: true }), userId: user.id,
        }});
      } catch (error) { logger.debug('Error logging member join:', error); }

      try {
        const backupKey = `guild:${guild.id}:birthdays:left`;
        const backup = (await member.client.db.get(backupKey)) || {};
        if (backup[user.id]) {
          const { month, day } = backup[user.id];
          await dbSetBirthday(member.client, guild.id, user.id, month, day);
          delete backup[user.id];
          await member.client.db.set(backupKey, backup);
        }
      } catch (error) { logger.debug('Error restoring birthday on member join:', error); }
    } catch (error) { logger.error('Error in guildMemberAdd event:', error); }
  }
};

async function assignRoleSafely(member, role) {
  try { await member.roles.add(role); }
  catch (error) { logger.warn(`Failed to assign role ${role.id} to member ${member.id}:`, error); }
}
