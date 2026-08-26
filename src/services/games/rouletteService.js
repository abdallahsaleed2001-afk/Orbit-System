import { randomUUID } from 'node:crypto';

const games = new Map();
const playerStats = new Map();
const JOIN_MS = 60_000;
const DECISION_MS = 30_000;
const MAX_PLAYERS = 100;

function key(guildId, channelId) { return `${guildId}:${channelId}`; }
function statsKey(guildId, userId) { return `${guildId}:${userId}`; }
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

function ensureStats(guildId, userId) {
  const k = statsKey(guildId, userId);
  if (!playerStats.has(k)) playerStats.set(k, { rounds: 0, wins: 0, eliminations: 0, losses: 0 });
  return playerStats.get(k);
}

export function getRoulettePlayerStats(guildId, userId) { return { ...ensureStats(guildId, userId) }; }
export function recordRouletteRound(guildId, participants) {
  for (const participant of participants) ensureStats(guildId, participant.id).rounds += 1;
}
export function recordRouletteElimination(guildId, userId) {
  ensureStats(guildId, userId).eliminations += 1;
  ensureStats(guildId, userId).losses += 1;
}
export function recordRouletteWinner(guildId, userId) { ensureStats(guildId, userId).wins += 1; }
export function getRoulette(guildId, channelId) { return games.get(key(guildId, channelId)) || null; }

export function clearRouletteTimer(game) {
  if (game?.timer) clearTimeout(game.timer);
  game.timer = null;
}

export function cancelRoulette(guildId, channelId) {
  const k = key(guildId, channelId);
  const game = games.get(k);
  if (game) clearRouletteTimer(game);
  games.delete(k);
  return game || null;
}

export function createRoulette(guildId, channelId, user) {
  const k = key(guildId, channelId);
  if (games.has(k)) return { error: 'active', game: games.get(k) };
  ensureStats(guildId, user.id);
  const game = {
    id: randomUUID().replaceAll('-', '').slice(0, 12),
    guildId,
    channelId,
    phase: 'join',
    round: 0,
    participants: [{
      id: user.id,
      username: user.username,
      avatar: user.displayAvatarURL({ extension: 'png', size: 128 }),
    }],
    selectedId: null,
    messageId: null,
    currentMessageId: null,
    timer: null,
    joinEndsAt: null,
    decisionEndsAt: null,
    onJoinTimeout: null,
  };
  games.set(k, game);
  return { game };
}

export function scheduleJoinTimeout(game, callback) {
  clearRouletteTimer(game);
  game.timer = setTimeout(callback, JOIN_MS);
  return game.timer;
}

export function scheduleDecisionTimeout(game, callback) {
  clearRouletteTimer(game);
  game.decisionEndsAt = Date.now() + DECISION_MS;
  game.timer = setTimeout(callback, DECISION_MS);
  return game.timer;
}

export function addRoulettePlayer(guildId, channelId, user) {
  const game = getRoulette(guildId, channelId);
  if (!game || game.phase !== 'join') return { error: 'closed', game };
  if (game.participants.some(p => p.id === user.id)) return { error: 'joined', game };
  if (game.participants.length >= MAX_PLAYERS) return { error: 'full', game };
  ensureStats(guildId, user.id);
  game.participants.push({
    id: user.id,
    username: user.username,
    avatar: user.displayAvatarURL({ extension: 'png', size: 128 }),
  });
  return { game };
}

export function removeRoulettePlayer(game, userId) {
  if (!game) return false;
  const before = game.participants.length;
  game.participants = game.participants.filter(p => p.id !== userId);
  if (game.selectedId === userId) game.selectedId = null;
  return game.participants.length !== before;
}

export function chooseRouletteTarget(game, targetId) {
  if (!game || game.phase !== 'decision' || !game.selectedId) return false;
  if (targetId === game.selectedId) return false;
  if (!game.participants.some(p => p.id === targetId)) return false;
  removeRoulettePlayer(game, targetId);
  game.selectedId = null;
  return true;
}

export function chooseRandomTarget(game, excludedId) {
  if (!game || game.phase !== 'decision') return null;
  const candidates = game.participants.filter(p => p.id !== excludedId);
  if (!candidates.length) return null;
  const target = pick(candidates);
  removeRoulettePlayer(game, target.id);
  game.selectedId = null;
  return target;
}

export function beginRouletteRound(game) {
  if (!game || game.participants.length < 2) return null;
  clearRouletteTimer(game);
  game.phase = 'spinning';
  game.round += 1;
  recordRouletteRound(game.guildId, game.participants);
  const index = Math.floor(Math.random() * game.participants.length);
  game.selectedId = game.participants[index].id;
  return { index, participant: game.participants[index] };
}

export function finishRouletteAction(game) {
  if (!game) return;
  game.phase = game.participants.length <= 1 ? 'finished' : 'decision';
}

export function isSelected(game, userId) {
  return game?.phase === 'decision' && game.selectedId === userId;
}
export function isParticipant(game, userId) { return game?.participants.some(p => p.id === userId); }
export function getWinner(game) { return game?.participants?.[0] || null; }
export { MAX_PLAYERS, JOIN_MS, DECISION_MS };
