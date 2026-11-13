// Effets sonores synthetises (WebAudio) : aucun fichier a charger.
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('cdc.mute') === '1'; } catch (e) { /* stockage indisponible */ }

export const isMuted = () => muted;
export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem('cdc.mute', muted ? '1' : '0'); } catch (e) { /* rien */ }
}

/** iOS : le contexte audio doit etre debloque par un geste de l'utilisateur. */
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function out(gain = 0.25) {
  const g = ctx.createGain();
  g.gain.value = gain;
  g.connect(ctx.destination);
  return g;
}

function tone(freq, t0, dur, { type = 'sine', gain = 0.2, slide = 0, attack = 0.005 } = {}) {
  const o = ctx.createOscillator();
  const g = out(0);
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(t0, dur, { gain = 0.15, freq = 2000, q = 1, sweep = 0 } = {}) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0);
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, freq + sweep), t0 + dur);
  const g = out(0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g);
  src.start(t0);
}

const SOUNDS = {
  dice() {
    const t = ctx.currentTime;
    for (let i = 0; i < 9; i++) noise(t + i * 0.07 + Math.random() * 0.03, 0.05, { gain: 0.22, freq: 2600 + Math.random() * 1800, q: 4 });
    noise(t + 0.75, 0.08, { gain: 0.3, freq: 1400, q: 3 });
  },
  step(i = 0) {
    const t = ctx.currentTime;
    tone(520 + (i % 6) * 40, t, 0.12, { type: 'triangle', gain: 0.16, slide: 260 });
  },
  flip() {
    const t = ctx.currentTime;
    noise(t, 0.35, { gain: 0.16, freq: 700, q: 0.8, sweep: 2600 });
    tone(330, t + 0.18, 0.25, { type: 'sine', gain: 0.08, slide: 330 });
  },
  close() {
    const t = ctx.currentTime;
    noise(t, 0.28, { gain: 0.12, freq: 2400, q: 0.8, sweep: -1900 });
    tone(220, t + 0.24, 0.12, { type: 'triangle', gain: 0.18 });
  },
  good() {
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.32, { type: 'triangle', gain: 0.16 }));
  },
  bad() {
    const t = ctx.currentTime;
    tone(392, t, 0.22, { type: 'sine', gain: 0.18, slide: -60 });
    tone(311, t + 0.2, 0.36, { type: 'sine', gain: 0.18, slide: -80 });
  },
  pop() {
    const t = ctx.currentTime;
    tone(880, t, 0.08, { type: 'sine', gain: 0.14, slide: 600 });
  },
  tick() {
    const t = ctx.currentTime;
    tone(1400, t, 0.03, { type: 'square', gain: 0.05 });
  },
  win() {
    const t = ctx.currentTime;
    const m = [523, 659, 784, 659, 784, 1047];
    m.forEach((f, i) => tone(f, t + i * 0.13, 0.4, { type: 'triangle', gain: 0.17 }));
    tone(1319, t + 0.8, 0.9, { type: 'sine', gain: 0.12 });
  },
  heart() {
    const t = ctx.currentTime;
    tone(70, t, 0.14, { type: 'sine', gain: 0.35, slide: -20 });
    tone(64, t + 0.2, 0.18, { type: 'sine', gain: 0.28, slide: -20 });
  },
  notify() {
    const t = ctx.currentTime;
    tone(988, t, 0.12, { type: 'sine', gain: 0.1 });
    tone(1319, t + 0.1, 0.2, { type: 'sine', gain: 0.1 });
  },
};

export function play(name, arg) {
  if (muted || !ctx || ctx.state !== 'running') return;
  try { SOUNDS[name] && SOUNDS[name](arg); } catch (e) { /* audio non critique */ }
}

export function buzz(pattern) {
  if (muted) return;
  try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) { /* rien */ }
}
