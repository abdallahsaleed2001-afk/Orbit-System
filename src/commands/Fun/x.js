import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createXO, XO_JOIN_MS, startXO, endXO } from '../../services/games/xoService.js';
import { xoGrid, startXOTurnTimer } from '../../interactions/buttons/xo/xo.js';

const GAMES_ROLE_ID = '1543013490313400340';
const getGuildId = interaction => interaction.guildId || interaction.guild?.id;
const getChannelId = interaction => interaction.channelId || interaction.channel?.id;
const hasGamesRole = interaction => interaction.member?.roles?.cache?.has(GAMES_ROLE_ID) || interaction.member?.roles?.includes?.(GAMES_ROLE_ID);

const lobbyRows = game => [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`xo_join:${game.guildId}:${game.channelId}`).setLabel('انضم').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`xo_leave:${game.guildId}:${game.channelId}`).setLabel('خروج').setStyle(ButtonStyle.Secondary),
)];

async function runXO(interaction) {
    if (!hasGamesRole(interaction)) return interaction.reply({ content: 'ليس لديك صلاحية استخدام ألعاب البوت.', ephemeral: true });
    const guildId = getGuildId(interaction);
    const channelId = getChannelId(interaction);
    if (!guildId || !channelId) return interaction.reply({ content: 'لا يمكن تشغيل اللعبة هنا.' });

    const result = createXO(guildId, channelId, interaction.user);
    if (result.error === 'active') return interaction.reply({ content: 'توجد لعبة إكس أو نشطة بالفعل في هذه القناة.' });
    const game = result.game;

    const message = await interaction.reply({
        content: `**INFINITY GAMES — إكس أو**\n\nالتسجيل مفتوح لمدة **20 ثانية**.\nوقت الدخول: <t:${game.joinEndsAt}:R>\n\nاللاعبون (**1/2**):\n❌ <@${interaction.user.id}>\n⭕ بانتظار لاعب`,
        components: lobbyRows(game),
        fetchReply: true,
    });
    game.messageId = message.id;

    game.joinTimer = setTimeout(async () => {
        if (!game.active || game.phase !== 'join') return;
        if (game.players.length !== 2) {
            await message.edit({ content: '**INFINITY GAMES — إكس أو**\n\nانتهى وقت التسجيل — يجب أن يشارك لاعبان.', components: [] }).catch(() => {});
            endXO(game);
            return;
        }

        const started = startXO(game);
        if (!started.ok) return;
        await message.edit({
            content: `**INFINITY GAMES — إكس أو**\n\nبدأت اللعبة.\n\n❌ <@${game.players[0].id}>\n⭕ <@${game.players[1].id}>\n\nدور: ❌ <@${started.player.id}>\nلديك **10 ثوانٍ**.`,
            components: xoGrid(game),
        }).catch(() => {});
        game.currentMessageId = message.id;
        startXOTurnTimer(interaction.channel, game);
    }, XO_JOIN_MS);
}

export default {
    data: { name: 'اكس', options: [] },
    name: 'اكس',
    category: 'Fun',
    prefixOnly: true,
    async execute(interaction) { return runXO(interaction); },
    async prefixExecute(interaction) { return runXO(interaction); },
};
