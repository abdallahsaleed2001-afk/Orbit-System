const COLOR_KEY_PREFIX = 'colors:';

function key(guildId) {
  return `${COLOR_KEY_PREFIX}${guildId}`;
}

export function buildColors() {
  return Array.from({ length: 100 }, (_, index) => {
    const hue = Math.round((index * 360) / 100);
    const saturation = 78;
    const lightness = 52;
    const hex = hslToHex(hue, saturation, lightness);
    return { number: index + 1, hex };
  });
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((v) => Math.round(255 * v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export async function getColorConfig(client, guildId) {
  const data = await client.db.get(key(guildId), null);
  return data || null;
}

export async function saveColorConfig(client, guildId, config) {
  await client.db.set(key(guildId), config);
  return config;
}

export async function getColorByNumber(client, guildId, number) {
  const config = await getColorConfig(client, guildId);
  if (!config?.enabled || !Array.isArray(config.colors)) return null;
  return config.colors.find((color) => color.number === number) || null;
}

export function buildColorImageSvg(colors) {
  const width = 1200;
  const cellWidth = 120;
  const cellHeight = 82;
  const columns = 10;
  const rows = Math.ceil(colors.length / columns);
  const height = 130 + rows * cellHeight;

  const cells = colors.map((color, index) => {
    const x = (index % columns) * cellWidth;
    const y = 105 + Math.floor(index / columns) * cellHeight;
    const textColor = contrastText(color.hex);
    return `<rect x="${x + 2}" y="${y + 2}" width="116" height="78" rx="10" fill="${color.hex}"/><text x="${x + 60}" y="${y + 34}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${textColor}">${String(color.number).padStart(2, '0')}</text><text x="${x + 60}" y="${y + 58}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="${textColor}">${color.hex}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#111827"/><text x="600" y="48" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="#FFFFFF">Server Colors</text><text x="600" y="78" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#D1D5DB">اكتب: لون 40 لاختيار اللون رقم 40</text>${cells}</svg>`;
}

function contrastText(hex) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155 ? '#111827' : '#FFFFFF';
}

export function isColorSelection(content) {
  return /^لون\s+\d{1,3}$/u.test(String(content || '').trim());
}

export function parseColorNumber(content) {
  const match = String(content || '').trim().match(/^لون\s+(\d{1,3})$/u);
  return match ? Number(match[1]) : null;
}
