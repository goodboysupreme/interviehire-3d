// ==========================================
// AUDIO SYNTHESIZER ENGINE (Synced with main.js)
// ==========================================
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = true;
    this.lastSliderSoundTime = 0;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  playChime(notes, duration = 0.1, delayMultiplier = 0.15) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * delayMultiplier);
      
      gainNode.gain.setValueAtTime(0, now + index * delayMultiplier);
      gainNode.gain.linearRampToValueAtTime(0.05, now + index * delayMultiplier + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + index * delayMultiplier + duration);
      
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      osc.start(now + index * delayMultiplier);
      osc.stop(now + index * delayMultiplier + duration);
    });
  }

  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(640, now + 0.03);

    gainNode.gain.setValueAtTime(0.03, now);
    gainNode.gain.linearRampToValueAtTime(0.015, now + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  setMute(muted) {
    this.muted = muted;
    if (!muted) {
      this.init();
      this.playChime([261.63, 329.63, 392.00, 523.25], 0.08, 0.12);
    } else {
      this.playChime([392.00, 329.63, 261.63], 0.06, 0.08);
    }
  }

  playHover() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.06);

    gainNode.gain.setValueAtTime(0.012, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  playSlider(value, min = 0, max = 100) {
    if (this.muted || !this.ctx) return;
    const now = Date.now();
    if (now - this.lastSliderSoundTime < 60) return;
    this.lastSliderSoundTime = now;

    const audioNow = this.ctx.currentTime;
    const percent = (value - min) / (max - min);
    const freq = 220 + percent * 367;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioNow);

    gainNode.gain.setValueAtTime(0.015, audioNow);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioNow + 0.1);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(audioNow);
    osc.stop(audioNow + 0.1);
  }
}

export const soundEngine = new SoundEngine();