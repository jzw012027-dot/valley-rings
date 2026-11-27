// Keyboard, mouse and touch in one place. The plane steers three ways and
// they blend: arrow keys / A,D bank, W,S work the throttle, the mouse steers
// toward where you point, and a touch drag does the same on a tablet.
// Enter or a click starts and restarts; P pauses; M mutes.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pointer = { x: 0, y: 0, active: false, seen: false };
    this.startPressed = false;
    this.pausePressed = false;
    this.mutePressed = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Enter' || e.code === 'Space') this.startPressed = true;
      if (e.code === 'KeyP') this.pausePressed = true;
      if (e.code === 'KeyM') this.mutePressed = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    const setPointer = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = ((clientY - r.top) / r.height) * 2 - 1;
      this.pointer.seen = true;
    };
    canvas.addEventListener('mousemove', (e) => setPointer(e.clientX, e.clientY));
    canvas.addEventListener('mousedown', (e) => {
      setPointer(e.clientX, e.clientY);
      this.pointer.active = true;
      this.startPressed = true;
    });
    window.addEventListener('mouseup', () => (this.pointer.active = false));
    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      setPointer(t.clientX, t.clientY);
      this.pointer.active = true;
      this.startPressed = true;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      const t = e.changedTouches[0];
      setPointer(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', () => (this.pointer.active = false));
    canvas.addEventListener('wheel', (e) => {
      this.wheelDelta = (this.wheelDelta || 0) + Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  // Bank and pitch targets in -1..1. Keyboard wins while a key is held;
  // otherwise the pointer steers if it has been used.
  steer() {
    let bank = 0;
    let pitch = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) bank -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) bank += 1;
    if (this.keys.has('ArrowUp')) pitch += 1;
    if (this.keys.has('ArrowDown')) pitch -= 1;
    if (bank === 0 && pitch === 0 && this.pointer.seen) {
      bank = this.pointer.x * 0.9;
      pitch = -this.pointer.y * 0.75;
    }
    return { bank, pitch };
  }

  throttleDelta(dt) {
    let d = 0;
    if (this.keys.has('KeyW')) d += dt * 0.55;
    if (this.keys.has('KeyS')) d -= dt * 0.55;
    if (this.wheelDelta) {
      d -= this.wheelDelta * 0.06;
      this.wheelDelta = 0;
    }
    return d;
  }

  consumeStart() {
    const v = this.startPressed;
    this.startPressed = false;
    return v;
  }
  consumePause() {
    const v = this.pausePressed;
    this.pausePressed = false;
    return v;
  }
  consumeMute() {
    const v = this.mutePressed;
    this.mutePressed = false;
    return v;
  }
}
