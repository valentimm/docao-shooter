// Voz de cada tipo da Invasão. Síntese curta, no master do jogo.
// idle = perto do jogador. bite = no ataque. howl = uivo do lobisomem e do Hospício.
// cry = choro da Chorona sentada. near = chefão chegando perto, no jeito dele.
import { safeSet, safeExpRamp, noteAudio } from './audio.js';

const n = (freq, dur, vol, type = 'lowpass', delay = 0) => ({ noise: freq, dur, vol, type, delay });
const o = (osc, f0, f1, dur, vol, delay = 0) => ({ osc, f0, f1, dur, vol, delay });

export const ZOMBIE_VOICES = {
  walker: {
    idle: [o('sawtooth', 98, 52, 0.32, 0.16), o('sawtooth', 74, 46, 0.28, 0.1, 0.2), n(220, 0.22, 0.07)],
    bite: [n(640, 0.07, 0.18, 'bandpass'), o('sawtooth', 160, 55, 0.16, 0.16)],
  },
  runner: {
    idle: [o('square', 920, 480, 0.05, 0.08), o('square', 760, 360, 0.05, 0.07, 0.08), n(3400, 0.06, 0.08, 'highpass', 0.14)],
    bite: [n(4200, 0.04, 0.12, 'highpass'), o('square', 1100, 420, 0.07, 0.1)],
  },
  tank: {
    idle: [o('sine', 52, 34, 0.4, 0.2), n(140, 0.35, 0.12), o('triangle', 90, 60, 0.12, 0.06, 0.18)],
    bite: [n(180, 0.12, 0.2), o('sine', 48, 30, 0.22, 0.18)],
  },
  spitter: {
    idle: [o('sine', 210, 130, 0.16, 0.1), n(520, 0.18, 0.1, 'bandpass', 0.04), o('triangle', 160, 90, 0.14, 0.06, 0.16)],
    bite: [n(700, 0.1, 0.16, 'bandpass'), o('sine', 240, 100, 0.12, 0.1)],
  },
  sling: {
    idle: [o('triangle', 150, 460, 0.16, 0.12), o('sine', 420, 180, 0.14, 0.08, 0.12)],
    bite: [o('triangle', 280, 90, 0.1, 0.12), n(900, 0.06, 0.08, 'bandpass')],
  },
  bat: {
    idle: [o('sine', 1680, 2460, 0.07, 0.07), o('sine', 2200, 1320, 0.08, 0.06, 0.09), o('sine', 1900, 2600, 0.06, 0.05, 0.2)],
    bite: [o('sine', 2400, 900, 0.08, 0.1), n(3000, 0.04, 0.05, 'highpass')],
  },
  cry: {
    idle: [n(2400, 0.1, 0.05, 'highpass'), o('sine', 620, 210, 0.36, 0.12), o('sawtooth', 590, 180, 0.36, 0.04, 0.03), n(680, 0.16, 0.06, 'bandpass', 0.14)],
    cry: [n(1600, 0.24, 0.09, 'highpass'), o('sine', 740, 160, 0.78, 0.2), o('sine', 700, 148, 0.78, 0.11, 0.04), o('triangle', 1280, 240, 0.2, 0.08, 0.1), n(520, 0.5, 0.1, 'bandpass', 0.26), o('sawtooth', 460, 80, 0.6, 0.07, 0.34), n(2400, 0.09, 0.06, 'highpass', 0.64)],
    bite: [o('sawtooth', 880, 130, 0.22, 0.15), n(1300, 0.1, 0.09, 'bandpass'), o('sine', 520, 110, 0.18, 0.1, 0.06)],
  },
  boss: {
    idle: [o('sawtooth', 68, 36, 0.45, 0.18), n(160, 0.4, 0.1), o('square', 90, 40, 0.2, 0.06, 0.12)],
    bite: [o('sawtooth', 90, 32, 0.22, 0.2), n(240, 0.12, 0.12)],
    near: [o('sine', 46, 26, 0.6, 0.24), n(150, 0.45, 0.16, 'lowpass'), o('sawtooth', 84, 34, 0.32, 0.09, 0.08), n(2600, 0.14, 0.06, 'highpass', 0.22)],
  },
  bossBelly: {
    idle: [o('sine', 96, 58, 0.36, 0.14), n(240, 0.3, 0.1, 'lowpass'), o('triangle', 140, 70, 0.16, 0.05, 0.2)],
    bite: [n(300, 0.14, 0.16, 'lowpass'), o('sine', 80, 40, 0.18, 0.12)],
    near: [n(260, 0.4, 0.18, 'lowpass'), o('sine', 64, 36, 0.48, 0.18), n(140, 0.26, 0.12, 'lowpass', 0.16), o('triangle', 100, 48, 0.24, 0.09, 0.3)],
  },
  bossGhost: {
    idle: [o('sine', 740, 420, 0.4, 0.07), o('triangle', 980, 560, 0.32, 0.04, 0.08), n(1800, 0.3, 0.03, 'highpass')],
    bite: [o('sine', 880, 300, 0.18, 0.08), n(2200, 0.1, 0.04, 'highpass')],
    near: [o('sine', 920, 480, 0.7, 0.09), o('sine', 960, 440, 0.7, 0.06, 0.05), n(2800, 0.55, 0.05, 'highpass'), o('triangle', 1400, 280, 0.4, 0.05, 0.24)],
  },
  bossMummy: {
    idle: [n(380, 0.28, 0.1, 'bandpass'), o('sawtooth', 120, 70, 0.3, 0.08), n(900, 0.08, 0.04, 'highpass', 0.16)],
    bite: [n(500, 0.1, 0.14, 'bandpass'), o('square', 160, 70, 0.12, 0.08)],
    near: [n(460, 0.48, 0.16, 'bandpass'), n(980, 0.18, 0.07, 'highpass', 0.06), o('sawtooth', 88, 42, 0.5, 0.1), n(280, 0.28, 0.08, 'lowpass', 0.26)],
  },
  bossWolf: {
    idle: [o('sawtooth', 140, 90, 0.2, 0.1), n(400, 0.12, 0.05, 'bandpass')],
    bite: [o('sawtooth', 180, 70, 0.14, 0.16), n(600, 0.06, 0.08, 'bandpass')],
    howl: [o('sine', 220, 680, 0.7, 0.16), o('sawtooth', 180, 540, 0.7, 0.06), o('sine', 660, 240, 0.35, 0.08, 0.62)],
    near: [o('sawtooth', 80, 62, 0.28, 0.16), n(300, 0.22, 0.09, 'bandpass'), o('sine', 170, 620, 0.58, 0.17, 0.2), o('sawtooth', 150, 460, 0.52, 0.07, 0.24)],
  },
  bossCrazy: {
    idle: [o('square', 420, 420, 0.06, 0.08), o('square', 760, 760, 0.05, 0.07, 0.1), o('square', 280, 180, 0.1, 0.08, 0.2), n(2000, 0.04, 0.04, 'highpass', 0.28)],
    bite: [o('square', 640, 200, 0.08, 0.12), o('square', 900, 300, 0.06, 0.08, 0.07)],
    near: [o('square', 540, 540, 0.07, 0.12), o('square', 820, 280, 0.09, 0.1, 0.09), o('square', 410, 410, 0.06, 0.09, 0.2), o('sawtooth', 280, 100, 0.24, 0.12, 0.3), n(1900, 0.06, 0.06, 'highpass', 0.16)],
  },
  bossHosp: {
    idle: [o('sawtooth', 260, 140, 0.16, 0.1), o('square', 480, 160, 0.1, 0.06, 0.14)],
    bite: [o('sawtooth', 320, 90, 0.12, 0.14), n(700, 0.06, 0.08, 'bandpass')],
    howl: [o('sawtooth', 520, 110, 0.45, 0.16), o('square', 380, 90, 0.4, 0.08, 0.06), n(900, 0.2, 0.06, 'bandpass', 0.12)],
    near: [o('sawtooth', 680, 160, 0.4, 0.18), o('square', 520, 120, 0.34, 0.09, 0.04), n(860, 0.24, 0.09, 'bandpass', 0.1), o('sine', 220, 70, 0.46, 0.12, 0.22)],
  },
};

export function createInvasionSfx() {
  let ctx = null, dest = null, noiseBuf = null, nextIdle = 0;

  function bind(audioCtx, master) {
    if (!audioCtx || !master) return;
    ctx = audioCtx;
    dest = master;
  }

  function noise(freq, dur, vol, type, delay) {
    if (!noiseBuf) {
      const rate = ctx.sampleRate > 0 ? ctx.sampleRate : 44100;
      noiseBuf = ctx.createBuffer(1, rate, rate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + Math.max(0, delay || 0);
    const end = t + dur;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    safeSet(f.frequency, Math.min(freq, (ctx.sampleRate || 44100) * 0.45), t);
    const g = ctx.createGain();
    safeSet(g.gain, vol, t);
    safeExpRamp(g.gain, 0.001, end);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t); s.stop(end + 0.02);
    noteAudio('zvoice', 'noise');
  }

  function osc(type, f0, f1, dur, vol, delay) {
    const t = ctx.currentTime + Math.max(0, delay || 0);
    const end = t + dur;
    const node = ctx.createOscillator();
    node.type = type;
    safeSet(node.frequency, f0, t);
    if (f1 !== f0) safeExpRamp(node.frequency, Math.max(1, f1), end);
    const g = ctx.createGain();
    safeSet(g.gain, vol, t);
    safeExpRamp(g.gain, 0.001, end);
    node.connect(g); g.connect(dest);
    node.start(t); node.stop(end + 0.02);
    noteAudio('zvoice', 'osc');
  }

  function voice(zt, vol, kind = 'idle') {
    const row = ZOMBIE_VOICES[zt];
    if (!row || !(vol > 0) || !ctx || !dest) return false;
    const notes = row[kind] || ((kind === 'howl' || kind === 'near' || kind === 'cry') ? row.idle : null);
    if (!notes) return false;
    if (kind === 'idle' || kind === 'cry' || kind === 'near') {
      if (ctx.currentTime < nextIdle) return false;
      nextIdle = ctx.currentTime + (kind === 'idle' ? 0.14 : 0.1);
    }
    try {
      for (const step of notes) {
        const v = step.vol * vol;
        if (!(v > 0)) continue;
        if (step.noise) noise(step.noise, step.dur, v, step.type, step.delay);
        else osc(step.osc, step.f0, step.f1, step.dur, v, step.delay);
      }
    } catch (e) { return false; }
    return true;
  }

  return { bind, voice };
}
