// Valley Rings: a chase-view flight game. Fly a little prop plane down a
// river valley, thread the glowing rings to score, chain them for combos,
// and don't meet a hillside. One seeded world, no network, no assets —
// every pixel is drawn and every sound is synthesised at run time.

import { Renderer, VIEW_W, VIEW_H } from './render.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { buildRings, cloudField, terrainHeight, ringRadiusAt } from './world.js';
import { clamp, lerp } from './random.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) >>> 0;
const shotName = params.get('shot');

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
const renderer = new Renderer(ctx);
const input = new Input(canvas);
const sound = new SoundEngine();

function freshState() {
  return {
    mode: 'title', // title | play | over
    paused: false,
    time: 0,
    cam: { x: -30, z: 40, alt: 54, heading: 352, headingRad: (352 * Math.PI) / 180, horizonY: 400 },
    bankVis: 0,
    pitchVis: 0,
    throttle: 0.55,
    speed: 46,
    climbRate: 0,
    score: 0,
    combo: 0,
    ringsHit: 0,
    nextRing: 0,
    distance: 0,
    best: loadBest(),
    rings: buildRings(seed),
    clouds: cloudField(seed),
    flashText: '',
    flashColor: '#ffb63e',
    flashUntil: 0,
  };
}

function loadBest() {
  try {
    return Number(localStorage.getItem('valley-rings-best') || 0) || 0;
  } catch {
    return 0;
  }
}
function saveBest(v) {
  try {
    localStorage.setItem('valley-rings-best', String(v));
  } catch {
    /* private mode: best score just won't persist */
  }
}

let state = freshState();
window.__game = () => state; // debug hook for automated play-tests

function startRun() {
  const best = state.best;
  state = freshState();
  state.best = best;
  state.mode = 'play';
  state.cam.z = -30;
  state.cam.x = -120;
  state.cam.alt = 22;
  state.cam.heading = 0;
  state.throttle = 0.62;
  state.speed = 40;
}

function crash() {
  state.mode = 'over';
  state.distance = Math.max(0, Math.round(state.cam.z));
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
  }
  sound.crash();
}

function step(dt) {
  state.time += dt;
  const cam = state.cam;

  if (input.consumeMute()) sound.toggleMute();
  if (state.mode !== 'play') {
    if (input.consumeStart()) {
      sound.ensure();
      startRun();
    }
    // Title / game-over backdrop: a slow scenic drift forward.
    if (state.mode === 'title') {
      cam.z += 9 * dt;
      cam.x = lerp(cam.x, -30 + Math.sin(state.time * 0.11) * 26, dt * 0.5);
      cam.alt = 54 + Math.sin(state.time * 0.4) * 3;
    }
    sound.update(state.throttle, state.speed * 1.944, false);
    return;
  }
  if (input.consumePause()) state.paused = !state.paused;
  if (state.paused) return;

  sound.ensure();
  const steer = input.steer();
  state.bankVis = lerp(state.bankVis, steer.bank, 1 - Math.pow(0.0015, dt));
  state.pitchVis = lerp(state.pitchVis, steer.pitch, 1 - Math.pow(0.002, dt));
  state.throttle = clamp(state.throttle + input.throttleDelta(dt), 0, 1);

  // Flight model: bank turns and slides the plane sideways, pitch trades
  // against the throttle for climb, speed lags behind the throttle.
  const minThrottleSpeed = 26 + Math.min(14, state.ringsHit * 0.4);
  const targetSpeed = minThrottleSpeed + state.throttle * 62;
  state.speed = lerp(state.speed, targetSpeed, 1 - Math.pow(0.12, dt));
  cam.heading += state.bankVis * 30 * dt;
  cam.headingRad = (cam.heading * Math.PI) / 180;
  const prevZ = cam.z;
  cam.z += state.speed * dt;
  cam.x += Math.sin(state.bankVis * 0.9) * state.speed * 0.55 * dt;
  cam.x += Math.sin(cam.headingRad) * state.speed * dt * 0.12;
  cam.x = clamp(cam.x, -880, 880);
  state.climbRate = state.pitchVis * 11.5 + (state.throttle - 0.42) * 4.0;
  cam.alt = clamp(cam.alt + state.climbRate * dt, 0, 430);
  state.distance = Math.max(0, cam.z);

  // Rings: crossing a ring's plane settles it.
  const ring = state.rings[state.nextRing];
  if (ring && prevZ < ring.z && cam.z >= ring.z) {
    const dx = cam.x - ring.x;
    const dy = cam.alt - ring.alt;
    const r = ringRadiusAt(state.ringsHit);
    if (dx * dx + dy * dy <= r * r) {
      ring.state = 'hit';
      state.ringsHit += 1;
      state.combo += 1;
      const pts = 100 + 25 * (Math.min(state.combo, 8) - 1);
      state.score += pts;
      state.flashText = `+${pts}`;
      state.flashColor = '#ffb63e';
      state.flashUntil = state.time + 0.8;
      sound.ringChime(state.combo);
    } else {
      ring.state = 'missed';
      if (state.combo >= 3) {
        state.flashText = 'COMBO LOST';
        state.flashColor = '#ff8a75';
        state.flashUntil = state.time + 0.8;
      }
      state.combo = 0;
      sound.missThud();
    }
    state.nextRing += 1;
  }

  // Terrain is the only enemy.
  const ground = terrainHeight(cam.x, cam.z);
  if (cam.alt <= ground + 2.5) {
    cam.alt = ground + 2.5;
    crash();
    return;
  }
  sound.update(state.throttle, state.speed * 1.944, true);
}

if (shotName) {
  // Frozen composed frame for the entry screenshots.
  applyShot(state, shotName);
  state.cam.headingRad = (state.cam.heading * Math.PI) / 180;
  state.time = 2.9; // a blink phase where the "press enter" lines are lit
  for (let i = 0; i < 3; i++) renderer.draw(state);
  window.__shotReady = true;
} else {
  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0.001, 0.05);
    last = now;
    step(dt);
    renderer.draw(state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
