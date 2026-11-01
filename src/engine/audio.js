// Fully procedural sound: no audio files. A drifting pad + wind-chime bells for exploration,
// a driving arpeggio for battles, and wet little foley sounds. Safe to call in any environment:
// if Web Audio is unavailable every method quietly does nothing.

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  pent: [0, 3, 5, 7, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};
const THEMES = {
  title: { root: 55, scale: 'pent', pad: [0, 7, 12], bells: 0.5, bellOct: 4, bar: 5.5 },
  sea: { root: 49, scale: 'pent', pad: [0, 7, 15], bells: 0.6, bellOct: 4, bar: 5 },
  archive: { root: 58.27, scale: 'minor', pad: [0, 3, 10], bells: 0.45, bellOct: 3, bar: 6 },
  chapel: { root: 46.25, scale: 'phrygian', pad: [0, 7, 13], bells: 0.7, bellOct: 4, bar: 6.5 },
  kiln: { root: 41.2, scale: 'phrygian', pad: [0, 6, 12], bells: 0.2, bellOct: 3, bar: 4.5, drone: true },
  battle: { root: 73.42, scale: 'minor', tempo: 148, battle: true },
  boss: { root: 55, scale: 'phrygian', tempo: 132, battle: true, boss: true },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.theme = null;
    this.timer = null;
    this.step = 0;
    this.next = 0;
    this.nextBell = 0;
    this.nextPad = 0;
  }

  init() {
    if (this.ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.enabled ? 0.55 : 0;
    this.master.connect(c.destination);
    this.music_ = c.createGain();
    this.music_.gain.value = 0.7;
    this.music_.connect(this.master);
    this.sfx_ = c.createGain();
    this.sfx_.gain.value = 0.9;
    this.sfx_.connect(this.master);
    // a soft echo for bells and pads
    this.delay = c.createDelay(1);
    this.delay.delayTime.value = 0.34;
    const fb = c.createGain();
    fb.gain.value = 0.34;
    this.delay.connect(fb);
    fb.connect(this.delay);
    const wet = c.createGain();
    wet.gain.value = 0.35;
    this.delay.connect(wet);
    wet.connect(this.music_);
    // looped noise buffer for sea hiss, hits and squelches
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.startSea();
    if (this.theme) this.music(this.theme, true);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
  }

  startSea() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = c.createGain();
    g.gain.value = 0.05;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.12;
    const lg = c.createGain();
    lg.gain.value = 260;
    lfo.connect(lg);
    lg.connect(lp.frequency);
    lfo.start();
    src.connect(lp);
    lp.connect(g);
    g.connect(this.music_);
    src.start();
    this.seaGain = g;
  }

  hz(theme, deg, oct = 0) {
    const sc = SCALES[theme.scale];
    const n = sc[((deg % sc.length) + sc.length) % sc.length] + 12 * (Math.floor(deg / sc.length) + oct);
    return theme.root * Math.pow(2, n / 12);
  }

  music(name, force = false) {
    if (!force && this.theme === name) return;
    this.theme = name;
    if (!this.ctx) return;
    clearInterval(this.timer);
    const th = THEMES[name];
    if (!th) return;
    const t0 = this.ctx.currentTime;
    this.step = 0;
    this.next = t0 + 0.1;
    this.nextBell = t0 + 1;
    this.nextPad = t0;
    if (this.seaGain) this.seaGain.gain.setTargetAtTime(th.battle ? 0.0 : name === 'kiln' ? 0.02 : 0.055, t0, 0.5);
    this.timer = setInterval(() => this.pump(), 90);
  }

  pump() {
    const c = this.ctx;
    const th = THEMES[this.theme];
    if (!c || !th) return;
    const now = c.currentTime;
    if (th.battle) {
      const spb = 60 / th.tempo / 2; // eighth notes
      while (this.next < now + 0.3) {
        this.battleStep(th, this.step, this.next, spb);
        this.next += spb;
        this.step++;
      }
      return;
    }
    while (this.nextPad < now + 0.5) {
      th.pad.forEach((n, i) => this.tone({ f: th.root * Math.pow(2, n / 12), t: this.nextPad + i * 0.12, dur: th.bar * 1.25, type: 'triangle', vol: 0.05, attack: th.bar * 0.35, release: th.bar * 0.5, lp: 700, echo: true }));
      if (th.drone) this.tone({ f: th.root / 2, t: this.nextPad, dur: th.bar * 1.3, type: 'sawtooth', vol: 0.03, attack: 1.5, release: 2, lp: 160 });
      this.nextPad += th.bar;
    }
    while (this.nextBell < now + 0.5) {
      const deg = Math.floor(Math.random() * 7);
      this.tone({ f: this.hz(th, deg, th.bellOct), t: this.nextBell, dur: 2.6, type: 'sine', vol: 0.05, attack: 0.01, release: 2.4, echo: true });
      this.tone({ f: this.hz(th, deg, th.bellOct) * 2.01, t: this.nextBell, dur: 1.2, type: 'sine', vol: 0.014, attack: 0.01, release: 1, echo: true });
      this.nextBell += (1.4 + Math.random() * 3.2) / th.bells;
    }
  }

  battleStep(th, step, t, spb) {
    const bar = Math.floor(step / 16) % 4;
    const roots = th.boss ? [0, 0, 1, -2] : [0, 3, 2, 5];
    const rdeg = roots[bar];
    const i = step % 16;
    if (i % 4 === 0 || (th.boss && i % 8 === 6)) this.tone({ f: this.hz(th, rdeg, 0), t, dur: spb * 1.6, type: 'triangle', vol: 0.16, attack: 0.005, release: spb, lp: 500 });
    const arp = [0, 2, 4, 7, 4, 2, 4, 2];
    this.tone({ f: this.hz(th, rdeg + arp[i % 8], 2), t, dur: spb * 0.9, type: th.boss ? 'sawtooth' : 'square', vol: 0.032, attack: 0.004, release: spb * 0.6, lp: 1800 });
    if (i % 2 === 1) this.noiseHit({ t, dur: 0.04, vol: 0.05, hp: 6000 });
    if (i === 0 || i === 8) this.noiseHit({ t, dur: 0.12, vol: 0.09, lp: 300 });
  }

  tone({ f, t, dur = 0.2, type = 'sine', vol = 0.1, attack = 0.005, release = 0.1, lp = 0, slide = 0, echo = false, dest }) {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    let out = g;
    o.connect(g);
    if (lp) {
      const fl = c.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = lp;
      g.connect(fl);
      out = fl;
    }
    out.connect(dest || this.music_);
    if (echo && this.delay) out.connect(this.delay);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noiseHit({ t, dur = 0.1, vol = 0.1, lp = 0, hp = 0, bp = 0, dest }) {
    const c = this.ctx;
    if (!c) return;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = s;
    const add = (type, freq) => {
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      node.connect(f);
      node = f;
    };
    if (lp) add('lowpass', lp);
    if (hp) add('highpass', hp);
    if (bp) add('bandpass', bp);
    node.connect(g);
    g.connect(dest || this.sfx_);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  // ---- sound effects
  play(name) {
    const c = this.ctx;
    if (!c || !this.enabled) return;
    const t = c.currentTime;
    const S = this.sfx_;
    switch (name) {
      case 'click': this.tone({ f: 560, t, dur: 0.07, type: 'sine', vol: 0.12, slide: 0.7, dest: S }); break;
      case 'confirm': this.tone({ f: 440, t, dur: 0.09, type: 'triangle', vol: 0.12, dest: S }); this.tone({ f: 660, t: t + 0.07, dur: 0.12, type: 'triangle', vol: 0.12, dest: S }); break;
      case 'cancel': this.tone({ f: 330, t, dur: 0.1, type: 'triangle', vol: 0.1, slide: 0.7, dest: S }); break;
      case 'step': this.tone({ f: 150, t, dur: 0.06, type: 'sine', vol: 0.08, slide: 0.45, dest: S }); break;
      case 'blip': this.tone({ f: 330 + Math.random() * 160, t, dur: 0.035, type: 'triangle', vol: 0.045, dest: S }); break;
      case 'squelch':
        this.tone({ f: 280, t, dur: 0.2, type: 'sine', vol: 0.16, slide: 0.3, dest: S });
        this.noiseHit({ t, dur: 0.16, vol: 0.12, bp: 700, dest: S });
        break;
      case 'hit':
        this.noiseHit({ t, dur: 0.14, vol: 0.2, lp: 1800, dest: S });
        this.tone({ f: 180, t, dur: 0.14, type: 'sine', vol: 0.18, slide: 0.4, dest: S });
        break;
      case 'crit':
        this.noiseHit({ t, dur: 0.22, vol: 0.28, lp: 3000, dest: S });
        this.tone({ f: 260, t, dur: 0.22, type: 'sawtooth', vol: 0.12, slide: 0.3, lp: 1200, dest: S });
        break;
      case 'magic':
        [0, 4, 7, 12].forEach((n, i) => this.tone({ f: 440 * Math.pow(2, n / 12), t: t + i * 0.05, dur: 0.22, type: 'sine', vol: 0.1, echo: true, dest: S }));
        break;
      case 'heal':
        [0, 4, 7, 11, 14].forEach((n, i) => this.tone({ f: 523 * Math.pow(2, n / 12), t: t + i * 0.07, dur: 0.3, type: 'triangle', vol: 0.09, echo: true, dest: S }));
        break;
      case 'ko': this.tone({ f: 300, t, dur: 0.5, type: 'sawtooth', vol: 0.1, slide: 0.25, lp: 900, dest: S }); break;
      case 'limit': this.tone({ f: 200, t, dur: 0.7, type: 'sawtooth', vol: 0.12, slide: 4, lp: 2400, dest: S }); this.tone({ f: 400, t: t + 0.4, dur: 0.5, type: 'sine', vol: 0.12, echo: true, dest: S }); break;
      case 'ready': this.tone({ f: 880, t, dur: 0.09, type: 'sine', vol: 0.07, dest: S }); break;
      case 'wrong': this.tone({ f: 190, t, dur: 0.25, type: 'sawtooth', vol: 0.1, slide: 0.6, lp: 700, dest: S }); break;
      case 'lamp': this.tone({ f: 640, t, dur: 0.12, type: 'sine', vol: 0.12, echo: true, dest: S }); break;
      case 'glyph': this.tone({ f: 392, t, dur: 0.5, type: 'sine', vol: 0.12, echo: true, dest: S }); this.tone({ f: 588, t: t + 0.06, dur: 0.5, type: 'sine', vol: 0.08, echo: true, dest: S }); break;
      case 'solve': [0, 4, 7, 12, 16].forEach((n, i) => this.tone({ f: 330 * Math.pow(2, n / 12), t: t + i * 0.12, dur: 0.9, type: 'sine', vol: 0.11, echo: true, dest: S })); break;
      case 'door':
        this.noiseHit({ t, dur: 0.9, vol: 0.14, lp: 260, dest: S });
        this.tone({ f: 70, t, dur: 0.9, type: 'sawtooth', vol: 0.1, slide: 0.6, lp: 200, dest: S });
        break;
      case 'win': [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => this.tone({ f: 392 * Math.pow(2, n / 12), t: t + i * 0.13, dur: 0.35, type: 'square', vol: 0.06, lp: 2200, dest: S })); break;
      case 'item': this.tone({ f: 700, t, dur: 0.08, type: 'triangle', vol: 0.1, dest: S }); this.tone({ f: 1050, t: t + 0.06, dur: 0.14, type: 'triangle', vol: 0.1, dest: S }); break;
      default: break;
    }
  }
}
