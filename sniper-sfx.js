// Sons das três snipers. Os arquivos são síntese original (tools/synth-sniper-audio.py),
// não samples de jogo. Entram no master do jogo: o botão de silenciar continua valendo.
// Crack, thump e ferrolho já estão no arquivo — sem eco. Aqui só variação, distância e ganho:
// um buffer por amostra, reusado; cada tiro cria poucos nós e solta no fim.
const FILES = {
  'torresmo-near-a': './assets/audio/sniper/torresmo-near-a.ogg',
  'torresmo-near-b': './assets/audio/sniper/torresmo-near-b.ogg',
  'torresmo-far': './assets/audio/sniper/torresmo-far.ogg',
  'torresmo-bolt': './assets/audio/sniper/torresmo-bolt.ogg',
  'torresmo-reload': './assets/audio/sniper/torresmo-reload.ogg',
  'canhao-near-a': './assets/audio/sniper/canhao-near-a.ogg',
  'canhao-near-b': './assets/audio/sniper/canhao-near-b.ogg',
  'canhao-far': './assets/audio/sniper/canhao-far.ogg',
  'canhao-bolt': './assets/audio/sniper/canhao-bolt.ogg',
  'canhao-reload': './assets/audio/sniper/canhao-reload.ogg',
  'carabina-near-a': './assets/audio/sniper/carabina-near-a.ogg',
  'carabina-near-b': './assets/audio/sniper/carabina-near-b.ogg',
  'carabina-far': './assets/audio/sniper/carabina-far.ogg',
  'carabina-bolt': './assets/audio/sniper/carabina-bolt.ogg',
  'carabina-reload': './assets/audio/sniper/carabina-reload.ogg',
};
const NAME = { sniper: 'torresmo', canhao: 'canhao', carabina: 'carabina' };
// Pico do arquivo ~0,86, já limitado. O master do jogo é 0,4: estes ganhos deixam a
// sniper mais alta que o fuzil e a escopeta, com o Canhão no topo, sem passar de 1 na saída.
const SHOT_GAIN = { sniper: 1.95, canhao: 2.2, carabina: 1.7 };
const BOLT_GAIN = { sniper: 0.62, canhao: 0.72, carabina: 0.48 };
const RELOAD_GAIN = { sniper: 0.70, canhao: 0.78, carabina: 0.52 };
// Longe, o Canhão vira boom; a Carabina ainda leva um pouco do estalo.
const FAR_CUT = { sniper: 1800, canhao: 1050, carabina: 2400 };
const KEYS = new Set(Object.keys(NAME));

const raw = {};
for (const [id, url] of Object.entries(FILES)) {
  raw[id] = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(url + ' ' + r.status)))).catch((e) => {
    console.warn('sniper áudio:', e.message);
    return null;
  });
}

export function createSniperSfx() {
  let ctx = null, bus = null;
  const bufs = {};
  let foley = [];
  const log = [];
  const note = (row) => { log.push(row); if (log.length > 24) log.shift(); if (typeof window !== 'undefined') window.__sniperSfxLog = log; };

  function handles(key) { return KEYS.has(key); }
  function ready(key) {
    const n = NAME[key];
    return !!(n && bufs[n + '-near-a'] && bufs[n + '-near-b'] && bufs[n + '-far'] && bufs[n + '-bolt'] && bufs[n + '-reload']);
  }
  function bind(audioCtx, dest) {
    if (ctx || !audioCtx) return;
    ctx = audioCtx;
    bus = ctx.createGain();
    bus.gain.value = 1;
    // Sem waveshaper: a curva antiga travava a saída em ~0,98 e, com o master em 0,4,
    // a sniper não passava de ~0,39 — mais baixa que a escopeta. O arquivo já vem limitado.
    bus.connect(dest);
    for (const id of Object.keys(FILES)) {
      raw[id].then((ab) => {
        if (!ab || bufs[id] || !ctx) return null;
        return ctx.decodeAudioData(ab.slice(0)).then((b) => { bufs[id] = b; });
      }).catch((e) => console.warn('sniper áudio (decodificar):', e && e.message));
    }
  }
  function cutoffFor(dist, farWeight) {
    const t = Math.min(1, Math.max(0, farWeight));
    const air = 15000 * Math.pow(0.075, Math.min(1, Math.max(0, dist) / 40));
    return Math.max(420, Math.min(air, 16000 - t * 12000));
  }
  // 0 = pertinho, 1 = longe. Perto usa o arquivo seco; longe cruza pro abafado.
  function farWeight(dist) {
    return Math.min(1, Math.max(0, (dist - 8) / 30));
  }
  function playBuf(id, gain, cutoff, rate, pan, asFoley) {
    if (!ctx || !bufs[id] || gain < 0.008) return null;
    const src = ctx.createBufferSource();
    src.buffer = bufs[id];
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    let lp = null;
    let last = src;
    // Perto, lowpass só embota o crack. O grave não precisa de filtro. Longe, o ar come o agudo.
    if (cutoff < 14000) {
      lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cutoff;
      lp.Q.value = 0.7;
      src.connect(lp);
      last = lp;
    }
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      last.connect(panner);
      last = panner;
    }
    last.connect(g);
    g.connect(bus);
    src.start();
    const rec = { src, g };
    src.onended = () => {
      try { src.disconnect(); if (lp) lp.disconnect(); g.disconnect(); } catch (e) { /* já solto */ }
      if (asFoley) foley = foley.filter((x) => x !== rec);
    };
    if (asFoley) foley.push(rec);
    return rec;
  }
  function cutFoley() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const rec of foley) {
      try {
        rec.g.gain.cancelScheduledValues(t);
        rec.g.gain.setValueAtTime(Math.max(0.0001, rec.g.gain.value), t);
        rec.g.gain.linearRampToValueAtTime(0.0001, t + 0.02);
        rec.src.stop(t + 0.03);
      } catch (e) { /* já parou */ }
    }
    foley = [];
  }
  function shot(key, vol = 1, dist = 0, pan = 0) {
    if (!handles(key) || !ready(key) || vol < 0.02) return false;
    const n = NAME[key];
    const w = farWeight(dist);
    const near = Math.cos(w * Math.PI / 2);
    const far = Math.sin(w * Math.PI / 2);
    // ±3,5% de tom e um pouco de volume, pra o mesmo tiro não repetir igual. Longe desce o tom.
    const rate = (0.965 + Math.random() * 0.07) * (1 - 0.045 * w);
    const jitter = 0.90 + Math.random() * 0.14;
    const base = SHOT_GAIN[key] * vol * jitter;
    const variant = Math.random() < 0.5 ? 'a' : 'b';
    const close = dist < 1.5;
    const cut = close ? 20000 : cutoffFor(dist, w);
    if (near > 0.04) playBuf(n + '-near-' + variant, near * base, cut, rate, pan, false);
    if (far > 0.04) playBuf(n + '-far', far * base, Math.min(cut, FAR_CUT[key]), rate, pan, false);
    note({ ev: 'shot', key, dist: Math.round(dist), far: +w.toFixed(2) });
    return true;
  }
  function bolt(key, vol = 1, dist = 0, pan = 0) {
    if (!handles(key) || !bufs[NAME[key] + '-bolt'] || vol < 0.03) return false;
    cutFoley();
    // Tom quase fixo: o ferrolho precisa continuar casado com a animação (w.rate).
    const rate = 0.994 + Math.random() * 0.012;
    const cut = Math.max(700, 14000 * Math.exp(-Math.max(0, dist) / 34));
    playBuf(NAME[key] + '-bolt', BOLT_GAIN[key] * vol * (0.94 + Math.random() * 0.08), cut, rate, pan, true);
    note({ ev: 'bolt', key, dist: Math.round(dist) });
    return true;
  }
  function reload(key, vol = 1, dist = 0, pan = 0) {
    if (!handles(key) || !bufs[NAME[key] + '-reload'] || vol < 0.03) return false;
    cutFoley();
    const rate = 0.99 + Math.random() * 0.02;
    const cut = Math.max(650, 12000 * Math.exp(-Math.max(0, dist) / 36));
    playBuf(NAME[key] + '-reload', RELOAD_GAIN[key] * vol, cut, rate, pan, true);
    note({ ev: 'reload', key, dist: Math.round(dist) });
    return true;
  }
  return { bind, handles, ready, shot, bolt, reload, cutFoley, log: () => log.slice() };
}
