// Timbres e percussão sintetizados com Web Audio (sem arquivos de áudio).
// Adaptado de um sintetizador de outro projeto: cada nota cria seus nós e os descarta ao terminar.

/** Formas de onda usadas pela trilha e pelos efeitos. */
export type Wave = 'sawtooth' | 'square' | 'triangle' | 'sine' | 'pulse25';

/** Barramento de destino de uma nota: saída seca e, opcionalmente, entrada do eco. */
export interface Bus {
  readonly ctx: BaseAudioContext;
  readonly out: AudioNode;
  readonly echo: AudioNode | null;
}

export interface ToneOpts {
  wave: Wave;
  /** Volume de pico (ganho linear). */
  vol: number;
  /** Tempo até o pico, em segundos. */
  attack?: number;
  /** Tempo até cair ao nível de sustentação. */
  decay?: number;
  /** Nível de sustentação como fração do pico (0..1). */
  sustain?: number;
  /** Tempo de queda final depois da duração da nota. */
  release?: number;
  /** Frequência de corte do passa-baixa, em Hz. */
  cutoff?: number;
  /** Desafinação em cents. */
  detune?: number;
  /** Profundidade do vibrato em cents (entra depois de ~0,15 s, nota com mais de 0,2 s). */
  vibrato?: number;
  /** Quanto da nota vai para o eco (0..1). */
  send?: number;
}

const PULSE_HARMONICS = 24;
const pulseCache = new WeakMap<BaseAudioContext, PeriodicWave>();
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Frequência em Hz de uma nota MIDI (lá4 = 69 = 440 Hz). */
export const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Onda de pulso com ciclo de 25%, montada por série de Fourier e cacheada por contexto. */
export function pulseWave(ctx: BaseAudioContext): PeriodicWave {
  let pw = pulseCache.get(ctx);
  if (!pw) {
    const duty = 0.25;
    const real = new Float32Array(PULSE_HARMONICS + 1);
    const imag = new Float32Array(PULSE_HARMONICS + 1);
    for (let n = 1; n <= PULSE_HARMONICS; n++) {
      // Leve atenuação dos harmônicos altos para o som ficar macio.
      const soften = 1 / (1 + n * 0.06);
      real[n] = (Math.sin(2 * Math.PI * n * duty) / (n * Math.PI)) * soften;
      imag[n] = ((1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI)) * soften;
    }
    pw = ctx.createPeriodicWave(real, imag);
    pulseCache.set(ctx, pw);
  }
  return pw;
}

/** Buffer de ruído branco de 1 s (gerado uma vez por contexto, com semente fixa). */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    noiseCache.set(ctx, buf);
  }
  return buf;
}

function oscillator(ctx: BaseAudioContext, wave: Wave, freq: number, t: number): OscillatorNode {
  const o = ctx.createOscillator();
  if (wave === 'pulse25') o.setPeriodicWave(pulseWave(ctx));
  else o.type = wave;
  o.frequency.setValueAtTime(freq, t);
  return o;
}

/** Nota tonal com envelope ADSR simples e passa-baixa. `t` e `dur` são em segundos do relógio do contexto. */
export function tone(bus: Bus, t: number, freq: number, dur: number, o: ToneOpts): void {
  const { ctx } = bus;
  const attack = o.attack ?? 0.01;
  const decay = o.decay ?? 0.1;
  const sustain = o.sustain ?? 0.6;
  const release = o.release ?? 0.08;
  const cutoff = o.cutoff ?? 3000;
  const end = t + Math.max(dur, attack + decay);

  const osc = oscillator(ctx, o.wave, freq, t);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);

  if (o.vibrato && dur > 0.2) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(o.vibrato, t + 0.15);
    lfo.connect(depth).connect(osc.detune);
    lfo.start(t);
    lfo.stop(end + release + 0.05);
  }

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  filter.Q.value = 0.7;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(o.vol, t + attack);
  env.gain.linearRampToValueAtTime(o.vol * sustain, t + attack + decay);
  env.gain.setValueAtTime(o.vol * sustain, end);
  env.gain.linearRampToValueAtTime(0, end + release);

  osc.connect(filter).connect(env);
  env.connect(bus.out);
  if (o.send && o.send > 0 && bus.echo) {
    const s = ctx.createGain();
    s.gain.value = o.send;
    env.connect(s).connect(bus.echo);
  }
  osc.start(t);
  osc.stop(end + release + 0.02);
}

/** Bumbo: seno com queda rápida de afinação (150 Hz para 45 Hz). */
export function kick(bus: Bus, t: number, vol = 0.3): void {
  const ctx = bus.ctx;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(g).connect(bus.out);
  o.start(t);
  o.stop(t + 0.27);
}

/** Ruído com filtro e envelope curto: base de caixa, chimbal e efeitos. */
export function noiseHit(
  bus: Bus,
  t: number,
  dur: number,
  vol: number,
  type: BiquadFilterType,
  hz: number,
  q = 1,
  send = 0,
): void {
  const ctx = bus.ctx;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g);
  g.connect(bus.out);
  if (send > 0 && bus.echo) {
    const s = ctx.createGain();
    s.gain.value = send;
    g.connect(s).connect(bus.echo);
  }
  // Começa em um ponto diferente do buffer a cada batida para não soar idêntico.
  src.start(t, (t * 7.31) % 0.8, dur + 0.02);
  src.stop(t + dur + 0.05);
}

/** Caixa: ruído em bandpass no meio, com um corpo grave curto. */
export function snare(bus: Bus, t: number, vol = 0.12): void {
  noiseHit(bus, t, 0.14, vol, 'bandpass', 1900, 0.8, 0.1);
  tone(bus, t, 180, 0.05, { wave: 'triangle', vol: vol * 0.5, attack: 0.002, decay: 0.04, sustain: 0.1, release: 0.04, cutoff: 1200 });
}

/** Chimbal: ruído passa-alta, curto. */
export function hat(bus: Bus, t: number, vol = 0.035): void {
  noiseHit(bus, t, 0.035, vol, 'highpass', 8000, 0.7);
}

/** Eco simples: delay com realimentação filtrada. Devolve a entrada; a saída vai para `dest`. */
export function makeDelay(ctx: BaseAudioContext, dest: AudioNode, time: number, feedback: number, wet: number): AudioNode {
  const input = ctx.createGain();
  const delay = ctx.createDelay(2);
  delay.delayTime.value = time;
  const fb = ctx.createGain();
  fb.gain.value = feedback;
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 2200;
  const out = ctx.createGain();
  out.gain.value = wet;
  input.connect(delay).connect(damp).connect(fb).connect(delay);
  damp.connect(out).connect(dest);
  return input;
}
