const games = new Map();

export function createMines(guildId, channelId, starter) {
  const key = `${guildId}:${channelId}`;
  if (games.has(key)) return { error: 'active' };
  const mine = Math.floor(Math.random() * 9);
  const game = { key, guildId, channelId, mine, players: new Map([[starter.id, starter]]), eliminated: new Set(), revealed: new Set(), active: true };
  games.set(key, game);
  return { game };
}

export function getMines(guildId, channelId) { return games.get(`${guildId}:${channelId}`); }

export function joinMines(game, user) {
  if (!game?.active) return { error: 'inactive' };
  if (game.eliminated.has(user.id)) return { error: 'eliminated' };
  if (game.players.has(user.id)) return { error: 'already' };
  game.players.set(user.id, user);
  return { ok: true };
}

export function leaveMines(game, userId) {
  if (!game?.active || !game.players.has(userId)) return { error: 'not_in_game' };
  game.players.delete(userId);
  return { ok: true, empty: game.players.size === 0 };
}

export function pickMine(game, userId, cell) {
  if (!game?.active) return { error: 'inactive' };
  if (!game.players.has(userId)) return { error: 'not_in_game' };
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) return { error: 'invalid_cell' };
  if (game.revealed.has(cell)) return { error: 'revealed' };

  game.revealed.add(cell);
  if (cell === game.mine) {
    game.players.delete(userId);
    game.eliminated.add(userId);
    const winner = game.players.size === 1 ? [...game.players.values()][0] : null;
    if (game.players.size <= 1) endMines(game);
    return { mine: true, winner };
  }

  return { mine: false, winner: game.players.size === 1 ? [...game.players.values()][0] : null };
}

export function endMines(game) {
  if (!game) return;
  game.active = false;
  games.delete(game.key);
}

export function getMinesStatus(game) {
  return [...game.players.values()];
}
