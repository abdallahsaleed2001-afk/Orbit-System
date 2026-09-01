import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createChairs, CHAIRS_JOIN_MS, endChairs } from '../../services/games/chairsService.js';
import { startRound } from '../../interactions/buttons/chairs/chairs.js';

const GAMES_ROLE_ID = '1543774154279354398';
const getGuildId = i => i.guildId || i.guild?.id;
const getChannelId = i => i.channelId || i.channel?.id;
const hasGamesRole = i => i.member?.roles?.cache?.has(GAMES_ROLE_ID) || i.member?.roles?.includes?.(GAMES_ROLE_ID);

const lobbyRows = game => [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`chairs_join:${game.guildId}:${game.channelId}`).setLabel('\u{1fa91} انضم').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId(`chairs_leave:${game.guildId}:${game.channelId}`).setLabel('\u274c خروج').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId(`chairs_start:${game.guildId}:${game.channelId}`).setLabel('\u25b6\ufe0f ابدأ').setStyle(ButtonStyle.Primary).setDisabled(game.players.length < 2),
)];

const playersList = game => game.players.map(p => `<@${p.id}>`).join(' ');

async function runChairs(interaction) {
  if (!hasGamesRole(interaction)) return interaction.reply({ content: '\u{1f6ab} ليس لديك صلاحية استخدام ألعاب البوت.', ephemeral: true });
  const guildId = getGuildId(interaction);
  const channelId = getChannelId(interaction);
  if (!guildId || !channelId) return interaction.reply({ content: 'لا يمكن تشغيل اللعبة هنا.' });

  const result = createChairs(guildId, channelId, interaction.user);
  if (result.error === 'active') return interaction.reply({ content: '\u{1f6ab} توجد لعبة كراسي نشطة بالفعل في هذه القناة.', ephemeral: true });

  const game = result.game;
  const message = await interaction.reply({
    content: `**INFINITY GAMES \u{1fa91} كراسي**\n\nالتسجيل مفتوح لمدة **20 ثانية**.\nوقت الدخول: <t:${game.joinEndsAt}:R>\n\nاللاعبون (**1**):\n<@${interaction.user.id}>`,
    components: lobbyRows(game),
    fetchReply: true,
  });

  game.messageId = message.id;
  game.joinTimer = setTimeout(async () => {
    if (!game.active || game.phase !== 'join') return;
    if (game.players.length < 2) {
      await message.edit({ content: '**INFINITY GAMES \u{1fa91} كراسي**\n\n\u{1f4f1} انتهى وقت التسجيل — يجب أن يشارك شخصان على الأقل.', components: [] }).catch(() => {});
      endChairs(game);
      return;
    }
    await startRound(interaction.channel, game);
  }, CHAIRS_JOIN_MS);
}

export default {
  data: { name: 'كراسي', options: [] },
  name: 'كراسي',
  category: 'Fun',
  prefixOnly: true,
  async execute(interaction) { return runChairs(interaction); },
  async prefixExecute(interaction) { return runChairs(interaction); },
};
