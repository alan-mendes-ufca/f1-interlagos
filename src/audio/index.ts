// Ponto de entrada da trilha e dos efeitos. Implementa o contrato `Soundtrack` de src/contracts.ts.
// Tudo é sintetizado com Web Audio. Sem Web Audio, todos os métodos são no-op e nunca lançam exceção.

import type { Soundtrack } from '../contracts';
import { Engine } from './engine';
import { MusicPlayer, type Track } from './music';
import { playSfx, type SfxName } from './sfx';
import type { Bus } from './synth';

/** Volume do mestre (ganho linear). Moderado para a música não abafar o motor. */
const MASTER_VOL = 0.7;
/** Volume do barramento de música, abaixo do motor e dos efeitos. */
const MUSIC_BUS_VOL = 0.4;
const MUTE_FADE = 0.05;

type WebAudioGlobals = {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

export function createSoundtrack(): Soundtrack {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let player: MusicPlayer | null = null;
  let engine: Engine | null = null;
  let effects: Bus | null = null;
  let started = false;
  let muted = false;
  let wantTrack: Track = 'menu';
  let rpm = 0;
  let speed = 0;

  /** Cria o contexto e o grafo de áudio uma única vez. Devolve false se não houver Web Audio. */
  function build(): boolean {
    if (ctx) return true;
    try {
      const g = globalThis as unknown as WebAudioGlobals;
      const Ctor = g.AudioContext ?? g.webkitAudioContext;
      if (!Ctor) return false;
      const c = new Ctor();
      const m = c.createGain();
      m.gain.value = muted ? 0 : MASTER_VOL;
      m.connect(c.destination);

      const musicOut = c.createGain();
      musicOut.gain.value = MUSIC_BUS_VOL;
      musicOut.connect(m);

      const engineOut = c.createGain();
      engineOut.gain.value = 1;
      engineOut.connect(m);

      ctx = c;
      master = m;
      player = new MusicPlayer(c, musicOut);
      engine = new Engine(c, engineOut);
      effects = { ctx: c, out: m, echo: null };
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  return {
    start(): void {
      try {
        if (!build() || !ctx) return;
        if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
        if (started) return;
        started = true;
        engine?.set(rpm, speed);
        engine?.start();
        player?.play(wantTrack);
      } catch {
        /* sem áudio: segue mudo */
      }
    },

    setMuted(m: boolean): void {
      muted = !!m;
      try {
        if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime, MUTE_FADE);
      } catch {
        /* ignora */
      }
    },

    get muted(): boolean {
      return muted;
    },

    setTrack(track: 'menu' | 'race' | 'finish'): void {
      wantTrack = track;
      try {
        if (started) player?.play(track);
      } catch {
        /* ignora */
      }
    },

    setEngine(r: number, s: number): void {
      rpm = Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0;
      speed = Number.isFinite(s) ? Math.min(1, Math.max(0, s)) : 0;
      try {
        engine?.set(rpm, speed);
      } catch {
        /* ignora */
      }
    },

    sfx(name: SfxName): void {
      try {
        if (started && effects) playSfx(effects, name);
      } catch {
        /* ignora */
      }
    },
  };
}
