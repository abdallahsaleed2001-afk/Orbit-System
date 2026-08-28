import { getFromDb, setInDb } from '../../utils/database.js';

const DEFAULT_STATS = {
    mines: { wins: 0, losses: 0 },
    xo: { wins: 0, losses: 0 },
};

const keyOf = (guildId, userId) => `temp:game_stats:${guildId}:${userId}`;

function normalizeStats(value) {
    const source = value && typeof value === 'object' ? value : {};
    const normalizeGame = game => ({
        wins: Math.max(0, Number(game?.wins) || 0),
        losses: Math.max(0, Number(game?.losses) || 0),
    });

    return {
        mines: normalizeGame(source.mines),
        xo: normalizeGame(source.xo),
    };
}

export async function getGameStats(guildId, userId) {
    try {
        const value = await getFromDb(keyOf(guildId, userId), DEFAULT_STATS);
        return normalizeStats(value);
    } catch {
        return normalizeStats(DEFAULT_STATS);
    }
}

export async function recordGameResult(guildId, game, winners = [], losers = []) {
    const uniqueWinners = [...new Set(winners.filter(Boolean))];
    const uniqueLosers = [...new Set(losers.filter(Boolean))];
    if (!['mines', 'xo'].includes(game)) return false;

    try {
        await Promise.all([
            ...uniqueWinners.map(async userId => {
                const stats = await getGameStats(guildId, userId);
                stats[game].wins += 1;
                await setInDb(keyOf(guildId, userId), stats);
            }),
            ...uniqueLosers.map(async userId => {
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
