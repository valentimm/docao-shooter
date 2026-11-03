// Um AudioContext só, pro jogo inteiro.
// No Safari o gesto (clique ou tecla) só destrava o contexto criado dentro
// daquele handler. A voz abria o dela no pointerdown e o jogo abria outro
// no clique: o segundo ficava suspenso e tiros, passos e música saíam mudos.
// O resume() tem que ser síncrono no gesto. Pointer lock não conta.
// O trenó (bd7d093) ainda piorava: no primeiro quadro, com o resume() ainda
// pendente, agendava ~50 osciladores com rampa exponencial. No WebKit isso
// derruba o dispositivo de áudio e o contexto não volta a soar.

let ctx = null;
let made = 0;
let primed = false;
let tag = 'sfx';
let epoch = 1;
const log = [];

function pushLog(kind, node) {
  log.push({ kind, node: node || 'node', t: ctx ? ctx.currentTime : 0, at: performance.now(), epoch, peak: 0 });
  if (log.length > 240) log.shift();
}

export function noteAudio(kind, node) { pushLog(kind || tag, node); }

export function withAudioTag(kind, fn) {
  const prev = tag;
  tag = kind || prev;
  try { return fn(); }
  catch (e) { return undefined; }
  finally { tag = prev; }
}

export function sharedAudio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    made += 1;
    ctx.addEventListener('statechange', () => { try { if (window.__audio && window.__audio._onstate) window.__audio._onstate(); } catch (e) { /* o quadro seguinte tenta */ } });
  } catch (e) { ctx = null; }
  return ctx;
}

function playSilence(c) {
  const rate = c.sampleRate || 44100;
  const n = Math.max(32, (rate * 0.05) | 0);
  const buf = c.createBuffer(1, n, rate);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start();
  pushLog('unlock', 'silence');
}

// Gesto do usuário: resume() e um buffer mudo, os dois no mesmo turno.
export function unlockAudio() {
  const c = sharedAudio();
  if (!c) return null;
  const locked = c.state === 'suspended' || c.state === 'interrupted';
  try { if (locked) c.resume(); } catch (e) { /* o próximo gesto tenta de novo */ }
  if (!primed || locked) {
    primed = true;
    try { playSilence(c); } catch (e) { /* o silêncio é só a chave */ }
  }
  return c;
}

export function resumeAudio() {
  if (!ctx) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  try {
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume();
  } catch (e) { /* o próximo clique retoma */ }
}

export function armAudioGestures() {
  if (armAudioGestures.done || typeof document === 'undefined') return;
  armAudioGestures.done = true;
  const go = () => { unlockAudio(); };
  for (const ev of ['pointerdown', 'keydown', 'mousedown', 'touchend', 'click']) {
    document.addEventListener(ev, go, true);
  }
  window.addEventListener('focus', resumeAudio);
  document.addEventListener('visibilitychange', resumeAudio);
}

// WebKit gera NaN (e cala o destino inteiro) se a rampa exponencial começa em 0,
// é negativa ou não é finita. A exceção também não pode escapar.
export function safeSet(param, value, time) {
  if (!param) return;
  const v = Number.isFinite(value) ? value : 0;
  const t = Number.isFinite(time) && time >= 0 ? time : 0;
  try { param.setValueAtTime(v, t); } catch (e) { /* valor rejeitado */ }
}

export function safeExpRamp(param, value, time) {
  if (!param) return;
  const v = Number.isFinite(value) && value > 0 ? value : 0.001;
  const t = Number.isFinite(time) && time > 0 ? time : 0.001;
  try { param.exponentialRampToValueAtTime(v, t); }
  catch (e) { try { param.linearRampToValueAtTime(v, t); } catch (e2) { /* já passou */ } }
}

function paintPeak(byte) {
  if (!(byte > 0)) return;
  for (let i = log.length - 1; i >= 0; i--) {
    const row = log[i];
    if (row.epoch !== epoch) break;
    if (byte > row.peak) row.peak = byte;
  }
}

// Mede no relógio do áudio, em paralelo à saída. O quadro do jogo pode
// demorar e um Analyser no rAF perde o tiro e o passo.
export function watchMaster(master) {
  const c = ctx;
  if (!c || !master || master.__watched) return;
  master.__watched = true;
  try {
    const sink = c.createGain();
    sink.gain.value = 0;
    const proc = c.createScriptProcessor(1024, 1, 1);
    proc.onaudioprocess = (ev) => {
      try {
        const data = ev.inputBuffer.getChannelData(0);
        let m = 0;
        for (let i = 0; i < data.length; i++) {
          const a = data[i] < 0 ? -data[i] : data[i];
          if (a > m) m = a;
        }
        const out = ev.outputBuffer.getChannelData(0);
        for (let i = 0; i < out.length; i++) out[i] = 0;
        paintPeak(Math.min(127, Math.round(m * 128)));
      } catch (e) { /* medidor falho não corta o som */ }
    };
    master.connect(proc);
    proc.connect(sink);
    sink.connect(c.destination);
  } catch (e) { /* sem medidor o jogo segue */ }
}

export function audioRunning() {
  return !!(ctx && ctx.state === 'running');
}

if (typeof window !== 'undefined') {
  window.__audio = {
    get state() { return ctx ? ctx.state : 'none'; },
    get count() { return made; },
    get log() { return log; },
    get epoch() { return epoch; },
    has(kind) { return log.some((row) => row.epoch === epoch && row.kind === kind); },
    peakOf(kind) {
      let m = 0;
      for (const row of log) if (row.epoch === epoch && row.kind === kind && row.peak > m) m = row.peak;
      return m;
    },
    resetPeaks() { epoch += 1; },
    _onstate: null,
  };
}
