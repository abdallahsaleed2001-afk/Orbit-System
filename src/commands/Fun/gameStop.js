import { getActiveGame, cancelGame } from '../../services/games/gameService.js';
import { getMines, endMines } from '../../services/games/minesService.js';
import { getXO, endXO } from '../../services/games/xoService.js';
import { getRoulette, cancelRoulette } from '../../services/games/rouletteService.js';

const GAMES_ROLE_ID = '1543013490313400340';

function hasGamesRole(interaction) {
    return interaction.member?.roles?.cache?.has(GAMES_ROLE_ID)
        || interaction.member?.roles?.includes?.(GAMES_ROLE_ID);
}

async function runStop(interaction) {
    if (!hasGamesRole(interaction)) {
        return interaction.reply({ content: 'ليس لديك صلاحية استخدام ألعاب البوت.', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const channelId = interaction.channelId || interaction.channel?.id;
    if (!guildId || !channelId) return interaction.reply({ content: 'لا يمكن إيقاف الألعاب هنا.' });

    const mines = getMines(guildId, channelId);
    const xo = getXO(guildId, channelId);
    const roulette = getRoulette(guildId, channelId);
    const generic = getActiveGame(guildId, channelId);

    if (!mines && !xo && !roulette && !generic) {
        return interaction.reply({ content: 'لا توجد لعبة نشطة في هذه القناة.', ephemeral: true });
    }

    if (mines) endMines(mines);
    if (xo) endXO(xo);
    if (roulette) cancelRoulette(guildId, channelId);
    if (generic) cancelGame(guildId, channelId);

    return interaction.reply({ content: '⛔ تم إيقاف اللعبة النشطة في هذه القناة.' });
}

export default {
    data: { name: 'ايقاف', options: [] },
    name: 'ايقاف',
    category: 'Fun',
    prefixOnly: true,
    async execute(interaction) { return runStop(interaction); },
    async prefixExecute(interaction) { return runStop(interaction); },
};
