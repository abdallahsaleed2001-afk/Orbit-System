import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createMines, MINES_JOIN_MS, startMines, endMines } from '../../services/games/minesService.js';
import { grid, startMinesTurnTimer } from '../../interactions/buttons/mines/mines.js';

const GAMES_ROLE_ID = '1543774154279354398';
const getGuildId = interaction => interaction.guildId || interaction.guild?.id;
const getChannelId = interaction => interaction.channelId || interaction.channel?.id;
const hasGamesRole = interaction => interaction.member?.roles?.cache?.has(GAMES_ROLE_ID) || interaction.member?.roles?.includes?.(GAMES_ROLE_ID);

const lobbyRows = game => [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`mines_join:${game.guildId}:${game.channelId}`).setLabel('انضم').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId(`mines_leave:${game.guildId}:${game.channelId}`).setLabel('خروج').setStyle(ButtonStyle.Secondary),
)];

async function runMines(interaction) {
  if (!hasGamesRole(interaction)) return interaction.reply({ content: 'ليس لديك صلاحية استخدام ألعاب البوت.', ephemeral: true });
  const guildId = getGuildId(interaction);
  const channelId = getChannelId(interaction);
  if (!guildId || !channelId) return interaction.reply({ content: 'لا يمكن تشغيل اللعبة هنا.' });

  const result = createMines(guildId, channelId, interaction.user);
  if (result.error === 'active') return interaction.reply({ content: 'توجد لعبة لغم نشطة بالفعل في هذه القناة.' });
  const game = result.game;
  const message = await interaction.reply({
    content: `**INFINITY GAMES — لغم**\n\nالتسجيل مفتوح لمدة **20 ثانية**.\nوقت الدخول: <t:${game.joinEndsAt}:R>\n\nاللاعبون (**1**):\n<@${interaction.user.id}>`,
    components: lobbyRows(game),
    fetchReply: true,
  });
  game.messageId = message.id;
  game.joinTimer = setTimeout(async () => {
    if (!game.active || game.phase !== 'join') return;
    if (game.players.length < 2) {
      await message.edit({ content: '**INFINITY GAMES — لغم**\n\nانتهى وقت التسجيل — يجب أن يشارك شخصان على الأقل.', components: [] }).catch(() => {});
      endMines(game);
      return;
    }
    const started = startMines(game);
    if (!started.ok) return;
    await message.edit({ content: `**INFINITY GAMES — لغم**\n\nانتهى وقت الدخول. بدأت الجولة **#${game.round}**.\n\nدور: <@${started.player.id}>\nلغم واحد مخفي في هذه الجولة. لديك **10 ثوانٍ**.`, components: grid(game) }).catch(() => {});
    game.currentMessageId = message.id;
    startMinesTurnTimer(interaction.channel, game);
  }, MINES_JOIN_MS);
}

export default {
  data: { name: 'لغم', options: [] },
  name: 'لغم',
  category: 'Fun',
  prefixOnly: true,
  async execute(interaction) { return runMines(interaction); },
  async prefixExecute(interaction) { return runMines(interaction); },
};
