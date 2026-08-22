import { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } from 'discord.js';
import { getSuggestions, saveSuggestions, nextSuggestionId, suggestionEmbed, suggestionButtons } from '../../utils/suggestions.js';

const submitModal = new ModalBuilder().setCustomId('suggestions_submit_modal').setTitle('Submit Suggestion').addComponents(
  new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('suggestion').setLabel('Your suggestion').setPlaceholder('Describe your idea...').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1500),
  ),
);

async function getSuggestion(interaction, id) {
  const data = await getSuggestions(interaction.client, interaction.guildId);
  const suggestion = data.items?.find(item => String(item.id) === String(id));
  return { data, suggestion };
}

async function refresh(interaction, suggestion) {
  const message = await interaction.channel.messages.fetch(suggestion.messageId).catch(() => null);
  if (message) await message.edit({ embeds: [suggestionEmbed(suggestion)], components: suggestionButtons(suggestion) });
}

export default [
  { name: 'suggestions_submit', async execute(interaction) { await interaction.showModal(submitModal); } },
  { name: 'suggestions_up', async execute(interaction, client, args) {
    const { data, suggestion } = await getSuggestion(interaction, args[0]);
    if (!suggestion) return interaction.reply({ content: '❌ Suggestion not found.', ephemeral: true });
    if (suggestion.authorId === interaction.user.id) return interaction.reply({ content: '❌ You cannot vote on your own suggestion.', ephemeral: true });
    suggestion.downvotes = suggestion.downvotes.filter(id => id !== interaction.user.id);
    if (suggestion.upvotes.includes(interaction.user.id)) suggestion.upvotes = suggestion.upvotes.filter(id => id !== interaction.user.id);
    else suggestion.upvotes.push(interaction.user.id);
    await saveSuggestions(client, interaction.guildId, data); await refresh(interaction, suggestion);
    return interaction.deferUpdate();
  } },
  { name: 'suggestions_down', async execute(interaction, client, args) {
    const { data, suggestion } = await getSuggestion(interaction, args[0]);
    if (!suggestion) return interaction.reply({ content: '❌ Suggestion not found.', ephemeral: true });
    if (suggestion.authorId === interaction.user.id) return interaction.reply({ content: '❌ You cannot vote on your own suggestion.', ephemeral: true });
    suggestion.upvotes = suggestion.upvotes.filter(id => id !== interaction.user.id);
    if (suggestion.downvotes.includes(interaction.user.id)) suggestion.downvotes = suggestion.downvotes.filter(id => id !== interaction.user.id);
    else suggestion.downvotes.push(interaction.user.id);
    await saveSuggestions(client, interaction.guildId, data); await refresh(interaction, suggestion);
    return interaction.deferUpdate();
  } },
  ...['accept', 'reject'].map(action => ({ name: `suggestions_${action}`, async execute(interaction, client, args) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ You need Manage Server permission.', ephemeral: true });
    const { data, suggestion } = await getSuggestion(interaction, args[0]);
    if (!suggestion) return interaction.reply({ content: '❌ Suggestion not found.', ephemeral: true });
    suggestion.status = action === 'accept' ? 'accepted' : 'rejected';
    suggestion.moderatorId = interaction.user.id;
    await saveSuggestions(client, interaction.guildId, data); await refresh(interaction, suggestion);
    return interaction.deferUpdate();
  } })),
];
