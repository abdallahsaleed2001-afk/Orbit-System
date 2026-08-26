import { deflateSync } from 'node:zlib';

const FONT = {
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
  '-':['00000','00000','00000','11111','00000','00000','00000'],'.':['00000','00000','00000','00000','00000','00110','00110'],'@':['01110','10001','10111','10101','10111','10000','01110'],'?':['01110','10001','00001','00010','00100','00000','00100'],' ':['00000','00000','00000','00000','00000','00000','00000']
};

const COLORS = ['#101217','#191d25','#f5f7fb','#9aa4b2','#5865f2','#57f287','#ed4245','#f0b90b','#9b59b6','#e67e22','#3498db','#1abc9c','#0b0d11','#2a2512','#20242c','#ffffff'];
const rgb = hex => { const n = Number.parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const PAL = COLORS.map(rgb);
const clean = (value, max) => { const s = String(value ?? '').normalize('NFKD').replace(/[^A-Za-z0-9_@.\- ]/g, '?').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
const pixel = (p, w, x, y, c) => { if (x < 0 || y < 0 || x >= w || y >= p.length / (w * 3)) return; const i = (y * w + x) * 3; p[i] = c[0]; p[i + 1] = c[1]; p[i + 2] = c[2]; };
const rect = (p, w, h, x, y, rw, rh, c) => { for (let yy = Math.max(0, y); yy < Math.min(h, y + rh); yy++) for (let xx = Math.max(0, x); xx < Math.min(w, x + rw); xx++) pixel(p, w, xx, yy, c); };

function text(p, w, h, value, x, y, scale, color, align = 'left', maxWidth = Infinity) {
  const chars = [...String(value).toUpperCase()], cw = 5 * scale, gap = scale;
  const maxChars = Number.isFinite(maxWidth) ? Math.max(1, Math.floor((maxWidth + gap) / (cw + gap))) : chars.length;
  const shown = chars.slice(0, maxChars), total = shown.length * (cw + gap) - gap;
  let sx = x; if (align === 'center') sx -= total / 2; if (align === 'right') sx -= total;
  shown.forEach((ch, i) => { const glyph = FONT[ch] || FONT['?']; const gx = Math.round(sx + i * (cw + gap)); glyph.forEach((row, ry) => [...row].forEach((bit, rx) => { if (bit === '1') rect(p, w, h, gx + rx * scale, y + ry * scale, scale, scale, color); })); });
}

function sector(p, w, h, cx, cy, radius, start, end, color) {
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(h - 1, Math.ceil(cy + radius)); y++) for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(w - 1, Math.ceil(cx + radius)); x++) {
    const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > radius * radius) continue;
    let a = Math.atan2(dy, dx); while (a < 0) a += Math.PI * 2;
    let s = start, e = end; while (s < 0) { s += Math.PI * 2; e += Math.PI * 2; } while (a < s) a += Math.PI * 2;
    if (a >= s && a < e) pixel(p, w, x, y, color);
  }
}

function drawRoulettePixels(game, selectedIndex = null, rotation = 0) {
  const w = 700, h = 420, p = Buffer.alloc(w * h * 3), bg = PAL[0], panel = PAL[1], white = PAL[2], muted = PAL[3], blue = PAL[4], gold = PAL[7];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pixel(p, w, x, y, bg);
  rect(p, w, h, 16, 16, 668, 388, panel); rect(p, w, h, 16, 16, 5, 388, blue);
  text(p, w, h, 'ORBIT SYSTEM', 38, 34, 3, white); text(p, w, h, `ROULETTE ROUND ${game.round}`, 38, 58, 1, muted); text(p, w, h, 'PLAYERS', 38, 92, 2, white);
  const shown = game.participants.slice(0, 10);
  shown.forEach((player, i) => { const col = i >= 5 ? 1 : 0, row = i % 5, x = 38 + col * 170, y = 120 + row * 38, active = selectedIndex !== null && game.participants[selectedIndex]?.id === player.id; rect(p, w, h, x, y, 18, 18, active ? gold : blue); text(p, w, h, i + 1, x + 9, y + 4, 1, white, 'center'); text(p, w, h, clean(player.username, 13), x + 27, y + 1, 1, active ? gold : white, 'left', 140); });
  if (game.participants.length > shown.length) text(p, w, h, `+${game.participants.length - shown.length} MORE`, 38, 318, 1, muted);
  const cx = 500, cy = 215, r = 160, count = Math.max(2, game.participants.length), step = Math.PI * 2 / count, colors = [4, 5, 6, 7, 8, 9, 10, 11];
  for (let i = 0; i < count; i++) { const a = -Math.PI / 2 + rotation + i * step; sector(p, w, h, cx, cy, r, a, a + step, PAL[colors[i % colors.length]]); }
  for (let a = 0; a < Math.PI * 2; a += 0.003) pixel(p, w, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), white);
  for (let i = 0; i < count; i++) { const player = game.participants[i], a = -Math.PI / 2 + rotation + (i + 0.5) * step; text(p, w, h, clean(player.username, 7), cx + Math.cos(a) * r * 0.68, cy + Math.sin(a) * r * 0.68 - 4, 1, white, 'center', 72); }
  const hub = PAL[12]; for (let y = cy - 40; y <= cy + 40; y++) for (let x = cx - 40; x <= cx + 40; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= 40 ** 2) pixel(p, w, x, y, hub); text(p, w, h, 'ORBIT', cx, cy - 5, 1, white, 'center');
  for (let y = 30; y < 52; y++) { const half = Math.max(1, Math.floor((y - 30) / 4)); for (let x = cx - half; x <= cx + half; x++) pixel(p, w, x, y, white); }
  const selected = selectedIndex !== null ? game.participants[selectedIndex] : null;
  rect(p, w, h, 330, 350, 330, 24, selected ? PAL[13] : PAL[14]);
  text(p, w, h, selected ? `TURN: ${clean(selected.username, 18)}` : 'WAITING FOR PLAYERS', 495, 357, 1, selected ? gold : muted, 'center', 300);
  return { w, h, p };
}

function writeU16(out, value) { out.push(value & 255, (value >> 8) & 255); }

// Simple valid GIF LZW stream. Clearing after each pixel keeps the encoder small and predictable.
function encodeGifFrame(indices, minCodeSize = 4) {
  const clear = 1 << minCodeSize, end = clear + 1, codeSize = minCodeSize + 1;
  let bitBuffer = 0, bitCount = 0; const data = [];
  const emit = code => { bitBuffer |= code << bitCount; bitCount += codeSize; while (bitCount >= 8) { data.push(bitBuffer & 255); bitBuffer >>>= 8; bitCount -= 8; } };
  emit(clear); for (const index of indices) { emit(index); emit(clear); } emit(end); if (bitCount > 0) data.push(bitBuffer & 255);
  const out = [minCodeSize]; for (let i = 0; i < data.length; i += 255) { const chunk = data.slice(i, i + 255); out.push(chunk.length, ...chunk); } out.push(0); return out;
}

function nearestPaletteIndex(p, offset) {
  const r = p[offset], g = p[offset + 1], b = p[offset + 2]; let best = 0, distance = Infinity;
  for (let i = 0; i < PAL.length; i++) { const dr = r - PAL[i][0], dg = g - PAL[i][1], db = b - PAL[i][2], d = dr * dr + dg * dg + db * db; if (d < distance) { distance = d; best = i; } }
  return best;
}

export function createRouletteGif(game, selectedIndex) {
  const frames = 12, w = 700, h = 420, out = [71, 73, 70, 56, 57, 97];
  writeU16(out, w); writeU16(out, h); out.push(0xF3, 0, 0); for (const color of PAL) out.push(...color);
  out.push(0x21, 0xFF, 0x0B, ...Buffer.from('NETSCAPE2.0', 'ascii'), 0x03, 0x01, 0x00, 0x00, 0x00);
  const count = Math.max(2, game.participants.length), step = Math.PI * 2 / count, target = -((selectedIndex + 0.5) * step), start = target + Math.random() * Math.PI * 2 + Math.PI * 2 * 4.5;
  for (let frame = 0; frame < frames; frame++) {
    const t = frame / (frames - 1), eased = 1 - Math.pow(1 - t, 3), rotation = start + (target - start) * eased;
    const { p } = drawRoulettePixels(game, selectedIndex, rotation), indices = new Uint8Array(w * h);
    for (let i = 0, offset = 0; i < indices.length; i++, offset += 3) indices[i] = nearestPaletteIndex(p, offset);
    const delay = frame === frames - 1 ? 100 : Math.max(5, Math.round(6 + 8 * t));
    out.push(0x21, 0xF9, 0x04, 0x00, delay & 255, (delay >> 8) & 255, 0x00, 0x00, 0x2C); writeU16(out, 0); writeU16(out, 0); writeU16(out, w); writeU16(out, h); out.push(0x00); out.push(...encodeGifFrame(indices, 4));
  }
  out.push(0x3B); return Buffer.from(out);
}

export function createRouletteImage(game, selectedIndex = null) {
  const { w, h, p } = drawRoulettePixels(game, selectedIndex, 0), raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; p.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const crc32 = data => { let crc = 0xffffffff; for (const b of data) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type), body = Buffer.concat([t, data]), out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length, 0); t.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc32(body), data.length + 8); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
