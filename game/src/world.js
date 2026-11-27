// The valley: a winding river, patchwork fields, one dirt road, a grass
// runway near the start, tree lines and farmhouses dressed per chunk, and a
// course of glowing rings to fly through. Everything is a pure function of
// (x, z) or of the seed, so the world is endless and identical every run.

import { mulberry32, hash2, noise1, clamp, smoothstep } from './random.js';

export const RUNWAY = { x: -140, z0: -80, z1: 430, halfWidth: 42 };

// The river's centre line, in world metres.
export function riverCenterX(z) {
  return 150 * Math.sin(z * 0.0009) + 90 * Math.sin(z * 0.00031 + 2.1);
}

export function riverHalfWidth(z) {
  return 30 + 8 * Math.sin(z * 0.0017 + 0.6);
}

// Ground height in metres. Rolling valley floor, mountains rising on both
// flanks, flattened where the runway sits.
export function terrainHeight(x, z) {
  let h =
    10 +
    8 * Math.sin(z * 0.0021 + x * 0.004) +
    6 * Math.sin(z * 0.00053 + 1.3) +
    5 * (noise1(z * 0.01 + x * 0.006) - 0.5) * 2;
  const flank = Math.abs(x - riverCenterX(z) * 0.35);
  const rise = smoothstep(250, 560, flank);
  h += rise * (95 + 45 * Math.sin(z * 0.0007 + x * 0.001));
  if (z > RUNWAY.z0 - 60 && z < RUNWAY.z1 + 60 && x > RUNWAY.x - 90 && x < RUNWAY.x + 90) {
    const flat = smoothstep(90, 30, Math.abs(x - RUNWAY.x));
    h = h * (1 - flat) + 7 * flat;
  }
  return h;
}

// Patchwork field colour for the cell that holds (x, z).
const FIELD_PALETTE = [
  '#5d8f3e', '#6da34a', '#7fae56', '#4f7d38',
  '#8aa653', '#a9a05e', '#97784a', '#63904b',
  '#749c46', '#5c8140', '#b3a06a', '#87a04e',
];
export function fieldColor(x, z) {
  const cx = Math.floor((x + 4000) / 90);
  const cz = Math.floor(z / 90);
  const r = hash2(cx, cz);
  return FIELD_PALETTE[Math.floor(r * FIELD_PALETTE.length) % FIELD_PALETTE.length];
}

// Dressing sprites for one 150 m chunk of valley: trees along the river,
// farmhouses, hay bales, the odd copse on the hills. Seeded by chunk index.
export function chunkSprites(chunkIndex) {
  const rng = mulberry32(chunkIndex * 2654435761 + 97);
  const zBase = chunkIndex * 150;
  const out = [];
  const n = 5 + Math.floor(rng() * 5);
  for (let i = 0; i < n; i++) {
    const z = zBase + rng() * 150;
    const side = rng() < 0.5 ? -1 : 1;
    const kind = rng();
    if (kind < 0.55) {
      // tree: hug the river banks or dot the fields
      const nearRiver = rng() < 0.6;
      const x = nearRiver
        ? riverCenterX(z) + side * (riverHalfWidth(z) + 12 + rng() * 40)
        : riverCenterX(z) + side * (90 + rng() * 420);
      out.push({ type: 'tree', x, z, s: 0.8 + rng() * 0.7, hue: rng() });
    } else if (kind < 0.75) {
      const x = riverCenterX(z) + side * (120 + rng() * 260);
      out.push({ type: 'house', x, z, s: 0.9 + rng() * 0.5, hue: rng() });
    } else {
      const x = riverCenterX(z) + side * (70 + rng() * 330);
      out.push({ type: 'bale', x, z, s: 0.8 + rng() * 0.5, hue: rng() });
    }
  }
  return out;
}

// Clouds live high and drift slowly; positions are a function of the seed.
export function cloudField(seed) {
  const rng = mulberry32(seed * 977 + 13);
  const out = [];
  for (let i = 0; i < 46; i++) {
    out.push({
      x: (rng() - 0.5) * 5200,
      z: rng() * 9000,
      alt: 250 + rng() * 170,
      s: 0.7 + rng() * 1.6,
      alpha: 0.35 + rng() * 0.4,
    });
  }
  return out;
}

// The ring course. Rings hang over the valley, roughly following the river,
// close enough together to keep a rhythm, wandering enough to make you steer.
export function buildRings(seed, count = 420) {
  const rng = mulberry32(seed * 131 + 7);
  const rings = [];
  let z = 520;
  for (let i = 0; i < count; i++) {
    const cx = riverCenterX(z);
    const x = cx + (rng() - 0.5) * 300;
    const ground = terrainHeight(x, z);
    const alt = clamp(ground + 42 + rng() * 78, 40, 300);
    rings.push({ x, z, alt, r: 26, index: i, state: 'pending' });
    const gap = 300 - Math.min(110, i * 0.55) + rng() * 60;
    z += gap;
  }
  return rings;
}

export function ringRadiusAt(ringsHit) {
  return Math.max(15, 26 - ringsHit * 0.35);
}
