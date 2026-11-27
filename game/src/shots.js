// Screenshot mode: ?shot=<name>&seed=<n> freezes the game in a composed,
// deterministic state so the entry's screenshots are real renders of this
// exact code (the kit's shots.json lists the names). No loop, no input —
// main.js renders a few frames and raises window.__shotReady.

export function applyShot(state, name) {
  const rings = state.rings;
  if (name === 'start') {
    state.mode = 'title';
    state.cam.z = 40;
    state.cam.x = -30;
    state.cam.alt = 54;
    state.cam.heading = 352;
    state.bankVis = -0.07;
    state.throttle = 0.55;
    state.speed = 46;
    rings[0].z = 330; // bring the first ring into the title view
    rings[0].x = 30;
    rings[0].alt = 88;
  } else if (name === 'play') {
    const r = rings[2];
    state.mode = 'play';
    state.cam.z = r.z - 165;
    state.cam.x = r.x - 20;
    state.cam.alt = r.alt + 5;
    state.cam.heading = 9;
    state.bankVis = -0.38;
    state.pitchVis = 0.06;
    state.throttle = 0.72;
    state.speed = 58;
    state.score = 300;
    state.ringsHit = 3;
    state.combo = 3;
    state.nextRing = 2;
    rings[0].state = 'hit';
    rings[1].state = 'hit';
  } else if (name === 'river') {
    const r = rings[5];
    state.mode = 'play';
    state.cam.z = r.z - 74;
    state.cam.x = r.x + 12;
    state.cam.alt = r.alt - 2;
    state.cam.heading = 24;
    state.bankVis = 0.3;
    state.pitchVis = -0.05;
    state.throttle = 0.92;
    state.speed = 76;
    state.score = 1250;
    state.ringsHit = 8;
    state.combo = 6;
    state.nextRing = 5;
    for (let i = 0; i < 5; i++) rings[i].state = i === 3 ? 'missed' : 'hit';
  } else if (name === 'end') {
    state.mode = 'over';
    state.cam.z = 2460;
    state.cam.x = 130;
    state.cam.alt = 24;
    state.cam.heading = 41;
    state.bankVis = 0.44;
    state.throttle = 0.1;
    state.speed = 22;
    state.score = 1450;
    state.ringsHit = 9;
    state.combo = 0;
    state.distance = 2460;
    state.best = 1450;
  }
}
