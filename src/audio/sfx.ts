// Efeitos curtos sintetizados com Web Audio: contagem, largada, batida, volta e zebra.

import { noiseBuffer, tone, type Bus } from './synth';

export type SfxName = 'countdown' | 'go' | 'crash' | 'lap' | 'kerb';

/** Toca um efeito agora, no barramento indicado. Não lança exceção. */
export function playSfx(bus: Bus, name: SfxName): void {
  const t = bus.ctx.currentTime + 0.01;
  switch (name) {
    case 'countdown':
      // Bip curto de 440 Hz.
      tone(bus, t, 440, 0.12, { wave: 'square', vol: 0.12, attack: 0.003, decay: 0.02, sustain: 0.8, release: 0.03, cutoff: 4000 });
      return;
    case 'go':
      // Bip de 880 Hz, mais longo.
      tone(bus, t, 880, 0.45, { wave: 'square', vol: 0.14, attack: 0.003, decay: 0.1, sustain: 0.7, release: 0.2, cutoff: 5000 });
      return;
    case 'lap':
      // Dois bips ascendentes.
      tone(bus, t, 660, 0.09, { wave: 'square', vol: 0.1, attack: 0.003, decay: 0.03, sustain: 0.8, release: 0.03, cutoff: 4000 });
      tone(bus, t + 0.11, 990, 0.14, { wave: 'square', vol: 0.1, attack: 0.003, decay: 0.05, sustain: 0.8, release: 0.1, cutoff: 4000 });
      return;
    case 'crash':
      crash(bus, t);
      return;
    case 'kerb':
      kerb(bus, t);
      return;
  }
}

/** Batida: ruído que cai do agudo para o grave, com um estrondo curto. */
function crash(bus: Bus, t: number): void {
  const ctx = bus.ctx;
  const dur = 0.6;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.8;
  lp.frequency.setValueAtTime(2500, t);
  lp.frequency.exponentialRampToValueAtTime(200, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(lp).connect(g).connect(bus.out);
  src.start(t, 0, dur + 0.05);
  src.stop(t + dur + 0.05);
}

/** Zebra: "trrr" de ruído modulado por uma onda quadrada de ~38 Hz. */
function kerb(bus: Bus, t: number): void {
  const ctx = bus.ctx;
  const dur = 0.16;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3000;
  bp.Q.value = 1;
  // Ganho base 0.06, modulado por uma quadrada de ±0.06 (liga e desliga 38 vezes por segundo).
  const g = ctx.createGain();
  g.gain.value = 0.06;
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 38;
  const depth = ctx.createGain();
  depth.gain.value = 0.06;
  lfo.connect(depth).connect(g.gain);
  src.connect(bp).connect(g).connect(bus.out);
  src.start(t, 0, dur + 0.05);
  lfo.start(t);
  src.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
}
