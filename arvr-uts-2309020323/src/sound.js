// Efek suara sederhana memakai WebAudio (tanpa file audio, jadi ringan)

export class SoundFx {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.ctx = null;
  }

  _ctx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // Panggil dari tap/klik pertama agar browser mengizinkan suara
  unlock() { this._ctx(); }

  _tone(freq, start, dur, type = 'sine', vol = 0.15) {
    const ctx = this._ctx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + start;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  found()   { if (this.enabled) this._tone(660, 0, 0.12); }
  correct() { if (this.enabled) { this._tone(523, 0, 0.14); this._tone(659, 0.12, 0.14); this._tone(784, 0.24, 0.22); } }
  wrong()   { if (this.enabled) { this._tone(220, 0, 0.22, 'sawtooth', 0.1); this._tone(160, 0.16, 0.3, 'sawtooth', 0.1); } }
  finish()  { if (this.enabled) [523, 659, 784, 1047].forEach((f, i) => this._tone(f, i * 0.13, 0.2)); }
}
