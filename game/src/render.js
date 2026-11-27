// Everything drawn on the canvas: sky and ridges, the low-poly valley with
// its river, road and runway, dressing sprites, the ring course, the plane
// in chase view, and the instrument HUD. Projection is a simple pinhole:
// screen = centre + (world - camera) * FOCAL / distance.

import {
  riverCenterX, riverHalfWidth, terrainHeight, fieldColor,
  chunkSprites, RUNWAY,
} from './world.js';
import { noise1, clamp, lerp } from './random.js';

export const VIEW_W = 1440;
export const VIEW_H = 900;
const FOCAL = 640;

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.spriteCache = new Map();
  }

  project(cam, wx, wz, walt) {
    const d = Math.max(6, wz - cam.z);
    const drift = Math.sin(cam.headingRad) * d * 0.22;
    const x = VIEW_W / 2 + (wx - cam.x - drift) * (FOCAL / d);
    const y = cam.horizonY + (cam.alt - walt) * (FOCAL / d);
    return { x, y, d, scale: FOCAL / d };
  }

  draw(state) {
    const { ctx } = this;
    const cam = state.cam;
    cam.horizonY =
      VIEW_H * 0.44 -
      clamp(cam.alt - 60, 0, 320) * 0.11 +
      state.pitchVis * 64;
    this.drawSky(state);
    this.drawTerrain(state);
    this.drawSprites(state);
    this.drawRings(state);
    this.drawPlane(state);
    this.drawHUD(state);
    if (state.mode === 'title') this.drawTitle(state);
    if (state.mode === 'over') this.drawGameOver(state);
    if (state.paused) this.drawPaused(state);
  }

  drawSky(state) {
    const { ctx } = this;
    const cam = state.cam;
    const horizon = cam.horizonY;
    const grad = ctx.createLinearGradient(0, 0, 0, horizon + 4);
    grad.addColorStop(0, '#2d5a8f');
    grad.addColorStop(0.55, '#6fa3cf');
    grad.addColorStop(1, '#cfe4f2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, horizon + 4);

    // Sun, placed by heading so turning moves it across the sky.
    const sunX = VIEW_W / 2 - Math.sin(state.cam.headingRad) * VIEW_W * 0.9 + 340;
    const sunY = horizon - 190;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    glow.addColorStop(0, 'rgba(255,244,200,0.95)');
    glow.addColorStop(0.25, 'rgba(255,236,170,0.55)');
    glow.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Two mountain ridges on the horizon, parallax with distance flown.
    this.ridge(state, 0.012, horizon, 64, '#7d94b5', 3.1);
    this.ridge(state, 0.03, horizon, 40, '#5f7ea3', 7.7);

    // Clouds.
    for (const c of state.clouds) {
      let cz = c.z - (state.cam.z % 9000);
      if (cz < -600) cz += 9000;
      if (cz < 40 || cz > 5200) continue;
      const p = this.project(state.cam, c.x + state.cam.x * 0.55, state.cam.z + cz, c.alt);
      if (p.x < -320 || p.x > VIEW_W + 320) continue;
      this.cloudPuff(p.x, p.y, 120 * p.scale * c.s, c.alpha);
    }
  }

  ridge(state, par, horizon, amp, color, seedOff) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 2);
    for (let x = 0; x <= VIEW_W; x += 36) {
      const w = (x / VIEW_W) * 9 + state.cam.z * 0.00004 * par * 60 + state.cam.heading * 0.02 + seedOff;
      const y = horizon - 8 - noise1(w) * amp - noise1(w * 3.7) * amp * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_W, horizon + 2);
    ctx.closePath();
    ctx.fill();
  }

  cloudPuff(x, y, r, alpha) {
    const { ctx } = this;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    for (const [dx, dy, rr] of [[0, 0, 1], [-0.8, 0.12, 0.62], [0.85, 0.1, 0.66], [-0.3, -0.22, 0.55], [0.4, -0.18, 0.6]]) {
      ctx.beginPath();
      ctx.ellipse(x + dx * r, y + dy * r * 0.5, r * rr, r * rr * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTerrain(state) {
    const { ctx } = this;
    const cam = state.cam;
    const STRIPS = 44;
    const COLS = [-950, -580, -370, -230, -130, -55, 0, 55, 130, 230, 370, 580, 950];
    const dNear = 7;
    const dFar = 2500;
    const rows = [];
    for (let i = 0; i <= STRIPS; i++) {
      const t = i / STRIPS;
      const d = dNear * Math.pow(dFar / dNear, t);
      const wz = cam.z + d;
      const row = [];
      for (const off of COLS) {
        const wx = cam.x + off;
        row.push(this.project(cam, wx, wz, terrainHeight(wx, wz)));
      }
      rows.push({ d, wz, pts: row });
    }
    // Ground base under everything (valley floor tone).
    ctx.fillStyle = '#557f3a';
    ctx.fillRect(0, cam.horizonY, VIEW_W, VIEW_H - cam.horizonY);
    // Field quads, far to near.
    for (let i = 0; i < STRIPS; i++) {
      const a = rows[i];
      const b = rows[i + 1];
      for (let c = 0; c < COLS.length - 1; c++) {
        const wxMid = cam.x + (COLS[c] + COLS[c + 1]) / 2;
        ctx.fillStyle = fieldColor(wxMid, a.wz);
        ctx.beginPath();
        ctx.moveTo(a.pts[c].x, a.pts[c].y);
        ctx.lineTo(a.pts[c + 1].x, a.pts[c + 1].y);
        ctx.lineTo(b.pts[c + 1].x, b.pts[c + 1].y);
        ctx.lineTo(b.pts[c].x, b.pts[c].y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // River ribbon.
    this.ribbon(state, rows, (z) => riverCenterX(z), (z) => riverHalfWidth(z), '#3f7fbf', '#57a0d8');
    // Dirt road shadowing the river on its east bank.
    this.ribbon(state, rows, (z) => riverCenterX(z) + 78, () => 6, '#8a7355', '#8a7355');
    // Runway: a grey strip with white dashes near the start.
    this.drawRunway(state, rows);
  }

  ribbon(state, rows, centerFn, halfFn, colorA, colorB) {
    const { ctx } = this;
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i];
      const b = rows[i + 1];
      const seg = (row, flip) => {
        const c = centerFn(row.wz);
        const h = halfFn(row.wz);
        const l = this.project(state.cam, c - h, row.wz, terrainHeight(c - h, row.wz) + 0.4);
        const r = this.project(state.cam, c + h, row.wz, terrainHeight(c + h, row.wz) + 0.4);
        return flip ? [r, l] : [l, r];
      };
      const [al, ar] = seg(a, false);
      const [bl, br] = seg(b, false);
      const grad = ctx.createLinearGradient(al.x, al.y, bl.x, bl.y);
      grad.addColorStop(0, colorB);
      grad.addColorStop(1, colorA);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(al.x, al.y);
      ctx.lineTo(ar.x, ar.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawRunway(state, rows) {
    const { ctx } = this;
    const cam = state.cam;
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i];
      const b = rows[i + 1];
      if (b.wz < RUNWAY.z0 || a.wz > RUNWAY.z1) continue;
      const seg = (row) => {
        const l = this.project(cam, RUNWAY.x - RUNWAY.halfWidth, row.wz, terrainHeight(RUNWAY.x - RUNWAY.halfWidth, row.wz) + 0.5);
        const r = this.project(cam, RUNWAY.x + RUNWAY.halfWidth, row.wz, terrainHeight(RUNWAY.x + RUNWAY.halfWidth, row.wz) + 0.5);
        return [l, r];
      };
      const [al, ar] = seg(a);
      const [bl, br] = seg(b);
      ctx.fillStyle = '#6d6d66';
      ctx.beginPath();
      ctx.moveTo(al.x, al.y);
      ctx.lineTo(ar.x, ar.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.fill();
      // Centreline dashes every 36 m.
      if (Math.floor(a.wz / 36) % 2 === 0) {
        const cA = this.project(cam, RUNWAY.x, a.wz, terrainHeight(RUNWAY.x, a.wz) + 0.6);
        const cB = this.project(cam, RUNWAY.x, b.wz, terrainHeight(RUNWAY.x, b.wz) + 0.6);
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = Math.max(1, 3 * cA.scale * 0.14);
        ctx.beginPath();
        ctx.moveTo(cA.x, cA.y);
        ctx.lineTo(cB.x, cB.y);
        ctx.stroke();
      }
    }
  }

  drawSprites(state) {
    const cam = state.cam;
    const firstChunk = Math.floor((cam.z - 40) / 150);
    const lastChunk = Math.floor((cam.z + 2400) / 150);
    const items = [];
    for (let ci = firstChunk; ci <= lastChunk; ci++) {
      const key = ci;
      if (!this.spriteCache.has(key)) this.spriteCache.set(key, chunkSprites(ci));
      for (const s of this.spriteCache.get(key)) {
        const d = s.z - cam.z;
        if (d < 24 || d > 2400) continue;
        if (Math.abs(s.x - cam.x) > 900) continue;
        items.push({ s, d });
      }
    }
    if (this.spriteCache.size > 60) {
      for (const k of this.spriteCache.keys()) {
        if (k < firstChunk - 2) this.spriteCache.delete(k);
      }
    }
    items.sort((a, b) => b.d - a.d);
    for (const { s } of items) {
      const ground = terrainHeight(s.x, s.z);
      const p = this.project(cam, s.x, s.z, ground);
      if (p.x < -80 || p.x > VIEW_W + 80 || p.y < cam.horizonY - 30) continue;
      if (s.type === 'tree') this.drawTree(p, s);
      else if (s.type === 'house') this.drawHouse(p, s);
      else this.drawBale(p, s);
    }
  }

  drawTree(p, s) {
    const { ctx } = this;
    const h = Math.min(300, 26 * p.scale * s.s);
    if (h < 2) return;
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(p.x - h * 0.05, p.y - h * 0.3, h * 0.1, h * 0.3);
    ctx.fillStyle = s.hue > 0.5 ? '#2f6b2f' : '#3a7d3a';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - h);
    ctx.lineTo(p.x - h * 0.42, p.y - h * 0.25);
    ctx.lineTo(p.x + h * 0.42, p.y - h * 0.25);
    ctx.closePath();
    ctx.fill();
  }

  drawHouse(p, s) {
    const { ctx } = this;
    const w = Math.min(280, 30 * p.scale * s.s);
    const h = Math.min(160, 17 * p.scale * s.s);
    if (w < 3) return;
    ctx.fillStyle = s.hue > 0.5 ? '#e8e0cc' : '#d9cfc0';
    ctx.fillRect(p.x - w / 2, p.y - h, w, h);
    ctx.fillStyle = '#9c4a38';
    ctx.beginPath();
    ctx.moveTo(p.x - w * 0.62, p.y - h);
    ctx.lineTo(p.x, p.y - h - h * 0.62);
    ctx.lineTo(p.x + w * 0.62, p.y - h);
    ctx.closePath();
    ctx.fill();
  }

  drawBale(p, s) {
    const { ctx } = this;
    const r = Math.min(54, 7 * p.scale * s.s);
    if (r < 1.4) return;
    ctx.fillStyle = '#d9b45c';
    ctx.beginPath();
    ctx.arc(p.x, p.y - r * 0.7, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,30,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawRings(state) {
    const { ctx } = this;
    const cam = state.cam;
    const next = state.rings[state.nextRing];
    for (let i = state.rings.length - 1; i >= 0; i--) {
      const ring = state.rings[i];
      if (ring.state === 'hit') continue;
      const d = ring.z - cam.z;
      if (d < 8 || d > 2400) continue;
      const p = this.project(cam, ring.x, ring.z, ring.alt);
      const rx = ring.r * p.scale;
      if (rx < 2) continue;
      const isNext = ring === next;
      ctx.save();
      if (isNext) {
        ctx.shadowColor = 'rgba(255,180,60,0.9)';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = '#ffb63e';
      } else {
        ctx.strokeStyle = ring.state === 'missed' ? 'rgba(150,160,170,0.55)' : 'rgba(64,200,190,0.8)';
      }
      ctx.lineWidth = clamp(rx * 0.09, 1.4, 13);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, rx * 0.94, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (isNext && d < 700) {
        ctx.fillStyle = 'rgba(255,182,62,0.10)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx, rx * 0.94, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Guide arrow to the next ring when it sits off-screen.
    if (next && state.mode === 'play') {
      const d = next.z - cam.z;
      if (d > 0) {
        const p = this.project(cam, next.x, next.z, next.alt);
        if (p.x < 40 || p.x > VIEW_W - 40 || p.y < 30 || p.y > VIEW_H - 30) {
          const cx = VIEW_W / 2;
          const cy = VIEW_H / 2;
          const ang = Math.atan2(p.y - cy, p.x - cx);
          const ax = cx + Math.cos(ang) * 330;
          const ay = cy + Math.sin(ang) * 240;
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(ang);
          ctx.fillStyle = 'rgba(255,182,62,0.9)';
          ctx.beginPath();
          ctx.moveTo(16, 0);
          ctx.lineTo(-10, -9);
          ctx.lineTo(-10, 9);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  drawPlane(state) {
    const { ctx } = this;
    const cam = state.cam;
    // Ground shadow first: an ellipse on the terrain below the plane.
    const groundHere = terrainHeight(cam.x, cam.z + 26);
    const dS = clamp(cam.alt * 2.1, 26, 700);
    const sp = this.project(cam, cam.x + 8, cam.z + dS, terrainHeight(cam.x + 8, cam.z + dS));
    const shR = clamp(64 * sp.scale, 6, 90);
    ctx.fillStyle = `rgba(20,30,16,${clamp(0.42 - cam.alt / 700, 0.1, 0.4)})`;
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, shR, shR * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    const px = VIEW_W / 2 + state.bankVis * 26;
    const py = VIEW_H * 0.665 + state.pitchVis * -26 + Math.sin(state.time * 2.1) * 2.2;
    const S = 1.06; // plane size factor
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.bankVis * 0.52);
    ctx.scale(S, S);
    if (state.mode === 'over') {
      ctx.rotate(0.5);
      ctx.translate(6, 26);
    }
    // Tailplane
    ctx.fillStyle = '#c33d2e';
    ctx.beginPath();
    ctx.ellipse(0, -34, 34, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Main wing
    const wingGrad = ctx.createLinearGradient(-118, 0, 118, 0);
    wingGrad.addColorStop(0, '#d84a38');
    wingGrad.addColorStop(0.5, '#f0664f');
    wingGrad.addColorStop(1, '#d84a38');
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.ellipse(0, 6, 118, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fuselage (rear view: tall teardrop)
    const fusGrad = ctx.createLinearGradient(0, -64, 0, 30);
    fusGrad.addColorStop(0, '#f4f6f8');
    fusGrad.addColorStop(1, '#c9d2da');
    ctx.fillStyle = fusGrad;
    ctx.beginPath();
    ctx.ellipse(0, -8, 21, 52, 0, 0, Math.PI * 2);
    ctx.fill();
    // Vertical fin
    ctx.fillStyle = '#c33d2e';
    ctx.beginPath();
    ctx.moveTo(-4, -88);
    ctx.lineTo(4, -88);
    ctx.lineTo(7, -48);
    ctx.lineTo(-7, -48);
    ctx.closePath();
    ctx.fill();
    // Canopy
    ctx.fillStyle = '#274b63';
    ctx.beginPath();
    ctx.ellipse(0, -34, 12.5, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,240,0.75)';
    ctx.beginPath();
    ctx.ellipse(-3.5, -40, 5, 9, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Propeller: blurred disc + two blades sweeping with time.
    ctx.fillStyle = 'rgba(30,30,34,0.16)';
    ctx.beginPath();
    ctx.arc(0, -6, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(25,25,30,0.55)';
    ctx.lineWidth = 4.5;
    const pa = state.time * 41;
    ctx.beginPath();
    ctx.moveTo(Math.cos(pa) * -29, -6 + Math.sin(pa) * -29);
    ctx.lineTo(Math.cos(pa) * 29, -6 + Math.sin(pa) * 29);
    ctx.stroke();
    // Spinner + nav lights
    ctx.fillStyle = '#33383e';
    ctx.beginPath();
    ctx.arc(0, -6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(-116, 6, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3aff7a';
    ctx.beginPath();
    ctx.arc(116, 6, 4.6, 0, Math.PI * 2);
    ctx.fill();
    if (Math.floor(state.time * 1.6) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(0, -90, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    state._planeScreen = { x: px, y: py };
  }

  panel(x, y, w, h, alpha = 0.55) {
    const { ctx } = this;
    ctx.fillStyle = `rgba(8,18,28,${alpha})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,200,255,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  drawHUD(state) {
    const { ctx } = this;
    if (state.mode === 'title') return;
    const altFt = Math.round(state.cam.alt * 3.281);
    const spdKt = Math.round(state.speed * 1.944);
    const vsFpm = Math.round(state.climbRate * 196.85);
    let hdg = Math.round(state.cam.heading) % 360;
    if (hdg < 0) hdg += 360;

    ctx.font = '600 21px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    // Left cluster: altitude / speed / vertical speed.
    this.panel(26, 24, 208, 118);
    ctx.fillStyle = '#9fd8ff';
    ctx.textAlign = 'left';
    ctx.fillText('ALT', 44, 52);
    ctx.fillText('SPD', 44, 84);
    ctx.fillText('VSI', 44, 116);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.font = '700 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`${altFt} ft`, 218, 52);
    ctx.fillText(`${spdKt} kt`, 218, 84);
    ctx.font = '600 21px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`${vsFpm >= 0 ? '+' : ''}${vsFpm}`, 218, 116);

    // Compass tape, top centre.
    this.panel(VIEW_W / 2 - 170, 24, 340, 46);
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW_W / 2 - 162, 28, 324, 38);
    ctx.clip();
    ctx.fillStyle = '#cfeaff';
    ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let dgr = -60; dgr <= 60; dgr += 10) {
      const world = ((Math.round((hdg + dgr) / 10) * 10) % 360 + 360) % 360;
      const x = VIEW_W / 2 + (world - hdg + (world - hdg > 180 ? -360 : world - hdg < -180 ? 360 : 0)) * 3.1;
      if (x < VIEW_W / 2 - 165 || x > VIEW_W / 2 + 165) continue;
      const label = world === 0 ? 'N' : world === 90 ? 'E' : world === 180 ? 'S' : world === 270 ? 'W' : String(world / 10);
      ctx.fillText(label, x, 48);
      ctx.fillRect(x - 0.75, 58, 1.5, 7);
    }
    ctx.restore();
    ctx.fillStyle = '#ffb63e';
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 - 7, 26);
    ctx.lineTo(VIEW_W / 2 + 7, 26);
    ctx.lineTo(VIEW_W / 2, 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 19px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${String(hdg).padStart(3, '0')}°`, VIEW_W / 2, 86);

    // Right cluster: score.
    this.panel(VIEW_W - 242, 24, 216, 118);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '600 21px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE', VIEW_W - 224, 52);
    ctx.fillText('RINGS', VIEW_W - 224, 84);
    ctx.fillText('COMBO', VIEW_W - 224, 116);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.font = '700 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(state.score), VIEW_W - 42, 52);
    ctx.fillText(String(state.ringsHit), VIEW_W - 42, 84);
    ctx.fillStyle = state.combo > 1 ? '#ffb63e' : '#ffffff';
    ctx.fillText(`×${Math.min(state.combo, 8)}`, VIEW_W - 42, 116);

    // Artificial horizon, bottom left.
    const hx = 108;
    const hy = VIEW_H - 108;
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, 74, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#101c28';
    ctx.fillRect(hx - 74, hy - 74, 148, 148);
    ctx.translate(hx, hy);
    ctx.rotate(-state.bankVis * 0.52);
    ctx.translate(0, state.pitchVis * 26);
    ctx.fillStyle = '#3f7fbf';
    ctx.fillRect(-90, -90, 180, 90);
    ctx.fillStyle = '#7a5c38';
    ctx.fillRect(-90, 0, 180, 90);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-90, 0);
    ctx.lineTo(90, 0);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(160,210,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy, 74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffb63e';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(hx - 30, hy);
    ctx.lineTo(hx - 9, hy);
    ctx.moveTo(hx + 9, hy);
    ctx.lineTo(hx + 30, hy);
    ctx.stroke();
    ctx.fillStyle = '#ffb63e';
    ctx.beginPath();
    ctx.arc(hx, hy, 3.4, 0, Math.PI * 2);
    ctx.fill();

    // Throttle bar, bottom right.
    const tx = VIEW_W - 86;
    const ty = VIEW_H - 196;
    this.panel(tx - 14, ty - 30, 62, 168, 0.45);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', tx + 17, ty - 14);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(tx, ty, 34, 118);
    const th = state.throttle * 118;
    const tGrad = ctx.createLinearGradient(0, ty + 118, 0, ty);
    tGrad.addColorStop(0, '#3aff7a');
    tGrad.addColorStop(1, '#ffb63e');
    ctx.fillStyle = tGrad;
    ctx.fillRect(tx, ty + 118 - th, 34, th);

    // Next-ring distance, under the crosshair.
    const next = state.rings[state.nextRing];
    if (next && state.mode === 'play') {
      const d = Math.max(0, Math.round(next.z - state.cam.z));
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '600 19px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${d} m`, VIEW_W / 2, VIEW_H * 0.40);
      ctx.strokeStyle = 'rgba(255,182,62,0.95)';
      ctx.lineWidth = 2.4;
      const cxp = VIEW_W / 2;
      const cyp = VIEW_H * 0.365;
      ctx.beginPath();
      ctx.moveTo(cxp - 17, cyp);
      ctx.lineTo(cxp - 6, cyp);
      ctx.moveTo(cxp + 6, cyp);
      ctx.lineTo(cxp + 17, cyp);
      ctx.moveTo(cxp, cyp - 17);
      ctx.lineTo(cxp, cyp - 6);
      ctx.moveTo(cxp, cyp + 6);
      ctx.lineTo(cxp, cyp + 17);
      ctx.stroke();
    }
    if (state.flashText && state.flashUntil > state.time) {
      ctx.fillStyle = state.flashColor || '#ffb63e';
      ctx.font = '800 44px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.flashText, VIEW_W / 2, VIEW_H * 0.30);
    }
  }

  drawTitle(state) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(6,14,22,0.34)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.panel(VIEW_W / 2 - 330, 196, 660, 356, 0.72);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb63e';
    ctx.font = '800 74px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('VALLEY RINGS', VIEW_W / 2, 292);
    ctx.fillStyle = '#dcefff';
    ctx.font = '500 25px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Thread the glowing rings over the river valley.', VIEW_W / 2, 344);
    ctx.fillText('Bank to steer · climb and dive · mind the hills.', VIEW_W / 2, 380);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '600 21px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('← → or A / D — bank      ↑ ↓ — climb / dive', VIEW_W / 2, 434);
    ctx.fillText('W / S or wheel — throttle      mouse / touch — steer', VIEW_W / 2, 466);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 27px "Segoe UI", system-ui, sans-serif';
    const blink = Math.floor(state.time * 1.4) % 2 === 0;
    if (blink) ctx.fillText('PRESS ENTER OR CLICK TO FLY', VIEW_W / 2, 516);
  }

  drawGameOver(state) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(10,8,8,0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.panel(VIEW_W / 2 - 300, 218, 600, 330, 0.78);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6a55';
    ctx.font = '800 58px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('CRASHED', VIEW_W / 2, 292);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`Score  ${state.score}`, VIEW_W / 2, 356);
    ctx.fillText(`Rings  ${state.ringsHit}      Distance  ${(state.distance / 1000).toFixed(1)} km`, VIEW_W / 2, 398);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '600 21px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`Best  ${state.best}`, VIEW_W / 2, 442);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px "Segoe UI", system-ui, sans-serif';
    if (Math.floor(state.time * 1.4) % 2 === 0) {
      ctx.fillText('PRESS ENTER TO FLY AGAIN', VIEW_W / 2, 500);
    }
  }

  drawPaused(state) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(6,14,22,0.5)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 52px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2);
  }
}
