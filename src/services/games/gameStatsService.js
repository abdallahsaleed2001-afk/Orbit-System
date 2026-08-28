import { getFromDb, setInDb } from '../../utils/database.js';

export const GAME_NAMES = {
    roulette: 'الروليت',
    mines: 'لغم',
    xo: 'إكس أو',
    fakk: 'فكك',
    ashbak: 'اشبك',
    asra: 'أسرع',
    ism: 'اسم',
    hisab: 'حساب',
    ratib: 'رتب',
    aks: 'عكس',
    harf: 'حرف',
    mokhtalef: 'مختلف',
    thakira: 'ذاكرة',
};

const GAME_KEYS = Object.keys(GAME_NAMES);
const keyOf = (guildId, userId) => `temp:game_stats:${guildId}:${userId}`;

function emptyStats() {
    return Object.fromEntries(GAME_KEYS.map(game => [game, { wins: 0, losses: 0 }]));
}

function normalizeStats(value) {
    const source = value && typeof value === 'object' ? value : {};
    const stats = emptyStats();
    for (const game of GAME_KEYS) {
        stats[game] = {
            wins: Math.max(0, Number(source?.[game]?.wins) || 0),
            losses: Math.max(0, Number(source?.[game]?.losses) || 0),
        };
    }
    return stats;
}

export async function getGameStats(guildId, userId) {
    try {
        const value = await getFromDb(keyOf(guildId, userId), emptyStats());
        return normalizeStats(value);
    } catch {
        return emptyStats();
    }
}

export async function recordGameResult(guildId, game, winners = [], losers = []) {
    if (!GAME_KEYS.includes(game)) return false;
    const uniqueWinners = [...new Set(winners.filter(Boolean))];
    const uniqueLosers = [...new Set(losers.filter(Boolean))];

    try {
        await Promise.all([
            ...uniqueWinners.map(async userId => {
                const stats = await getGameStats(guildId, userId);
                stats[game].wins += 1;
                await setInDb(keyOf(guildId, userId), stats);
            }),
            ...uniqueLosers.filter(userId => !uniqueWinners.includes(userId)).map(async userId => {
                const stats = await getGameStats(guildId, userId);
                stats[game].losses += 1;
                await setInDb(keyOf(guildId, userId), stats);
            }),
        ]);
        return true;
    } catch {
        return false;
    }
}
