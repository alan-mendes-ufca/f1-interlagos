// Ronco do motor: dois osciladores levemente desafinados (dente de serra e quadrada) mais ruído filtrado.
// A frequência vai de ~60 Hz (rpm 0) a ~420 Hz (rpm 1) e o volume sobe com a velocidade.

import { noiseBuffer } from './synth';

const FREQ_MIN = 60;
const FREQ_MAX = 420;
/** Constante de tempo da suavização, em segundos. */
const SMOOTH = 0.08;

interface EngineNodes {
  saw: OscillatorNode;
  square: OscillatorNode;
  lowpass: BiquadFilterNode;
  body: GainNode;
  noise: AudioBufferSourceNode;
  noiseBand: BiquadFilterNode;
  noiseGain: GainNode;
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export class Engine {
  private nodes: EngineNodes | null = null;
  private rpm = 0;
  private speed = 0;

  constructor(private readonly ctx: BaseAudioContext, private readonly out: AudioNode) {}

  /** Cria e liga os nós. Idempotente. */
  start(): void {
    if (this.nodes) return;
    const ctx = this.ctx;

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    const square = ctx.createOscillator();
    square.type = 'square';
    // Desafinação leve entre as duas ondas: é isso que dá o "batimento" do motor.
    square.detune.value = 6;

    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.Q.value = 1.2;
    const body = ctx.createGain();
    saw.connect(mix);
    square.connect(mix);
    mix.connect(lowpass).connect(body).connect(this.out);

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    noise.loop = true;
    const noiseBand = ctx.createBiquadFilter();
    noiseBand.type = 'bandpass';
    noiseBand.Q.value = 1.5;
    const noiseGain = ctx.createGain();
    noise.connect(noiseBand).connect(noiseGain).connect(body);

    this.nodes = { saw, square, lowpass, body, noise, noiseBand, noiseGain };
    this.apply(false);
    saw.start();
    square.start();
    noise.start();
  }

  /** Ronco por frame: rpm 0..1, speed 0..1. Valores fora da faixa são limitados. */
  set(rpm: number, speed: number): void {
    this.rpm = clamp01(rpm);
    this.speed = clamp01(speed);
    if (this.nodes) this.apply(true);
  }

  private apply(smooth: boolean): void {
    const n = this.nodes;
    if (!n) return;
    const t = this.ctx.currentTime;
    const hz = FREQ_MIN + (FREQ_MAX - FREQ_MIN) * this.rpm;
    const level = 0.02 + 0.1 * this.speed + 0.03 * this.rpm;
    const noiseLevel = 0.004 + 0.025 * this.speed;
    const cutoff = 300 + 1400 * this.rpm;
    const band = 400 + 1500 * this.rpm;

    if (smooth) {
      n.saw.frequency.setTargetAtTime(hz, t, SMOOTH);
      n.square.frequency.setTargetAtTime(hz, t, SMOOTH);
      n.lowpass.frequency.setTargetAtTime(cutoff, t, SMOOTH);
      n.body.gain.setTargetAtTime(level, t, SMOOTH);
      n.noiseBand.frequency.setTargetAtTime(band, t, SMOOTH);
      n.noiseGain.gain.setTargetAtTime(noiseLevel, t, SMOOTH);
    } else {
      n.saw.frequency.value = hz;
      n.square.frequency.value = hz;
      n.lowpass.frequency.value = cutoff;
      n.body.gain.value = level;
      n.noiseBand.frequency.value = band;
      n.noiseGain.gain.value = noiseLevel;
    }
  }
}
