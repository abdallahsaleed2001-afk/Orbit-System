import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getActiveGame } from '../../services/games/gameService.js';
import { getMines } from '../../services/games/minesService.js';
import { getXO } from '../../services/games/xoService.js';
import { getRoulette } from '../../services/games/rouletteService.js';

const GAMES_ROLE_ID = '1543013490313400340';
const HIDDEN_GAMES = new Set(['roll', 'fight', 'flip']);
const trackedChannels = new Map();
const disabledAutoMenuChannels = new Set();
let autoMenuIntervalStarted = false;

const GAME_INFO = {
  fakk: { label: 'فكك', description: 'فكك الكلمة المطلوبة بأسرع ما يمكنك.' },
  ashbak: { label: 'اشبك', description: 'اشبك الحروف واكتب الكلمة الصحيحة أولًا.' },
  asra: { label: 'أسرع', description: 'اكتب الكلمة المطلوبة بأسرع وقت للفوز.' },
  ism: { label: 'اسم', description: 'اكتب اسمًا أو جمادًا يبدأ بالحرف المطلوب.' },
  hisab: { label: 'حساب', description: 'حل المسألة الحسابية وأرسل الإجابة الصحيحة.' },
  ratib: { label: 'رتب', description: 'رتب الحروف لتكوين الكلمة الصحيحة.' },
  thakira: { label: 'ذاكرة', description: 'احفظ الرقم ثم اكتبه بعد انتهاء وقت الحفظ.' },
  mokhtalef: { label: 'مختلف', description: 'اكتشف العنصر المختلف واربح الجولة.' },
  aks: { label: 'عكس', description: 'اكتب الكلمة بالعكس كما هو مطلوب.' },
  harf: { label: 'حرف', description: 'اكتب كلمة تبدأ بالحرف المحدد أولًا.' },
  roulette: { label: 'روليت', description: 'شارك في جولة الروليت واختر مكانك.' },
  mines: { label: 'لغم', description: 'اختر الخانات وحاول تجنب اللغم.' },
  x: { label: 'إكس أو', description: 'تنافس في إكس أو وحاول تكوين ثلاثة متتالية.' },
};

function hasGamesRole(interaction) {
  return interaction.member?.roles?.cache?.has(GAMES_ROLE_ID)
    || interaction.member?.roles?.includes?.(GAMES_ROLE_ID);
}

function getGameChoices(client) {
  const games = [...(client.gameCommands?.values?.() || [])]
    .filter((command) => command?.data?.name && !HIDDEN_GAMES.has(command.data.name))
    .sort((a, b) => {
      const aLabel = GAME_INFO[a.data.name]?.label || a.data.name;
      const bLabel = GAME_INFO[b.data.name]?.label || b.data.name;
      return aLabel.localeCompare(bLabel, 'ar');
    });

  return games.slice(0, 25).map((command) => {
    const name = String(command.data.name);
    const info = GAME_INFO[name];
    return {
      label: String(info?.label || command.gameMenu?.label || name).slice(0, 100),
      value: name.slice(0, 100),
      description: String(info?.description || command.gameMenu?.description || 'اختر اللعبة وابدأ اللعب.').slice(0, 100),
      ...(info?.emoji || command.gameMenu?.emoji ? { emoji: info?.emoji || command.gameMenu.emoji } : {}),
    };
  });
}

function hasActiveGame(guildId, channelId) {
  return Boolean(
    getActiveGame(guildId, channelId)
    || getMines(guildId, channelId)
    || getXO(guildId, channelId)
    || getRoulette(guildId, channelId)
  );
}

function trackChannel(interaction) {
  const guildId = interaction.guildId;
  const channelId = interaction.channelId || interaction.channel?.id;
  if (!guildId || !channelId) return;
  const key = `${guildId}:${channelId}`;
  trackedChannels.set(key, { guildId, channelId, wasActive: hasActiveGame(guildId, channelId) });
}

async function sendGamesMenu(client, guildId, channelId) {
  const channel = client.channels.cache.get(channelId);
  if (!channel?.isTextBased?.()) return;

  const choices = getGameChoices(client);
  if (!choices.length) return;

  const menu = new StringSelectMenuBuilder()
    .setCustomId('games_menu')
    .setPlaceholder('اختر لعبة')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(choices);

  const embed = createEmbed({
    title: '🎮 INFINITY GAMES',
    description: 'اختر اللعبة التي تريد لعبها من القائمة بالأسفل.',
    color: 'primary',
  });

  await channel.send({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
  }).catch(() => {});
}

function startAutoMenu(client) {
  if (autoMenuIntervalStarted) return;
  autoMenuIntervalStarted = true;

  setInterval(async () => {
    for (const [key, state] of trackedChannels) {
      const active = hasActiveGame(state.guildId, state.channelId);

      if (state.wasActive && !active) {
        state.wasActive = false;
        if (!disabledAutoMenuChannels.has(key)) {
          await sendGamesMenu(client, state.guildId, state.channelId);
        }
        continue;
      }

      state.wasActive = active;
    }
  }, 500);
}

export function disableAutoGameMenu(guildId, channelId) {
  if (!guildId || !channelId) return;
  disabledAutoMenuChannels.add(`${guildId}:${channelId}`);
}

export function enableAutoGameMenu(guildId, channelId) {
  if (!guildId || !channelId) return;
  disabledAutoMenuChannels.delete(`${guildId}:${channelId}`);
}

async function showGames(interaction) {
  if (!hasGamesRole(interaction)) {
    return interaction.reply({ content: 'ليس لديك صلاحية استخدام ألعاب البوت.', ephemeral: true });
  }

  const choices = getGameChoices(interaction.client);
  if (!choices.length) {
    return interaction.reply({ content: 'لا توجد ألعاب متاحة حاليًا.', ephemeral: true });
  }

  enableAutoGameMenu(interaction.guildId, interaction.channelId || interaction.channel?.id);
  trackChannel(interaction);
  startAutoMenu(interaction.client);

  const menu = new StringSelectMenuBuilder()
    .setCustomId('games_menu')
    .setPlaceholder('اختر لعبة')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(choices);

  const embed = createEmbed({
    title: '🎮 INFINITY GAMES',
    description: 'اختر اللعبة التي تريد لعبها من القائمة بالأسفل.',
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
