'use strict';
/**
 * Generates 16x16, 48x48, 128x128 PNG icons for Xero Power.
 * Zero npm dependencies — uses only Node built-ins (zlib, fs).
 *
 * Usage: node scripts/create-icons.js
 * Output: icons/icon16.png, icons/icon48.png, icons/icon128.png
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 ──────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf    = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(data.length);
  const crcInput  = Buffer.concat([typeBytes, data]);
  const crcBuf    = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

// ── Pixel drawing (RGBA) ────────────────────────────────────────────
// Brand colour: #0a7a4b = (10, 122, 75)
// "XP" letters are drawn as white pixels using a 5×7 bitmap font

const GLYPHS = {
  X: [
    [1,0,0,0,1],
    [1,0,0,0,1],
    [0,1,0,1,0],
    [0,0,1,0,0],
    [0,1,0,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
  ],
  P: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
    [1,0,0,0,0],
  ],
};

/**
 * Draw icon pixels.
 * Returns a Uint8Array of RGBA bytes (size × size × 4).
 */
function drawIcon(size) {
  const BG   = [10, 122, 75, 255];   // #0a7a4b
  const TXT  = [255, 255, 255, 255]; // white
  const data = new Uint8Array(size * size * 4);

  // Corner radius: ~18% of size
  const radius = size * 0.18;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Rounded-corner mask (transparent outside)
      const cx = Math.min(x, size - 1 - x);
      const cy = Math.min(y, size - 1 - y);
      const inCorner = cx < radius && cy < radius;
      const alpha = inCorner
        ? (Math.hypot(cx - radius, cy - radius) > radius ? 0 : 255)
        : 255;

      const off = (y * size + x) * 4;
      data[off]     = BG[0];
      data[off + 1] = BG[1];
      data[off + 2] = BG[2];
      data[off + 3] = alpha;
    }
  }

  // Only draw "XP" text for 48+ px icons (too small for 16)
  if (size >= 48) {
    const glyphW  = 5;
    const glyphH  = 7;
    const scale   = Math.floor(size / 18);   // 48→2, 128→7
    const gap     = Math.max(1, scale);
    const totalW  = 2 * glyphW * scale + gap * scale;
    const startX  = Math.round((size - totalW) / 2);
    const startY  = Math.round((size - glyphH * scale) / 2);

    [['X', 0], ['P', glyphW * scale + gap * scale]].forEach(([ch, offX]) => {
      GLYPHS[ch].forEach((row, gy) => {
        row.forEach((on, gx) => {
          if (!on) return;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = startX + offX + gx * scale + sx;
              const py = startY + gy * scale + sy;
              if (px < 0 || py < 0 || px >= size || py >= size) return;
              const i = (py * size + px) * 4;
              data[i]     = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
              data[i + 3] = data[i + 3]; // preserve alpha mask
            }
          }
        });
      });
    });
  }

  return data;
}

// ── PNG encoder ─────────────────────────────────────────────────────
function makePNG(size) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, 8-bit, RGBA (color type 6)
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 6;  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const pixels = drawIcon(size);
  // Build raw scanlines: 1 filter byte + 4 bytes/pixel per row
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      row[1 + x * 4]     = pixels[src];
      row[1 + x * 4 + 1] = pixels[src + 1];
      row[1 + x * 4 + 2] = pixels[src + 2];
      row[1 + x * 4 + 3] = pixels[src + 3];
    }
    rows.push(row);
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9 });

  return Buffer.concat([
    PNG_SIG,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Main ─────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const png  = makePNG(size);
  const file = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✅ icons/icon${size}.png  (${png.length} bytes)`);
}
console.log('\nIcons created. Add them to manifest.json under "icons".');
