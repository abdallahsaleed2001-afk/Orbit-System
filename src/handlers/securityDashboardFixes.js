import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getSecurityConfig, updateSecurityConfig } from '../services/security/securityService.js';

// Security dashboard compatibility/fixes.
// This handler comes after the dashboard handlers so the blocked-words flow wins.

const allowed = i => i.customId.split(':').at(-1) === i.user.id;
const deny = i => i.reply({ content: 'This security dashboard belongs to another moderator.', ephemeral: true });

async function openBlockedWords(i, client) {
  if (!allowed(i)) return deny(i);

  const config = await getSecurityConfig(client, i.guildId);
  const words = Array.isArray(config.autoMod?.badWords?.words)
    ? config.autoMod.badWords.words.map(String)
    : [];

  const modal = new ModalBuilder()
    .setCustomId(`automod_words_modal:${i.user.id}`)
    .setTitle('Manage Blocked Words')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('words')
          .setLabel('Blocked words')
          .setPlaceholder('Enter words separated by commas or new lines')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setValue(words.join(', ').slice(0, 4000))
      )
    );

  return i.showModal(modal);
}

async function saveBlockedWords(i, client) {
  if (!allowed(i)) return deny(i);

  const raw = i.fields.getTextInputValue('words') || '';
  const words = [...new Set(
    raw
      .split(/[\n,]+/)
      .map(word => word.trim())
      .filter(Boolean)
      .slice(0, 500)
  )];

  await updateSecurityConfig(client, i.guildId, {
    autoMod: {
      badWords: { words },
    },
  });

  return i.reply({
    content: words.length
      ? `✅ Saved **${words.length}** blocked word${words.length === 1 ? '' : 's'}.`
      : '✅ Blocked words cleared.',
    ephemeral: true,
  });
}

export default [
  { name: 'automod_words', execute: openBlockedWords },
  { name: 'automod_words_modal', execute: saveBlockedWords },
];
