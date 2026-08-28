const games = new Map();

export const MINES_JOIN_MS = 20_000;
export const MINES_TURN_MS = 10_000;
const keyOf = (guildId, channelId) => `${guildId}:${channelId}`;

function newRound(game) {
  game.round += 1;
  game.mine = Math.floor(Math.random() * 9);
  game.revealed = new Set();
  game.phase = 'turn';
}

export function createMines(guildId, channelId, starter) {
  const key = keyOf(guildId, channelId);
  if (games.has(key)) return { error: 'active' };
  const game = { key, guildId, channelId, players: [starter], eliminated: new Set(), revealed: new Set(), mine: null, round: 0, turnIndex: 0, phase: 'join', active: true, joinEndsAt: Math.floor((Date.now() + MINES_JOIN_MS) / 1000), joinTimer: null, turnTimer: null };
  games.set(key, game);
  return { game };
}
export function getMines(guildId, channelId) { return games.get(keyOf(guildId, channelId)); }
export function isPlayer(game, userId) { return !!game?.players.some(p => p.id === userId); }
export function currentPlayer(game) { return game?.players[game.turnIndex] || null; }
export function joinMines(game, user) { if (!game?.active || game.phase !== 'join') return { error: 'inactive' }; if (isPlayer(game, user.id)) return { error: 'already' }; if (game.players.length >= 100) return { error: 'full' }; game.players.push(user); return { ok: true }; }
export function leaveMines(game, userId) { if (!game?.active || !isPlayer(game, userId)) return { error: 'not_in_game' }; const index = game.players.findIndex(p => p.id === userId); game.players.splice(index, 1); if (game.turnIndex >= game.players.length) game.turnIndex = 0; return { ok: true, empty: game.players.length === 0 }; }
export function startMines(game) { if (!game?.active || game.phase !== 'join') return { error: 'inactive' }; if (game.players.length < 2) return { error: 'minimum' }; newRound(game); return { ok: true, player: currentPlayer(game) }; }
export function pickMinesCell(game, userId, cell) { if (!game?.active || game.phase !== 'turn') return { error: 'inactive' }; const player = currentPlayer(game); if (!player || player.id !== userId) return { error: 'not_turn' }; if (!Number.isInteger(cell) || cell < 0 || cell > 8) return { error: 'invalid_cell' }; if (game.revealed.has(cell)) return { error: 'revealed' }; game.revealed.add(cell); if (cell === game.mine) { game.lastMine = cell; game.players.splice(game.turnIndex, 1); game.eliminated.add(userId); if (game.players.length <= 1) { game.phase = 'finished'; return { mine: true, mineCell: cell, eliminated: player, winner: game.players[0] || null, finished: true }; } if (game.turnIndex >= game.players.length) game.turnIndex = 0; newRound(game); return { mine: true, mineCell: cell, eliminated: player, next: currentPlayer(game), finished: false }; } game.turnIndex = (game.turnIndex + 1) % game.players.length; return { mine: false, player, next: currentPlayer(game) }; }
export function eliminateCurrentForTimeout(game) { if (!game?.active || game.phase !== 'turn') return null; const player = currentPlayer(game); if (!player) return null; game.players.splice(game.turnIndex, 1); game.eliminated.add(player.id); if (game.players.length <= 1) { game.phase = 'finished'; return { eliminated: player, winner: game.players[0] || null, finished: true }; } if (game.turnIndex >= game.players.length) game.turnIndex = 0; newRound(game); return { eliminated: player, next: currentPlayer(game), finished: false }; }
export function endMines(game) { if (!game) return; if (game.joinTimer) clearTimeout(game.joinTimer); if (game.turnTimer) clearTimeout(game.turnTimer); game.active = false; game.phase = 'finished'; games.delete(game.key); }
