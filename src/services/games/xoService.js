const games = new Map();

export const XO_JOIN_MS = 20_000;
export const XO_TURN_MS = 10_000;
const keyOf = (guildId, channelId) => `${guildId}:${channelId}`;

const WINNING_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];

function winnerOf(board) {
    for (const [a, b, c] of WINNING_LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
}

export function createXO(guildId, channelId, starter) {
    const key = keyOf(guildId, channelId);
    if (games.has(key)) return { error: 'active' };

    const game = {
        key,
        guildId,
        channelId,
        players: [starter],
        symbols: { [starter.id]: '❌' },
        board: Array(9).fill(null),
        turnIndex: 0,
        phase: 'join',
        active: true,
        joinEndsAt: Math.floor((Date.now() + XO_JOIN_MS) / 1000),
        joinTimer: null,
        turnTimer: null,
    };

    games.set(key, game);
    return { game };
}

export function getXO(guildId, channelId) { return games.get(keyOf(guildId, channelId)); }
export function isXOPlayer(game, userId) { return !!game?.players.some(p => p.id === userId); }
export function currentXOPlayer(game) { return game?.players[game.turnIndex] || null; }

export function joinXO(game, user) {
    if (!game?.active || game.phase !== 'join') return { error: 'inactive' };
    if (isXOPlayer(game, user.id)) return { error: 'already' };
    if (game.players.length >= 2) return { error: 'full' };

    game.players.push(user);
    game.symbols[user.id] = '⭕';
    return { ok: true };
}

export function leaveXO(game, userId) {
    if (!game?.active || !isXOPlayer(game, userId)) return { error: 'not_in_game' };
    const index = game.players.findIndex(p => p.id === userId);
    game.players.splice(index, 1);
    return { ok: true, empty: game.players.length === 0 };
}

export function startXO(game) {
    if (!game?.active || game.phase !== 'join') return { error: 'inactive' };
    if (game.players.length !== 2) return { error: 'minimum' };
    game.phase = 'turn';
    game.turnIndex = 0;
    return { ok: true, player: currentXOPlayer(game) };
}

export function pickXOCell(game, userId, cell) {
    if (!game?.active || game.phase !== 'turn') return { error: 'inactive' };
    const player = currentXOPlayer(game);
    if (!player || player.id !== userId) return { error: 'not_turn' };
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) return { error: 'invalid_cell' };
    if (game.board[cell]) return { error: 'occupied' };

    const symbol = game.symbols[userId];
    game.board[cell] = symbol;

    const winnerSymbol = winnerOf(game.board);
    if (winnerSymbol) {
        const winner = game.players.find(p => game.symbols[p.id] === winnerSymbol) || player;
        const loser = game.players.find(p => p.id !== winner.id) || null;
        game.phase = 'finished';
        return { finished: true, winner, loser, cell };
    }

    if (game.board.every(Boolean)) {
        game.phase = 'finished';
        return { finished: true, draw: true, cell };
    }

    game.turnIndex = (game.turnIndex + 1) % 2;
    return { finished: false, player, next: currentXOPlayer(game), cell };
}

export function timeoutXO(game) {
    if (!game?.active || game.phase !== 'turn') return null;
    const loser = currentXOPlayer(game);
    const winner = game.players.find(p => p.id !== loser?.id) || null;
    game.phase = 'finished';
    return { loser, winner, finished: true };
}

export function endXO(game) {
    if (!game) return;
    if (game.joinTimer) clearTimeout(game.joinTimer);
    if (game.turnTimer) clearTimeout(game.turnTimer);
    game.active = false;
    game.phase = 'finished';
    games.delete(game.key);
}
