// Cama sonora da HOTMILK à Noite: vento grave, grilo espaçado e um zumbido
// de lâmpada fluorescente. Bem baixo, por baixo da trilha da Invasão.
// Não carrega arquivo: usa o AudioContext que o jogo já abre.

export function createNightAmbience() {
  let nodes = null;
  return {
    start(actx, master) {
      this.stop();
      if (!actx || !master) return;
      const t = actx.currentTime;
      const bus = actx.createGain();
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.exponentialRampToValueAtTime(0.22, t + 1.4);
      bus.connect(master);
      const windSrc = actx.createBufferSource();
      const buf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
      const data = buf.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < data.length; i++) { const white = Math.random() * 2 - 1; prev = prev * 0.96 + white * 0.04; data[i] = prev * 3.2; }
      windSrc.buffer = buf; windSrc.loop = true;
      const windFilter = actx.createBiquadFilter();
      windFilter.type = 'lowpass'; windFilter.frequency.value = 280;
      const windGain = actx.createGain(); windGain.gain.value = 0.35;
      windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(bus); windSrc.start();
      const hum = actx.createOscillator();
      hum.type = 'sine'; hum.frequency.value = 118;
      const hum2 = actx.createOscillator();
      hum2.type = 'triangle'; hum2.frequency.value = 236;
      const humGain = actx.createGain(); humGain.gain.value = 0.03;
      hum.connect(humGain); hum2.connect(humGain); humGain.connect(bus);
      hum.start(); hum2.start();
      const cricket = actx.createOscillator();
      cricket.type = 'triangle'; cricket.frequency.value = 1680;
      const cricketGain = actx.createGain();
      cricketGain.gain.value = 0;
      cricket.connect(cricketGain); cricketGain.connect(bus); cricket.start();
      nodes = { bus, windSrc, hum, hum2, cricket, cricketGain, actx, next: t + 1.2 };
    },
    tick() {
      if (!nodes) return;
      const { actx, cricketGain, next } = nodes;
      const t = actx.currentTime;
      if (t < next) return;
      cricketGain.gain.cancelScheduledValues(t);
      cricketGain.gain.setValueAtTime(0.0001, t);
      cricketGain.gain.exponentialRampToValueAtTime(0.045, t + 0.02);
      cricketGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      nodes.next = t + 0.55 + Math.random() * 1.6;
    },
    stop() {
      if (!nodes) return;
      const { bus, windSrc, hum, hum2, cricket } = nodes;
      try { windSrc.stop(); hum.stop(); hum2.stop(); cricket.stop(); } catch (e) { /* já parou */ }
      try { bus.disconnect(); } catch (e) { /* */ }
      nodes = null;
    },
  };
}
