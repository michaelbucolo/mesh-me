/**
 * Draws public/cursor/meshi-shadow-24.png — the cursor floor.
 *
 * Committed as a build script rather than a binary someone has to trust,
 * because a 24×24 PNG is unreviewable in a diff and this way the geometry is
 * the thing under review. Run with `npm run cursor:build`; it is idempotent and
 * the check script verifies the committed file still matches this source.
 *
 * WHAT IT DRAWS, AND WHY
 *
 * The floor is Meshi's SHADOW, not a second Meshi. The body is a DOM sprite
 * that follows the pointer; if the floor also drew a character you would have
 * double vision by construction every time the two disagreed — over an iframe,
 * behind a modal, before hydration. A shadow briefly alone reads as "Meshi
 * stepped away", which is true, rather than as a rendering fault.
 *
 *   - A soft warm-black ellipse at (13, 15), 11px across, α ≤ 0.18. That is the
 *     contact shadow Meshi casts while standing up and to the right of where
 *     you are pointing.
 *   - An aim dot at (6, 6) — the hotspot, and the only precise thing here.
 *
 * The aim dot carries a light rim the design spec did not ask for. A bare
 * --ink-1 dot is invisible on Lamplight, and a single PNG cannot be
 * theme-aware; the rim is the same trick every OS arrow uses and it is the
 * difference between an aim point that exists in both themes and one that
 * exists in one. Nothing else deviates.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SIZE = 24;

// Straight (non-premultiplied) RGBA, one entry per channel per pixel.
const px = new Uint8Array(SIZE * SIZE * 4);

/** Paint `src` over whatever is already at (x, y), normal alpha compositing. */
function over(x, y, [r, g, b], a) {
  if (a <= 0 || x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  const dstA = px[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA <= 0) return;
  for (let c = 0; c < 3; c++) {
    const src = [r, g, b][c];
    px[i + c] = Math.round((src * a + px[i + c] * dstA * (1 - a)) / outA);
  }
  px[i + 3] = Math.round(outA * 255);
}

// Supersample so the soft edges are actually soft at this size.
const SS = 4;
function coverage(x, y, inside) {
  let hits = 0;
  for (let sy = 0; sy < SS; sy++) {
    for (let sx = 0; sx < SS; sx++) {
      if (inside(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS)) hits++;
    }
  }
  return hits / (SS * SS);
}

const WARM_BLACK = [38, 30, 20]; // --canvas-shadow family: warm, never neutral
const INK = [27, 26, 23]; // --ink-1 (Daylight)
const RIM = [246, 241, 232]; // --paper-0 family, so the dot reads on Lamplight

// ── The contact shadow: an ellipse, softest at its rim ──
// Drawn as concentric coverage bands so the falloff is smooth rather than a
// hard 11px disc with an aliased edge.
const SHADOW_CX = 13;
const SHADOW_CY = 15;
const SHADOW_RX = 5.5;
const SHADOW_RY = 3.6;
const PEAK_ALPHA = 0.18;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // Normalised radius: 0 at the centre, 1 at the rim.
    const inside = (fx, fy) => {
      const dx = (fx - SHADOW_CX) / SHADOW_RX;
      const dy = (fy - SHADOW_CY) / SHADOW_RY;
      return dx * dx + dy * dy <= 1;
    };
    const cov = coverage(x, y, inside);
    if (cov <= 0) continue;
    // Falloff by distance from centre so the middle is densest.
    const dx = (x + 0.5 - SHADOW_CX) / SHADOW_RX;
    const dy = (y + 0.5 - SHADOW_CY) / SHADOW_RY;
    const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
    const falloff = 1 - d * d; // soft, not linear
    over(x, y, WARM_BLACK, PEAK_ALPHA * cov * Math.max(0.15, falloff));
  }
}

// ── The aim dot at the hotspot ──
// Rim first, then the core on top, so the core stays crisp.
const AIM_X = 6;
const AIM_Y = 6;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const rim = coverage(x, y, (fx, fy) => Math.hypot(fx - AIM_X, fy - AIM_Y) <= 1.9);
    if (rim > 0) over(x, y, RIM, 0.92 * rim);
  }
}
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const core = coverage(x, y, (fx, fy) => Math.hypot(fx - AIM_X, fy - AIM_Y) <= 0.95);
    if (core > 0) over(x, y, INK, core);
  }
}

// ── Encode ────────────────────────────────────────────────────────────────
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type: RGBA
ihdr[10] = 0; // deflate
ihdr[11] = 0; // adaptive filtering
ihdr[12] = 0; // no interlace

// Filter type 0 (None) on every scanline — the image is tiny and this keeps the
// output byte-stable across zlib versions that pick different heuristics.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  const off = y * (SIZE * 4 + 1);
  raw[off] = 0;
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, off + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const OUT = "public/cursor/meshi-shadow-24.png";
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`wrote ${OUT} — ${SIZE}×${SIZE}, ${png.length} bytes, hotspot (${AIM_X}, ${AIM_Y})`);
