// Renders the Tone Radar app icons as PNGs (no dependencies).
// Usage: node scripts/make-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BG = [17, 19, 38];
const RING = [99, 102, 241];
const SWEEP = [129, 140, 248];
const HOT = [239, 91, 70];
const WARM = [250, 178, 25];
const COOL = [12, 163, 12];

function render(size, { maskable = false } = {}) {
  const ss = 4;
  const W = size * ss;
  const px = new Float32Array(W * W * 4);
  const pad = maskable ? 0 : 0.06;
  const radius = maskable ? 0 : 0.22;
  const scale = maskable ? 0.62 : 0.78;
  const c = W / 2;
  const R = (W / 2) * scale;
  const blips = [
    { a: -0.9, r: 0.62, col: HOT, s: 0.085 },
    { a: 2.2, r: 0.42, col: WARM, s: 0.07 },
    { a: 3.9, r: 0.78, col: COOL, s: 0.06 },
  ];
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const u = x / W, v = y / W;
      // Rounded-square background.
      const inset = pad, rr = radius;
      const qx = Math.max(Math.abs(u - 0.5) - (0.5 - inset - rr), 0);
      const qy = Math.max(Math.abs(v - 0.5) - (0.5 - inset - rr), 0);
      const inside = maskable || Math.hypot(qx, qy) <= rr;
      if (!inside) continue;
      let col = [...BG];
      const dx = x - c, dy = y - c;
      const d = Math.hypot(dx, dy) / R;
      const ang = Math.atan2(dy, dx);
      // Sweep wedge fading behind the leading edge.
      const lead = -0.55;
      let delta = lead - ang;
      while (delta < 0) delta += Math.PI * 2;
      if (d <= 1 && delta < 1.6) col = mix(col, SWEEP, 0.55 * (1 - delta / 1.6));
      // Rings and spokes.
      for (const ring of [0.34, 0.67, 1]) {
        const w = ring === 1 ? 0.045 : 0.025;
        if (Math.abs(d - ring) < w) col = mix(col, RING, ring === 1 ? 0.95 : 0.6);
      }
      if (d <= 1) {
        for (const a of [0, Math.PI / 2]) {
          const dist = Math.abs(dx * Math.sin(a) - dy * Math.cos(a)) / R;
          if (dist < 0.018) col = mix(col, RING, 0.35);
        }
      }
      // Leading edge line.
      if (d <= 1 && delta < 0.035) col = mix(col, [224, 231, 255], 0.9);
      for (const b of blips) {
        const bx = c + Math.cos(b.a) * b.r * R, by = c + Math.sin(b.a) * b.r * R;
        const bd = Math.hypot(x - bx, y - by) / R;
        if (bd < b.s) col = b.col;
        else if (bd < b.s * 1.9) col = mix(col, b.col, 0.25 * (1 - (bd - b.s) / (b.s * 0.9)));
      }
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
    }
  }
  // Downsample.
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const i = ((y * ss + sy) * W + (x * ss + sx)) * 4;
      const al = px[i + 3] / 255;
      r += px[i] * al; g += px[i + 1] * al; b += px[i + 2] * al; a += al;
    }
    const o = (y * size + x) * 4;
    const n = ss * ss;
    out[o] = a ? r / a : 0; out[o + 1] = a ? g / a : 0; out[o + 2] = a ? b / a : 0; out[o + 3] = (a / n) * 255;
  }
  return png(size, out);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const outDir = path.join(__dirname, "..", "public");
const targets = [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
  ["logo192.png", 192],
  ["logo512.png", 512],
];
for (const [name, size] of targets) fs.writeFileSync(path.join(outDir, name), render(size));
fs.writeFileSync(path.join(outDir, "maskable512.png"), render(512, { maskable: true }));
console.log("Icons written to public/");
