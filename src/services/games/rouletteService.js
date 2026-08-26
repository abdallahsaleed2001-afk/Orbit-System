import { randomUUID } from 'node:crypto';

const games = new Map();
const playerStats = new Map();
const JOIN_MS = 60_000;
const MAX_PLAYERS = 100;

function key(guildId, channelId) { return `${guildId}:${channelId}`; }
function statsKey(guildId, userId) { return `${guildId}:${userId}`; }
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function writeU16(out, value) { out.push(value & 255, (value >> 8) & 255); }

function encodeGifFrame(indices, minCodeSize = 2) {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const codeSize = minCodeSize + 1;
  let bitBuffer = 0;
  let bitCount = 0;
  const data = [];
  const emit = code => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      data.push(bitBuffer & 255);
      bitBuffer >>>= 8;
      bitCount -= 8;
    }
  };
  emit(clear);
  for (const index of indices) {
    emit(index & (clear - 1));
    emit(clear);
  }
  emit(end);
  if (bitCount > 0) data.push(bitBuffer & 255);
  const out = [minCodeSize];
  for (let i = 0; i < data.length; i += 255) {
    const chunk = data.slice(i, i + 255);
    out.push(chunk.length, ...chunk);
  }
  out.push(0);
  return out;
}

function drawFrame(width, height, count, rotation) {
  const pixels = new Uint8Array(width * height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) - 10;
  const twoPi = Math.PI * 2;
  const sector = twoPi / count;
  pixels.fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > radius) continue;
      let angle = Math.atan2(dy, dx) + Math.PI / 2 - rotation;
      while (angle < 0) angle += twoPi;
      const index = Math.floor((angle % twoPi) / sector);
      pixels[y * width + x] = 1 + (index % 3);
    }
  }
  for (let y = Math.floor(cy - 10); y <= Math.ceil(cy + 10); y++) {
    for (let x = Math.floor(cx - 10); x <= Math.ceil(cx + 10); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= 10 ** 2) pixels[y * width + x] = 0;
    }
  }
  for (let y = 2; y < 18; y++) {
    const half = Math.max(1, Math.floor((y - 2) / 3));
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) pixels[y * width + x] = 0;
  }
  return pixels;
}

export function createRouletteGif(participants, selectedIndex) {
  const width = 160;
  const height = 160;
  const frames = 18;
  const palette = [0x15171a, 0x5865f2, 0xed4245, 0x57f287];
  const out = [71, 73, 70, 56, 57, 97];
  writeU16(out, width);
  writeU16(out, height);
  out.push(0xf0, 0x00, 0x00);
  for (const color of palette) out.push((color >> 16) & 255, (color >> 8) & 255, color & 255);
  const count = Math.max(2, participants.length);
  const start = Math.random() * Math.PI * 2;
  const target = ((selectedIndex + 0.5) / count) * Math.PI * 2;
  for (let frame = 0; frame < frames; frame++) {
    const t = frame / (frames - 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const rotation = start + Math.PI * 2 * 5.5 * eased + target;
    const delay = Math.max(3, Math.round(4 + 8 * t));
    out.push(0x21, 0xf9, 0x04, 0x08, delay & 255, (delay >> 8) & 255, 0x00, 0x00);
    out.push(0x2c);
    writeU16(out, 0); writeU16(out, 0); writeU16(out, width); writeU16(out, height); out.push(0x00);
    out.push(...encodeGifFrame(drawFrame(width, height, count, rotation), 2));
  }
  out.push(0x3b);
  return Buffer.from(out);
}

function ensureStats(guildId, userId) {
  const k = statsKey(guildId, userId);
  if (!playerStats.has(k)) playerStats.set(k, { rounds: 0, wins: 0, eliminations: 0, losses: 0 });
  return playerStats.get(k);
}
export function getRoulettePlayerStats(guildId, userId) { return { ...ensureStats(guildId, userId) }; }
export function recordRouletteRound(guildId, participants) { for (const participant of participants) ensureStats(guildId, participant.id).rounds += 1; }
export function recordRouletteElimination(guildId, userId) { ensureStats(guildId, userId).eliminations += 1; ensureStats(guildId, userId).losses += 1; }
export function recordRouletteWinner(guildId, userId) { ensureStats(guildId, userId).wins += 1; }
export function getRoulette(guildId, channelId) { return games.get(key(guildId, channelId)) || null; }
export function cancelRoulette(guildId, channelId) { const k = key(guildId, channelId), game = games.get(k); if (game?.timer) clearTimeout(game.timer); games.delete(k); return game || null; }
export function createRoulette(guildId, channelId, user) {
  const k = key(guildId, channelId);
  if (games.has(k)) return { error: 'active', game: games.get(k) };
  ensureStats(guildId, user.id);
  const game = { id: randomUUID().replaceAll('-', '').slice(0, 12), guildId, channelId, phase: 'join', round: 0, participants: [{ id: user.id, username: user.username, avatar: user.displayAvatarURL({ extension: 'png', size: 128 }) }], selectedId: null, messageId: null, timer: null };
  games.set(k, game);
  game.timer = setTimeout(() => game.onJoinTimeout?.(), JOIN_MS);
  return { game };
}
export function addRoulettePlayer(guildId, channelId, user) {
  const game = getRoulette(guildId, channelId);
  if (!game || game.phase !== 'join') return { error: 'closed', game };
  if (game.participants.some(p => p.id === user.id)) return { error: 'joined', game };
  if (game.participants.length >= MAX_PLAYERS) return { error: 'full', game };
  ensureStats(guildId, user.id);
  game.participants.push({ id: user.id, username: user.username, avatar: user.displayAvatarURL({ extension: 'png', size: 128 }) });
  return { game };
}
export function removeRoulettePlayer(game, userId) { game.participants = game.participants.filter(p => p.id !== userId); }
export function chooseRouletteTarget(game, targetId) { if (!game.participants.some(p => p.id === targetId)) return false; removeRoulettePlayer(game, targetId); game.selectedId = null; return true; }
export function chooseRandomTarget(game, excludedId) { const candidates = game.participants.filter(p => p.id !== excludedId); if (!candidates.length) return null; const target = pick(candidates); removeRoulettePlayer(game, target.id); game.selectedId = null; return target; }
export function beginRouletteRound(game) { if (game.participants.length < 2) return null; game.phase = 'spinning'; game.round += 1; recordRouletteRound(game.guildId, game.participants); const index = Math.floor(Math.random() * game.participants.length); game.selectedId = game.participants[index].id; return { index, participant: game.participants[index] }; }
export function finishRouletteAction(game) { game.phase = game.participants.length <= 1 ? 'finished' : 'decision'; }
export function isSelected(game, userId) { return game?.phase === 'decision' && game.selectedId === userId; }
export function isParticipant(game, userId) { return game?.participants.some(p => p.id === userId); }
export function getWinner(game) { return game?.participants?.[0] || null; }
export { MAX_PLAYERS, JOIN_MS };
