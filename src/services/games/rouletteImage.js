import { deflateSync } from 'node:zlib';

const FONT = {
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
  '-':['00000','00000','00000','11111','00000','00000','00000'],'.':['00000','00000','00000','00000','00000','00110','00110'],'@':['01110','10001','10111','10101','10111','10000','01110'],'?':['01110','10001','00001','00010','00100','00000','00100'],' ':['00000','00000','00000','00000','00000','00000','00000']
};

const rgb = hex => { const n = Number.parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const clean = (value, max) => { const s = String(value ?? '').normalize('NFKD').replace(/[^A-Za-z0-9_@.\- ]/g, '?').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
const pixel = (p, w, x, y, c) => { if (x < 0 || y < 0 || x >= w) return; const i = (y * w + x) * 3; p[i] = c[0]; p[i + 1] = c[1]; p[i + 2] = c[2]; };
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
    let a = Math.atan2(dy, dx); while (a < 0) a += Math.PI * 2; let s = start, e = end; while (s < 0) { s += Math.PI * 2; e += Math.PI * 2; } while (a < s) a += Math.PI * 2;
    if (a >= s && a < e) pixel(p, w, x, y, color);
  }
}

function png(w, h, pixels) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; pixels.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const crc32 = data => { let crc = 0xffffffff; for (const b of data) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type); const body = Buffer.concat([t, data]); const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length, 0); t.copy(out, 4); data.copy(out, 8); out.writeUInt32BE(crc32(body), data.length + 8); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function createRouletteImage(game, selectedIndex = null) {
  const w = 1000, h = 560, p = Buffer.alloc(w * h * 3), bg = rgb('#101217'), panel = rgb('#191d25'), white = rgb('#f5f7fb'), muted = rgb('#9aa4b2'), blue = rgb('#5865f2'), gold = rgb('#f0b90b');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pixel(p, w, x, y, bg);
  rect(p, w, h, 24, 24, 952, 512, panel); rect(p, w, h, 24, 24, 6, 512, blue);
  text(p, w, h, 'ORBIT SYSTEM', 55, 48, 4, white); text(p, w, h, `ROULETTE ROUND ${game.round}`, 55, 82, 2, muted); text(p, w, h, 'PLAYERS', 55, 125, 3, white);
  const shown = game.participants.slice(0, 14);
  shown.forEach((player, i) => { const col = i >= 7 ? 1 : 0, row = i % 7, x = 55 + col * 235, y = 165 + row * 45, active = selectedIndex !== null && game.participants[selectedIndex]?.id === player.id; rect(p, w, h, x, y, 24, 24, active ? gold : blue); text(p, w, h, i + 1, x + 12, y + 6, 2, white, 'center'); text(p, w, h, clean(player.username, 18), x + 35, y + 3, 2, active ? gold : white, 'left', 195); });
  if (game.participants.length > shown.length) text(p, w, h, `+${game.participants.length - shown.length} MORE`, 55, 492, 2, muted);
  const cx = 725, cy = 292, r = 205, count = Math.max(2, game.participants.length), step = Math.PI * 2 / count;
  const colors = ['#5865f2','#57f287','#ed4245','#f0b90b','#9b59b6','#e67e22','#3498db','#1abc9c'];
  for (let i = 0; i < count; i++) sector(p, w, h, cx, cy, r, -Math.PI / 2 + i * step, -Math.PI / 2 + (i + 1) * step, rgb(colors[i % colors.length]));
  for (let a = 0; a < Math.PI * 2; a += 0.004) pixel(p, w, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), white);
  for (let y = 62; y < 98; y++) for (let x = cx - 14; x <= cx + 14; x++) if (Math.abs(x - cx) <= Math.max(0, 14 - Math.abs(y - 62) * 0.8)) pixel(p, w, x, y, white);
  for (let i = 0; i < count; i++) { const player = game.participants[i], a = -Math.PI / 2 + (i + 0.5) * step; text(p, w, h, clean(player.username, 9), cx + Math.cos(a) * r * 0.67, cy + Math.sin(a) * r * 0.67 - 6, 2, white, 'center', 100); }
  const hub = rgb('#0b0d11'); for (let y = cy - 52; y <= cy + 52; y++) for (let x = cx - 52; x <= cx + 52; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= 52 ** 2) pixel(p, w, x, y, hub); text(p, w, h, 'ROULETTE', cx, cy - 9, 2, white, 'center', 90);
  const selected = selectedIndex !== null ? game.participants[selectedIndex] : null; rect(p, w, h, 495, 485, 430, 30, selected ? rgb('#2a2512') : rgb('#20242c')); text(p, w, h, selected ? `TURN: ${clean(selected.username, 20)}` : 'WAITING FOR PLAYERS', 710, 493, 2, selected ? gold : muted, 'center', 390);
  return png(w, h, p);
}
