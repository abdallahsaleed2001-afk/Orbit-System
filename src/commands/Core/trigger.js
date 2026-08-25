import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { TRIGGER_ACTIONS, addCustomTrigger, getCustomTriggers, removeCustomTrigger } from '../../services/customTriggerService.js';

const ACTION_LABELS = {
  [TRIGGER_ACTIONS.LOCK]: 'Lock current channel',
  [TRIGGER_ACTIONS.UNLOCK]: 'Unlock current channel',
  [TRIGGER_ACTIONS.HIDE]: 'Hide current channel',
  [TRIGGER_ACTIONS.UNHIDE]: 'Unhide current channel',
  [TRIGGER_ACTIONS.ADD_ROLE]: 'Give a role',
  [TRIGGER_ACTIONS.REMOVE_ROLE]: 'Remove a role',
  [TRIGGER_ACTIONS.ADD_MEMBER]: 'Add member to current channel',
  [TRIGGER_ACTIONS.BAN]: 'Ban the target user',
  [TRIGGER_ACTIONS.KICK]: 'Kick the target user',
  [TRIGGER_ACTIONS.WARN]: 'Warn the target user',
  [TRIGGER_ACTIONS.MUTE]: 'Give the mute role to the target user',
  [TRIGGER_ACTIONS.TIMEOUT]: 'Timeout the target user for 10 minutes',
};

export default {
  data: new SlashCommandBuilder()
    .setName('trigger').setDescription('Create and manage word-based actions.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) => subcommand.setName('add').setDescription('Create or update a word trigger.')
      .addStringOption((option) => option.setName('word').setDescription('The exact word or phrase to listen for.').setRequired(true).setMaxLength(100))
      .addStringOption((option) => option.setName('action').setDescription('What Orbit should do.').setRequired(true).addChoices(
        ...Object.values(TRIGGER_ACTIONS).map((action) => ({ name: ACTION_LABELS[action], value: action }))
      ))
      .addRoleOption((option) => option.setName('role').setDescription('Role to give/remove. Required for role actions.').setRequired(false)))
    .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Remove a word trigger.').addStringOption((option) => option.setName('word').setDescription('The trigger to remove.').setRequired(true).setMaxLength(100)))
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Show all configured word triggers.')),
  category: 'core',
  async execute(interaction, config, client) {
    const subcommand = interaction.options.getSubcommand();
    try {
      if (subcommand === 'add') {
        const word = interaction.options.getString('word', true).trim();
        const action = interaction.options.getString('action', true);
        const role = interaction.options.getRole('role');
        if ((action === TRIGGER_ACTIONS.ADD_ROLE || action === TRIGGER_ACTIONS.REMOVE_ROLE) && !role) return interaction.reply({ content: 'You must select a role for this action.', ephemeral: true });
        if (role && role.managed) return interaction.reply({ content: 'That role is managed by an integration and cannot be assigned by the bot.', ephemeral: true });
        const botMember = interaction.guild.members.me;
        if (role && botMember && role.position >= botMember.roles.highest.position) return interaction.reply({ content: 'I cannot manage that role because it is above my highest role.', ephemeral: true });
        const entry = await addCustomTrigger(client, interaction.guild.id, word, action, role?.id || null);
        return interaction.reply({ content: `Trigger saved: **${entry.trigger}** → **${ACTION_LABELS[entry.action]}**${entry.roleId ? ` → <@&${entry.roleId}>` : ''}`, ephemeral: true });
      }
      if (subcommand === 'remove') {
        const word = interaction.options.getString('word', true);
        const removed = await removeCustomTrigger(client, interaction.guild.id, word);
        return interaction.reply({ content: removed ? `Removed trigger **${word.trim()}**.` : `No trigger was found for **${word.trim()}**.`, ephemeral: true });
      }
      const triggers = await getCustomTriggers(client, interaction.guild.id);
      if (!triggers.length) return interaction.reply({ content: 'No custom triggers are configured.', ephemeral: true });
      const lines = triggers.map((item) => `• **${item.trigger}** → ${ACTION_LABELS[item.action] || item.action}${item.roleId ? ` → <@&${item.roleId}>` : ''}`);
      return interaction.reply({ content: `**Custom Triggers (${triggers.length})**\n${lines.join('\n')}`.slice(0, 2000), ephemeral: true });
    } catch (error) {
      return interaction.reply({ content: `Could not update triggers: ${error.message}`, ephemeral: true }).catch(() => {});
    }
  },
};
