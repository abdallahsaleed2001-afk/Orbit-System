import { PALETTE, drawRouletteFrame } from './rouletteGifRenderer.js';

function writeU16(out, value) { out.push(value & 255, (value >> 8) & 255); }
function encodeGifFrame(indices, minCodeSize = 4) {
  const clear = 1 << minCodeSize, end = clear + 1, codeSize = minCodeSize + 1;
  let bitBuffer = 0, bitCount = 0; const data = [];
  const emit = code => { bitBuffer |= code << bitCount; bitCount += codeSize; while (bitCount >= 8) { data.push(bitBuffer & 255); bitBuffer >>>= 8; bitCount -= 8; } };
  emit(clear); for (const index of indices) { emit(index); emit(clear); } emit(end);
  if (bitCount > 0) data.push(bitBuffer & 255);
  const out = [minCodeSize]; for (let i = 0; i < data.length; i += 255) { const chunk = data.slice(i, i + 255); out.push(chunk.length, ...chunk); } out.push(0); return out;
}

const paletteMap = new Map(PALETTE.map((color, index) => [color[0] << 16 | color[1] << 8 | color[2], index]));
const paletteIndex = (pixels, offset) => paletteMap.get((pixels[offset] << 16) | (pixels[offset + 1] << 8) | pixels[offset + 2]) ?? 0;

export function createRouletteGif(game, selectedIndex) {
  const frames = 24, width = 700, height = 420;
  const out = [71, 73, 70, 56, 57, 97];
  writeU16(out, width); writeU16(out, height); out.push(0xF3, 0x00, 0x00);
  for (const color of PALETTE) out.push(...color);
  out.push(0x21, 0xFF, 0x0B, ...Buffer.from('NETSCAPE2.0', 'ascii'), 0x03, 0x01, 0x00, 0x00, 0x00);

  const count = Math.max(2, game.participants.length), step = Math.PI * 2 / count;
  const target = -((selectedIndex + 0.5) * step);
  const start = target + Math.random() * Math.PI * 2 + Math.PI * 2 * 6;

  for (let frame = 0; frame < frames; frame++) {
    const t = frame / (frames - 1);
    const eased = 1 - Math.pow(1 - t, 5);
    const rotation = start + (target - start) * eased;
    const pixels = drawRouletteFrame(game, selectedIndex, rotation);
    const indices = new Uint8Array(width * height);
    for (let i = 0, offset = 0; i < indices.length; i++, offset += 3) indices[i] = paletteIndex(pixels, offset);
    const delay = frame === frames - 1 ? 120 : Math.max(4, Math.round(5 + 7 * t));
    out.push(0x21, 0xF9, 0x04, 0x00, delay & 255, (delay >> 8) & 255, 0x00, 0x00, 0x2C);
    writeU16(out, 0); writeU16(out, 0); writeU16(out, width); writeU16(out, height); out.push(0x00);
    const frameData = encodeGifFrame(indices, 4);
    for (let i = 0; i < frameData.length; i += 8192) {
      out.push(...frameData.slice(i, i + 8192));
    }
  }
  out.push(0x3B); return Buffer.from(out);
}
