const games = new Map();

export const CHAIRS_JOIN_MS = 20 * 1000;
export const CHAIRS_ROUND_MS = 15 * 1000;
export const CHAIRS_READY_MS = 2 * 1000;

export function getChairs(guildId, channelId) {
  return games.get(`${guildId}:${channelId}`);
}

export function hasActiveChairs(guildId, channelId) {
  const game = games.get(`${guildId}:${channelId}`);
  return Boolean(game && game.active);
}

export function createChairs(guildId, channelId, user) {
  const key = `${guildId}:${channelId}`;
  if (games.has(key)) return { error: 'active' };

  const game = {
    guildId,
    channelId,
    active: true,
    phase: 'join', // join | ready | playing | ended
    players: [{ id: user.id, username: user.username }],
    seated: new Map(),   // userId -> seatIndex
    eliminated: [],
    round: 0,
    joinEndsAt: Math.floor(Date.now() / 1000) + Math.floor(CHAIRS_JOIN_MS / 1000),
    messageId: null,
    joinTimer: null,
    roundTimer: null,
  };

  games.set(key, game);
  return { game };
}

export function joinChairs(game, user) {
  if (game.phase !== 'join') return { error: 'not_join' };
  if (game.players.some(p => p.id === user.id)) return { error: 'already' };
  if (game.players.length >= 20) return { error: 'full' };
  game.players.push({ id: user.id, username: user.username });
  return { ok: true };
}

export function leaveChairs(game, userId) {
  const idx = game.players.findIndex(p => p.id === userId);
  if (idx === -1) return { error: 'not_in' };
  game.players.splice(idx, 1);
  return { ok: true, empty: game.players.length === 0 };
}

export function startChairsRound(game) {
  if (game.players.length < 2) return { error: 'not_enough' };
  game.round++;
  game.seated.clear();
  return { ok: true, chairsCount: game.players.length - 1 };
}

export function sitOnChair(game, userId, seatIndex) {
  // Player already seated
  if (game.seated.has(userId)) return { error: 'already_seated' };
  // Not a player
  if (!game.players.some(p => p.id === userId)) return { error: 'not_player' };
  // Seat already taken
  for (const [, idx] of game.seated) {
    if (idx === seatIndex) return { error: 'seat_taken' };
  }

  game.seated.set(userId, seatIndex);

  // Check if all chairs are taken
  const chairsCount = game.players.length - 1;
  if (game.seated.size >= chairsCount) {
    // Find eliminated player
    const seatedIds = new Set(game.seated.keys());
    const eliminatedPlayer = game.players.find(p => !seatedIds.has(p.id));
    return { ok: true, seated: true, eliminated: eliminatedPlayer };
  }

  // Check if only 2 players remain (1 chair = winner round)
  if (game.players.length === 2 && game.seated.size >= 1) {
    const winner = game.players.find(p => p.id === userId);
    const loser = game.players.find(p => p.id !== userId);
    return { ok: true, seated: true, winner };
  }

  return { ok: true, seated: true };
}

export function eliminateByTimeout(game) {
  const chairsCount = game.players.length - 1;
  const seatedIds = new Set(game.seated.keys());
  const remaining = game.players.filter(p => !seatedIds.has(p.id));

  if (remaining.length <= 1) {
    // Only one didn't sit - they're eliminated
    const eliminated = remaining[0] || game.players.find(p => !seatedIds.has(p.id));
    return { eliminated };
  }

  // Multiple didn't sit - eliminate random one
  const rand = remaining[Math.floor(Math.random() * remaining.length)];
  return { eliminated: rand };
}

export function removePlayer(game, userId) {
  const idx = game.players.findIndex(p => p.id === userId);
  if (idx === -1) return null;
  game.seated.delete(userId);
  const [removed] = game.players.splice(idx, 1);
  return removed;
}

export function endChairs(game) {
  game.active = false;
  game.phase = 'ended';
  if (game.joinTimer) { clearTimeout(game.joinTimer); game.joinTimer = null; }
  if (game.roundTimer) { clearTimeout(game.roundTimer); game.roundTimer = null; }
  const key = `${game.guildId}:${game.channelId}`;
  games.delete(key);
}
