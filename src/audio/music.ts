// Trilha synthwave chiptune (estilo 80's Overdrive / Outrun), em lá menor.
//
// Parte pura (sem Web Audio): tabela de notas, progressão, frases e padrões de 16 compassos.
// Parte de execução (MusicPlayer): agenda as notas com o relógio do AudioContext, em lookahead,
// e troca de faixa com crossfade.

import { hat, kick, makeDelay, midiToFreq, snare, tone, type Bus, type ToneOpts } from './synth';

export type Track = 'menu' | 'race' | 'finish';

/** Instrumentos da trilha. `pluck` é o arpejo calmo do menu; `arp` é o arpejo quadrado da corrida. */
export type Instrument = 'bass' | 'arp' | 'pluck' | 'lead' | 'pad' | 'kick' | 'snare' | 'hat';

// --------------------------------------------------------------------------
// Notas
// --------------------------------------------------------------------------

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Nota por nome (ex.: "A4", "C#5", "Bb3") para número MIDI. A4 = 69. */
export function noteToMidi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Nota inválida: ${name}`);
  const alter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + PITCH_CLASS[m[1]] + alter;
}

/** Frequência em Hz de uma nota pelo nome (ex.: noteFreq('A4') === 440). */
export function noteFreq(name: string): number {
  return midiToFreq(noteToMidi(name));
}

/** Tabela nota → frequência para as oitavas 2 a 6 (com sustenidos), montada a partir de noteFreq. */
export const NOTE_TABLE: Record<string, number> = (() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const table: Record<string, number> = {};
  for (let oct = 2; oct <= 6; oct++) {
    names.forEach((n) => {
      const name = `${n}${oct}`;
      table[name] = noteFreq(name);
    });
  }
  return table;
})();

// --------------------------------------------------------------------------
// Harmonia e forma
// --------------------------------------------------------------------------

export const STEPS_PER_BAR = 16;
/** Loop de 16 compassos: seção A (compassos 0-7) e seção B (8-15). */
export const LOOP_BARS = 16;

export interface Chord {
  name: string;
  /** Nota do baixo (MIDI). */
  root: number;
  /** Intervalos das notas do acorde em relação à raiz (semitons). */
  tones: readonly number[];
}

/** Progressão Am - F - C - G, um acorde por compasso e repetida 4 vezes no loop. */
export const PROGRESSION: readonly Chord[] = [
  { name: 'Am', root: noteToMidi('A2'), tones: [0, 3, 7] },
  { name: 'F', root: noteToMidi('F2'), tones: [0, 4, 7] },
  { name: 'C', root: noteToMidi('C2'), tones: [0, 4, 7] },
  { name: 'G', root: noteToMidi('G2'), tones: [0, 4, 7] },
];

/** Notas do acorde na oitava do pad e do arpejo (raiz + 12 semitons). */
export function voicing(c: Chord): number[] {
  return c.tones.map((t) => c.root + 12 + t);
}

/** Ordem do arpejo: sobe, desce um degrau e volta ao centro (0,1,2,1). */
const ARP_ORDER = [0, 1, 2, 1];

export function sectionOf(bar: number): 'A' | 'B' {
  return bar % LOOP_BARS < LOOP_BARS / 2 ? 'A' : 'B';
}

// --------------------------------------------------------------------------
// Melodia: frases de 4 compassos, uma por acorde. Cada token é "NOTA:passos" (passos de 1/16).
// Cada compasso soma 16 passos.
// --------------------------------------------------------------------------

/** Seção A: gancho principal, em oitava 4-5. */
export const LEAD_A: readonly string[] = [
  'A5:4 E5:2 C5:2 D5:4 E5:4',
  'C5:4 A4:2 C5:2 F5:4 E5:4',
  'E5:4 G5:2 E5:2 D5:4 C5:4',
  'B4:4 D5:4 G5:4 D5:4',
];

/** Seção B: resposta mais aguda e com mais movimento. */
export const LEAD_B: readonly string[] = [
  'E6:2 D6:2 C6:2 A5:2 E5:4 A5:4',
  'F5:2 A5:2 C6:2 A5:2 F5:2 G5:2 A5:4',
  'G5:2 E5:2 G5:2 C6:2 E6:4 D6:4',
  'D6:2 B5:2 G5:2 D5:2 B4:4 G4:4',
];

export interface LeadNote {
  step: number;
  steps: number;
  midi: number;
}

/** Converte uma frase de um compasso em notas com posição (passo inicial) e duração. */
export function parseBar(bar: string): LeadNote[] {
  const out: LeadNote[] = [];
  let step = 0;
  for (const token of bar.trim().split(/\s+/)) {
    const [name, len] = token.split(':');
    const steps = Number(len);
    out.push({ step, steps, midi: noteToMidi(name) });
    step += steps;
  }
  return out;
}

// --------------------------------------------------------------------------
// Padrões
// --------------------------------------------------------------------------

export interface NoteEvent {
  /** Posição dentro do compasso, em passos de 1/16. */
  step: number;
  /** Duração em passos de 1/16. */
  steps: number;
  kind: Instrument;
  /** Nota MIDI (sem significado para bateria). */
  midi: number;
  /** Multiplicador de volume (0..1). */
  vel: number;
}

export type LoopTrack = Exclude<Track, 'finish'>;

/** Andamento de cada faixa em batidas por minuto. */
export const BPM: Record<LoopTrack, number> = { race: 120, menu: 90 };

/** Eventos de um compasso (índice dentro do loop de 16) da faixa indicada. */
export function barEvents(track: LoopTrack, bar: number): NoteEvent[] {
  const b = ((bar % LOOP_BARS) + LOOP_BARS) % LOOP_BARS;
  const chord = PROGRESSION[b % PROGRESSION.length];
  const section = sectionOf(b);
  const chordNotes = voicing(chord);
  const events: NoteEvent[] = [];

  if (track === 'race') {
    // Baixo em oitavas pulsando em colcheias (8 notas no compasso).
    for (let i = 0; i < 8; i++) {
      events.push({ step: i * 2, steps: 2, kind: 'bass', midi: chord.root + (i % 2) * 12, vel: 1 });
    }
    // Arpejo quadrado em semicolcheias, uma oitava acima do pad.
    for (let i = 0; i < STEPS_PER_BAR; i++) {
      events.push({
        step: i,
        steps: 1,
        kind: 'arp',
        midi: chordNotes[ARP_ORDER[i % ARP_ORDER.length] % chordNotes.length] + 12,
        vel: section === 'B' ? 0.9 : 0.75,
      });
    }
    // Lead: gancho da seção A ou resposta da B.
    const phrase = section === 'A' ? LEAD_A : LEAD_B;
    for (const n of parseBar(phrase[b % 4])) {
      events.push({ step: n.step, steps: n.steps, kind: 'lead', midi: n.midi, vel: section === 'B' ? 1 : 0.85 });
    }
    // Bateria: bumbo, caixa no 2 e no 4 (passos 4 e 12), chimbal em colcheias.
    for (const s of [0, 8, 10]) events.push({ step: s, steps: 1, kind: 'kick', midi: 0, vel: 1 });
    for (const s of [4, 12]) events.push({ step: s, steps: 1, kind: 'snare', midi: 0, vel: 1 });
    for (let s = 0; s < STEPS_PER_BAR; s += 2) events.push({ step: s, steps: 1, kind: 'hat', midi: 0, vel: 1 });
    if (section === 'B') {
      // Seção B ganha chimbal nas semicolcheias entre as colcheias, mais baixo.
      for (let s = 1; s < STEPS_PER_BAR; s += 2) events.push({ step: s, steps: 1, kind: 'hat', midi: 0, vel: 0.5 });
    }
  } else {
    // Menu: pad sustentado do acorde e arpejo calmo em colcheias, sem bateria.
    for (const midi of chordNotes) {
      events.push({ step: 0, steps: STEPS_PER_BAR, kind: 'pad', midi, vel: 0.8 });
    }
    for (let i = 0; i < 8; i++) {
      events.push({
        step: i * 2,
        steps: 2,
        kind: 'pluck',
        midi: chordNotes[ARP_ORDER[i % ARP_ORDER.length] % chordNotes.length] + 12,
        vel: 0.8,
      });
    }
  }
  return events;
}

/** Loop completo de 16 compassos: uma lista de eventos por compasso. */
export function buildLoop(track: LoopTrack): NoteEvent[][] {
  return Array.from({ length: LOOP_BARS }, (_, bar) => barEvents(track, bar));
}

/** Vinheta de vitória (~3 s), em segundos desde o início. Arpejo de lá maior e acorde final. */
export const FINISH_NOTES: readonly { t: number; dur: number; midi: number; kind: 'lead' | 'pad' }[] = [
  { t: 0, dur: 0.18, midi: noteToMidi('A4'), kind: 'lead' },
  { t: 0.2, dur: 0.18, midi: noteToMidi('C#5'), kind: 'lead' },
  { t: 0.4, dur: 0.18, midi: noteToMidi('E5'), kind: 'lead' },
  { t: 0.6, dur: 0.4, midi: noteToMidi('A5'), kind: 'lead' },
  { t: 1.0, dur: 1.9, midi: noteToMidi('A4'), kind: 'pad' },
  { t: 1.0, dur: 1.9, midi: noteToMidi('C#5'), kind: 'pad' },
  { t: 1.0, dur: 1.9, midi: noteToMidi('E5'), kind: 'pad' },
];

// --------------------------------------------------------------------------
// Execução (Web Audio)
// --------------------------------------------------------------------------

const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const CROSSFADE = 0.5;
const TRACK_VOL: Record<Track, number> = { race: 0.9, menu: 0.8, finish: 0.9 };
const LOOPS: Record<LoopTrack, NoteEvent[][]> = { race: buildLoop('race'), menu: buildLoop('menu') };

/** Timbres das notas tonais (volume de pico antes do multiplicador de cada nota). */
const PITCHED: Record<'bass' | 'arp' | 'pluck' | 'lead' | 'pad', ToneOpts> = {
  bass: { wave: 'sawtooth', vol: 0.16, attack: 0.005, decay: 0.12, sustain: 0.6, release: 0.05, cutoff: 700 },
  arp: { wave: 'square', vol: 0.035, attack: 0.002, decay: 0.05, sustain: 0.3, release: 0.03, cutoff: 2600, send: 0.15 },
  pluck: { wave: 'triangle', vol: 0.07, attack: 0.004, decay: 0.12, sustain: 0.25, release: 0.12, cutoff: 2200, send: 0.2 },
  lead: { wave: 'pulse25', vol: 0.07, attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.1, cutoff: 3200, vibrato: 14, send: 0.35 },
  pad: { wave: 'triangle', vol: 0.05, attack: 0.4, decay: 0.5, sustain: 0.8, release: 0.6, cutoff: 1400, send: 0.2 },
};

/** Toca um evento. `t` e `dur` em segundos do relógio do contexto. */
function playNote(bus: Bus, t: number, dur: number, kind: Instrument, midi: number, vel: number): void {
  switch (kind) {
    case 'kick':
      kick(bus, t, 0.3 * vel);
      return;
    case 'snare':
      snare(bus, t, 0.1 * vel);
      return;
    case 'hat':
      hat(bus, t, 0.03 * vel);
      return;
    default: {
      const o = PITCHED[kind];
      tone(bus, t, midiToFreq(midi), dur, { ...o, vol: o.vol * vel });
    }
  }
}

interface Voice {
  track: Track;
  gain: GainNode;
  bus: Bus;
  /** Próximo compasso a agendar (tempo do contexto). */
  next: number;
  bar: number;
  barLen: number;
  stepLen: number;
  loop: LoopTrack | null;
}

/**
 * Sequenciador: um lookahead em relógio de áudio. Um setInterval só acorda o agendador;
 * as notas são agendadas com tempos do AudioContext, não disparadas no JavaScript.
 */
export class MusicPlayer {
  private voice: Voice | null = null;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(private readonly ctx: BaseAudioContext, private readonly out: AudioNode) {
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Troca a faixa com crossfade. Pedir a mesma faixa que já toca não faz nada. */
  play(track: Track): void {
    if (this.voice?.track === track) return;
    const now = this.ctx.currentTime;
    const old = this.voice;
    if (old) {
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE);
      setTimeout(() => old.gain.disconnect(), (CROSSFADE + 0.3) * 1000);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(TRACK_VOL[track], now + CROSSFADE);
    gain.connect(this.out);

    const bpm = track === 'finish' ? BPM.race : BPM[track];
    const beat = 60 / bpm;
    const echo = makeDelay(this.ctx, gain, beat * 0.75, 0.35, 0.3);
    const barLen = beat * 4;
    const start = now + 0.05;
    const bus: Bus = { ctx: this.ctx, out: gain, echo };
    const v: Voice = {
      track,
      gain,
      bus,
      next: start,
      bar: 0,
      barLen,
      stepLen: barLen / STEPS_PER_BAR,
      loop: track === 'finish' ? null : track,
    };
    this.voice = v;

    if (track === 'finish') {
      // Vinheta: agenda tudo de uma vez, com tempos absolutos; depois, silêncio.
      for (const n of FINISH_NOTES) {
        playNote(bus, start + n.t, n.dur, n.kind, n.midi, 1);
      }
    }
  }

  /** Agenda os compassos que caem na janela de lookahead. Público para testes manuais. */
  tick(): void {
    const v = this.voice;
    if (!v || v.loop === null || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Aba em segundo plano ou pausa longa: reposiciona em vez de tocar tudo atrasado de uma vez.
    if (v.next < now - 0.5) v.next = now + 0.05;
    while (v.next < now + LOOKAHEAD) {
      const events = LOOPS[v.loop][v.bar % LOOP_BARS];
      for (const ev of events) {
        const t = v.next + ev.step * v.stepLen;
        const dur = ev.steps * v.stepLen;
        playNote(v.bus, t, dur, ev.kind, ev.midi, ev.vel);
      }
      v.next += v.barLen;
      v.bar++;
    }
  }

  dispose(): void {
    clearInterval(this.timer);
    this.voice?.gain.disconnect();
    this.voice = null;
  }
}
