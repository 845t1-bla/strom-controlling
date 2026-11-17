// Erzeugt die App-Icons (PNG) ohne externe Abhängigkeiten: node scripts/icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(typ, daten) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(daten.length);
  const td = Buffer.concat([Buffer.from(typ), daten]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const roh = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(roh, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(roh, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BLITZ = [
  [13, 2],
  [4, 14],
  [11, 14],
  [10, 22],
  [19, 10],
  [12, 10],
];
function imPolygon(x, y, poly) {
  let drin = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}
const STOPS = [
  [0, [34, 211, 238]],
  [0.55, [139, 92, 246]],
  [1, [244, 114, 182]],
];
function verlauf(t) {
  for (let k = 1; k < STOPS.length; k++) {
    const [t1, c1] = STOPS[k];
    const [t0, c0] = STOPS[k - 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return c0.map((v, i) => v + (c1[i] - v) * f);
    }
  }
  return STOPS[STOPS.length - 1][1];
}

function icon(groesse, { radius, blitzAnteil }) {
  const buf = Buffer.alloc(groesse * groesse * 4);
  const s = (groesse * blitzAnteil) / 20; // Blitz ist ~20 Einheiten hoch
  const ox = groesse / 2 - 11.5 * s;
  const oy = groesse / 2 - 12 * s;
  const poly = BLITZ.map(([x, y]) => [ox + x * s, oy + y * s]);
  const r = radius * groesse;
  const SS = 4;
  for (let py = 0; py < groesse; py++) {
    for (let px = 0; px < groesse; px++) {
      let bg = 0;
      let bl = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          const dx = Math.max(r - x, 0, x - (groesse - r));
          const dy = Math.max(r - y, 0, y - (groesse - r));
          if (r === 0 || dx * dx + dy * dy <= r * r) {
            bg++;
            if (imPolygon(x, y, poly)) bl++;
          }
        }
      }
      const n = SS * SS;
      const [cr, cg, cb] = verlauf((px + py) / (2 * groesse));
      const a = bg / n;
      const w = bg ? bl / bg : 0;
      const i = (py * groesse + px) * 4;
      buf[i] = Math.round(cr + (255 - cr) * w);
      buf[i + 1] = Math.round(cg + (255 - cg) * w);
      buf[i + 2] = Math.round(cb + (255 - cb) * w);
      buf[i + 3] = Math.round(a * 255);
    }
  }
  return png(groesse, groesse, buf);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', icon(192, { radius: 0.22, blitzAnteil: 0.62 }));
writeFileSync('public/icon-512.png', icon(512, { radius: 0.22, blitzAnteil: 0.62 }));
writeFileSync('public/icon-512-maskable.png', icon(512, { radius: 0, blitzAnteil: 0.5 }));
writeFileSync('public/apple-touch-icon.png', icon(180, { radius: 0, blitzAnteil: 0.58 }));
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs><rect width="24" height="24" rx="5.5" fill="url(#g)"/><path d="M13 3.5 6 13h5.5l-1 7.5L18 11h-5.5z" fill="#fff"/></svg>\n`,
);
console.log('Icons erzeugt.');
