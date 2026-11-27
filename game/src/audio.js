// All sound is synthesised with WebAudio: a two-oscillator engine whose
// pitch follows the throttle, band-passed wind that follows the airspeed, a
// two-note chime for a ring, and a low thud for the crash. No audio files.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Browsers only let audio start after a gesture; called on first input.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    // Engine: saw + square a fifth apart through a low-pass.
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 58;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 87;
    const og = ctx.createGain();
    og.gain.value = 0.5;
    this.engineOsc1.connect(og);
    this.engineOsc2.connect(og);
    og.connect(lp);
    lp.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc1.start();
    this.engineOsc2.start();

    // Wind: looped noise buffer through a band-pass.
    const len = ctx.sampleRate * 1.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSrc = ctx.createBufferSource();
    this.windSrc.buffer = buf;
    this.windSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 640;
    bp.Q.value = 0.6;
    this.windFilter = bp;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windSrc.connect(bp);
    bp.connect(this.windGain);
    this.windGain.connect(this.master);
    this.windSrc.start();
  }

  update(throttle, speedKt, running) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = 52 + throttle * 68;
    this.engineOsc1.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 1.5, t, 0.08);
    this.engineGain.gain.setTargetAtTime(running ? 0.05 + throttle * 0.075 : 0.0, t, 0.1);
    const wind = Math.min(0.16, Math.max(0, (speedKt - 55) / 700));
    this.windGain.gain.setTargetAtTime(running ? wind : 0.0, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(420 + speedKt * 3.4, t, 0.2);
  }

  blip(freq, dur, gain, when = 0, type = 'sine') {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  ringChime(combo) {
    const base = 740 + Math.min(combo, 8) * 40;
    this.blip(base, 0.16, 0.16);
    this.blip(base * 1.335, 0.22, 0.14, 0.07);
  }

  missThud() {
    this.blip(140, 0.14, 0.1, 0, 'triangle');
  }

  crash() {
    if (!this.ctx) return;
    this.blip(90, 0.5, 0.3, 0, 'sine');
    this.blip(55, 0.7, 0.3, 0.03, 'triangle');
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
