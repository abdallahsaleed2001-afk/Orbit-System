import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';

const GAMES_ROLE_ID = '1543013490313400340';

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
  roll: { label: 'رول', description: 'ارمِ النرد واحصل على نتيجة عشوائية.' },
  roulette: { label: 'روليت', description: 'شارك في جولة الروليت واختر مكانك.' },
  mines: { label: 'لغم', description: 'اختر الخانات وحاول تجنب اللغم.' },
  x: { label: 'إكس أو', description: 'تنافس في إكس أو وحاول تكوين ثلاثة متتالية.' },
  fight: { label: 'قتال', description: 'تحدى لاعبًا آخر في مواجهة قتالية.' },
};

function hasGamesRole(interaction) {
  return interaction.member?.roles?.cache?.has(GAMES_ROLE_ID)
    || interaction.member?.roles?.includes?.(GAMES_ROLE_ID);
}

function getGameChoices(client) {
  const games = [...(client.gameCommands?.values?.() || [])]
    .filter((command) => command?.data?.name)
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
