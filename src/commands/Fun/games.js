import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';

const GAMES_ROLE_ID = '1543013490313400340';

function hasGamesRole(interaction) {
  return interaction.member?.roles?.cache?.has(GAMES_ROLE_ID)
    || interaction.member?.roles?.includes?.(GAMES_ROLE_ID);
}

function getGameChoices(client) {
  const games = [...(client.gameCommands?.values?.() || [])]
    .filter((command) => command?.data?.name)
    .sort((a, b) => String(a.data.name).localeCompare(String(b.data.name), 'ar'));

  return games.slice(0, 25).map((command) => ({
    label: String(command.gameMenu?.label || command.data.name).slice(0, 100),
    value: String(command.data.name).slice(0, 100),
    description: String(command.gameMenu?.description || 'ابدأ اللعبة بنفس نظامها الحالي.').slice(0, 100),
    emoji: command.gameMenu?.emoji,
  }));
}

async function showGames(interaction) {
  if (!hasGamesRole(interaction)) {
    return interaction.reply({ content: 'ليس لديك صلاحية استخدام ألعاب البوت.', ephemeral: true });
  }

  const choices = getGameChoices(interaction.client);
  if (!choices.length) {
    return interaction.reply({ content: 'لا توجد ألعاب متاحة حاليًا.', ephemeral: true });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId('games_menu')
    .setPlaceholder('اختر لعبة')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(choices);

  const embed = createEmbed({
    title: '🎮 INFINITY GAMES',
    description: 'اختر اللعبة التي تريد لعبها من القائمة بالأسفل.\n\nالألعاب تعمل بنفس نظامها الحالي بدون تغيير.',
    color: 'primary',
  });

  return interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
  });
}

export default {
  data: { name: 'العاب', options: [] },
  name: 'العاب',
  category: 'Fun',
  prefixOnly: true,
  async execute(interaction) { return showGames(interaction); },
  async prefixExecute(interaction) { return showGames(interaction); },
};
