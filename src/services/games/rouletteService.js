import { randomUUID } from 'node:crypto';

const games = new Map();
const playerStats = new Map();
const JOIN_MS = 12_000;
const MAX_PLAYERS = 20;

function key(guildId, channelId) { return `${guildId}:${channelId}`; }
function statsKey(guildId, userId) { return `${guildId}:${userId}`; }
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function writeU16(out, value) { out.push(value & 255, (value >> 8) & 255); }

function lzwEncode(indices, minCodeSize = 4) {
  const clear = 1 << minCodeSize, end = clear + 1;
  let codeSize = minCodeSize + 1, nextCode = end + 1;
  let dict = new Map();
  for (let i = 0; i < clear; i++) dict.set(String.fromCharCode(i), i);
  let bits = 0, bitCount = 0, bytes = [];
  const emit = code => { bits |= code << bitCount; bitCount += codeSize; while (bitCount >= 8) { bytes.push(bits & 255); bits >>>= 8; bitCount -= 8; } };
  emit(clear);
  let phrase = String.fromCharCode(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const symbol = String.fromCharCode(indices[i]), combo = phrase + symbol;
    if (dict.has(combo)) { phrase = combo; continue; }
    emit(dict.get(phrase));
    if (nextCode < 4096) {
      dict.set(combo, nextCode++);
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      emit(clear); codeSize = minCodeSize + 1; nextCode = end + 1; dict = new Map();
      for (let j = 0; j < clear; j++) dict.set(String.fromCharCode(j), j);
    }
    phrase = symbol;
  }
  emit(dict.get(phrase)); emit(end); if (bitCount) bytes.push(bits & 255);
  const out = [minCodeSize];
  for (let i = 0; i < bytes.length; i += 255) { const chunk = bytes.slice(i, i + 255); out.push(chunk.length, ...chunk); }
  out.push(0); return out;
}

function drawFrame(width, height, count, rotation) {
  const pixels = new Uint8Array(width * height); pixels.fill(0);
  const cx = width / 2, cy = height / 2, radius = Math.min(cx, cy) - 14, twoPi = Math.PI * 2, sector = twoPi / count;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = x - cx, dy = y - cy, r = Math.sqrt(dx * dx + dy * dy); if (r > radius) continue;
    let a = Math.atan2(dy, dx) + Math.PI / 2 - rotation; while (a < 0) a += twoPi;
    const index = Math.floor((a % twoPi) / sector); pixels[y * width + x] = 2 + (index % 14);
  }
  for (let y = Math.floor(cy - 22); y <= Math.ceil(cy + 22); y++) for (let x = Math.floor(cx - 22); x <= Math.ceil(cx + 22); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= 22 ** 2) pixels[y * width + x] = 1;
  for (let y = 4; y < 32; y++) { const half = Math.max(1, Math.floor((y - 4) / 3)); for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) pixels[y * width + x] = 1; }
  return pixels;
}

export function createRouletteGif(participants, selectedIndex) {
  const width = 360, height = 360, frames = 22;
  const palette = [
    0x15171a, 0xffffff, 0x5865f2, 0xed4245, 0x57f287, 0xfee75c, 0xeb459e, 0x00b0f4,
    0xf47b67, 0x9b59b6, 0x2ecc71, 0xe67e22, 0x95a5a6, 0x1abc9c, 0x34495e, 0xc0392b,
  ];
  const out = [71,73,70,56,57,97];
  writeU16(out, width); writeU16(out, height); out.push(0xf3, 0, 0);
  for (const color of palette) out.push((color >> 16) & 255, (color >> 8) & 255, color & 255);
  const start = Math.random() * Math.PI * 2;
  const target = ((selectedIndex + 0.5) / participants.length) * Math.PI * 2;
  for (let f = 0; f < frames; f++) {
    const t = f / (frames - 1), eased = 1 - Math.pow(1 - t, 3), rotation = start + 4.5 * Math.PI * 2 * eased + target;
    out.push(0x21,0xf9,4,0,Math.max(2, Math.round(6 + 9 * t)) & 255,0,0,0);
    out.push(0x2c); writeU16(out,0); writeU16(out,0); writeU16(out,width); writeU16(out,height); out.push(0);
    out.push(...lzwEncode(drawFrame(width, height, participants.length, rotation), 4));
  }
  out.push(0x3b); return Buffer.from(out);
}

function ensureStats(guildId, userId) {
  const k = statsKey(guildId, userId);
  if (!playerStats.has(k)) playerStats.set(k, { rounds: 0, wins: 0, eliminations: 0, losses: 0 });
  return playerStats.get(k);
}

export function getRoulettePlayerStats(guildId, userId) {
  return { ...ensureStats(guildId, userId) };
}

export function recordRouletteRound(guildId, participants) {
  for (const participant of participants) ensureStats(guildId, participant.id).rounds += 1;
}

export function recordRouletteElimination(guildId, userId) {
  ensureStats(guildId, userId).eliminations += 1;
  ensureStats(guildId, userId).losses += 1;
}

export function recordRouletteWinner(guildId, userId) {
  ensureStats(guildId, userId).wins += 1;
}

export function getRoulette(guildId, channelId) { return games.get(key(guildId, channelId)) || null; }
export function cancelRoulette(guildId, channelId) { const k = key(guildId, channelId), game = games.get(k); if (game?.timer) clearTimeout(game.timer); games.delete(k); return game || null; }
export function createRoulette(guildId, channelId, user) {
  const k = key(guildId, channelId); if (games.has(k)) return { error: 'active', game: games.get(k) };
  ensureStats(guildId, user.id);
  const game = { id: randomUUID().replaceAll('-', '').slice(0, 12), guildId, channelId, phase: 'join', round: 0, participants: [{ id: user.id, username: user.username, avatar: user.displayAvatarURL({ extension: 'png', size: 128 }) }], selectedId: null, messageId: null, timer: null };
  games.set(k, game); game.timer = setTimeout(() => game.onJoinTimeout?.(), JOIN_MS); return { game };
}
export function addRoulettePlayer(guildId, channelId, user) {
  const game = getRoulette(guildId, channelId); if (!game || game.phase !== 'join') return { error: 'closed', game };
  if (game.participants.some(p => p.id === user.id)) return { error: 'joined', game }; if (game.participants.length >= MAX_PLAYERS) return { error: 'full', game };
  ensureStats(guildId, user.id);
  game.participants.push({ id: user.id, username: user.username, avatar: user.displayAvatarURL({ extension: 'png', size: 128 }) }); return { game };
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
