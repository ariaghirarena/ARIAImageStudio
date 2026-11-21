// Deterministic, dependency-free icon generator for ARIA Image Studio.
// Renders the brand mark (dark rounded tile, aperture ring, "A" monogram)
// and writes PNG sizes plus a PNG-compressed .ico for Windows bundling.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "apps", "desktop", "src-tauri", "icons");
mkdirSync(outDir, { recursive: true });

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function pointInRoundedRect(x, y, w, h, r) {
  const px = x * w;
  const py = y * h;
  const dx = Math.max(r - px, 0, px - (w - r));
  const dy = Math.max(r - py, 0, py - (h - r));
  return Math.hypot(dx, dy) <= r;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

function render(size) {
  const ss = 3;
  const w = size * ss;
  const rgba = Buffer.alloc(size * size * 4);
  const ringInner = 0.305;
  const ringOuter = 0.365;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const u = (x + (sx + 0.5) / ss) / size;
          const v = (y + (sy + 0.5) / ss) / size;
          let cr = 0;
          let cg = 0;
          let cb = 0;
          let ca = 0;
          if (pointInRoundedRect(u, v, 1, 1, 0.225)) {
            const t = clamp(v * 0.85 + u * 0.15);
            cr = mix(0.043, 0.086, t);
            cg = mix(0.059, 0.106, t);
            cb = mix(0.078, 0.127, t);
            // subtle vignette
            const vig = 1 - 0.35 * clamp(Math.hypot(u - 0.5, v - 0.5) * 1.4);
            cr *= vig; cg *= vig; cb *= vig;
            ca = 1;

            const dx = u - 0.5;
            const dy = v - 0.45;
            const dist = Math.hypot(dx, dy * 1.02);
            const ang = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
            const ring = smooth(ringInner, ringInner + 0.012, dist) * (1 - smooth(ringOuter - 0.012, ringOuter, dist));
            if (ring > 0.001) {
              const rr = mix(0.36, 0.72, 0.5 + 0.5 * Math.sin(ang * Math.PI * 2));
              const gg = mix(0.85, 0.42, 0.5 + 0.5 * Math.sin(ang * Math.PI * 2 + 1.2));
              const bb = 0.98;
              cr = mix(cr, rr, ring * 0.95);
              cg = mix(cg, gg, ring * 0.95);
              cb = mix(cb, bb, ring * 0.95);
            }

            // "A" monogram
            const left = distanceToSegment(u, v, 0.5, 0.315, 0.365, 0.685);
            const right = distanceToSegment(u, v, 0.5, 0.315, 0.635, 0.685);
            const cross = distanceToSegment(u, v, 0.428, 0.575, 0.572, 0.575);
            const stroke = 0.030;
            const ink = Math.max(
              smooth(stroke + 0.008, stroke - 0.008, left),
              smooth(stroke + 0.008, stroke - 0.008, right),
              smooth(stroke * 0.62 + 0.008, stroke * 0.62 - 0.008, cross),
            );
            if (ink > 0.001) {
              cr = mix(cr, 0.97, ink);
              cg = mix(cg, 0.98, ink);
              cb = mix(cb, 1.0, ink);
            }

            // spark
            const sparkDist = Math.hypot(u - 0.685, v - 0.315);
            const spark = 1 - smooth(0.0, 0.022, sparkDist);
            if (spark > 0.001) {
              cr = mix(cr, 0.42, spark);
              cg = mix(cg, 0.83, spark);
              cb = mix(cb, 1.0, spark);
            }
          }
          r += cr; g += cg; b += cb; a += ca;
        }
      }
      const n = ss * ss;
      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(clamp(r / n) * 255);
      rgba[idx + 1] = Math.round(clamp(g / n) * 255);
      rgba[idx + 2] = Math.round(clamp(b / n) * 255);
      rgba[idx + 3] = Math.round(clamp(a / n) * 255);
    }
  }
  return encodePng(size, size, rgba);
}

const targets = [
  ["32x32.png", 32],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
  ["icon.png", 512],
  ["Square150x150Logo.png", 150],
  ["Square44x44Logo.png", 44],
  ["StoreLogo.png", 50],
];

const pngs = new Map();
for (const [name, size] of targets) {
  const buf = render(size);
  writeFileSync(join(outDir, name), buf);
  pngs.set(size, buf);
}

// ICO with PNG-compressed entries (supported by Windows Vista+).
const icoSizes = [16, 32, 48, 64, 128, 256];
for (const size of icoSizes) {
  if (!pngs.has(size)) pngs.set(size, render(size));
}
const entries = [];
let offset = 6 + icoSizes.length * 16;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
for (const size of icoSizes) {
  const data = pngs.get(size);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(data.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += data.length;
  entries.push(entry);
}
const ico = Buffer.concat([header, ...entries, ...icoSizes.map((s) => pngs.get(s))]);
writeFileSync(join(outDir, "icon.ico"), ico);
console.log(`icons written to ${outDir} (${targets.length} png + icon.ico)`);
