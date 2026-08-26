const FONT = {
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
  '-':['00000','00000','00000','11111','00000','00000','00000'],'.':['00000','00000','00000','00000','00000','00110','00110'],'@':['01110','10001','10111','10101','10111','10000','01110'],'?':['01110','10001','00001','00010','00100','00000','00100'],' ':['00000','00000','00000','00000','00000','00000','00000']
};

const COLORS = ['#101217','#191d25','#f5f7fb','#9aa4b2','#5865f2','#57f287','#ed4245','#f0b90b','#9b59b6','#e67e22','#3498db','#1abc9c','#0b0d11','#2a2512','#20242c','#ffffff'];
const rgb = hex => { const n = Number.parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const PALETTE = COLORS.map(rgb);
export const cleanName = (value, max = 18) => { const s = String(value ?? '').normalize('NFKD').replace(/[^A-Za-z0-9_@.\- ]/g, '?').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };
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

export function drawRouletteFrame(game, selectedIndex = null, rotation = 0) {
  const w = 700, h = 420, p = Buffer.alloc(w * h * 3), bg = PALETTE[0], panel = PALETTE[1], white = PALETTE[2], muted = PALETTE[3], blue = PALETTE[4], gold = PALETTE[7];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pixel(p, w, x, y, bg);
  rect(p, w, h, 16, 16, 668, 388, panel); rect(p, w, h, 16, 16, 5, 388, blue);
  text(p, w, h, 'ORBIT SYSTEM', 38, 34, 3, white); text(p, w, h, `ROULETTE ROUND ${game.round}`, 38, 58, 1, muted); text(p, w, h, 'PLAYERS', 38, 92, 2, white);
  const shown = game.participants.slice(0, 10);
  shown.forEach((player, i) => { const col = i >= 5 ? 1 : 0, row = i % 5, x = 38 + col * 170, y = 120 + row * 38, active = selectedIndex !== null && game.participants[selectedIndex]?.id === player.id; rect(p, w, h, x, y, 18, 18, active ? gold : blue); text(p, w, h, i + 1, x + 9, y + 4, 1, white, 'center'); text(p, w, h, cleanName(player.username, 13), x + 27, y + 1, 1, active ? gold : white, 'left', 140); });
  if (game.participants.length > shown.length) text(p, w, h, `+${game.participants.length - shown.length} MORE`, 38, 318, 1, muted);
  const cx = 500, cy = 215, r = 160, count = Math.max(2, game.participants.length), step = Math.PI * 2 / count, colors = [4, 5, 6, 7, 8, 9, 10, 11];
  for (let i = 0; i < count; i++) { const a = -Math.PI / 2 + rotation + i * step; sector(p, w, h, cx, cy, r, a, a + step, PALETTE[colors[i % colors.length]]); }
  for (let a = 0; a < Math.PI * 2; a += 0.003) pixel(p, w, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), white);
  for (let i = 0; i < count; i++) { const player = game.participants[i], a = -Math.PI / 2 + rotation + (i + 0.5) * step; text(p, w, h, cleanName(player.username, 7), cx + Math.cos(a) * r * 0.68, cy + Math.sin(a) * r * 0.68 - 4, 1, white, 'center', 72); }
  const hub = PALETTE[12]; for (let y = cy - 40; y <= cy + 40; y++) for (let x = cx - 40; x <= cx + 40; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= 40 ** 2) pixel(p, w, x, y, hub); text(p, w, h, 'ORBIT', cx, cy - 5, 1, white, 'center');
  for (let y = 30; y < 52; y++) { const half = Math.max(1, Math.floor((y - 30) / 4)); for (let x = cx - half; x <= cx + half; x++) pixel(p, w, x, y, white); }
  const selected = selectedIndex !== null ? game.participants[selectedIndex] : null;
  rect(p, w, h, 330, 350, 330, 24, selected ? PALETTE[13] : PALETTE[14]);
  text(p, w, h, selected ? `TURN: ${cleanName(selected.username, 18)}` : 'WAITING FOR PLAYERS', 495, 357, 1, selected ? gold : muted, 'center', 300);
  return p;
}
