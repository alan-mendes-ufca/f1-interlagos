import { LEAD_A, LEAD_B, LOOP_BARS, NOTE_TABLE, buildLoop, noteFreq, noteToMidi, parseBar, PROGRESSION, FINISH_NOTES } from './music';

describe('notas', () => {
  it('lá4 é 440 Hz e MIDI 69', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteFreq('A4')).toBeCloseTo(440, 6);
  });

  it('oitava acima dobra a frequência', () => {
    expect(noteFreq('A5')).toBeCloseTo(880, 6);
    expect(noteFreq('A3')).toBeCloseTo(220, 6);
  });

  it('dó4 e sustenidos batem com a tabela temperada', () => {
    expect(noteFreq('C4')).toBeCloseTo(261.6256, 3);
    expect(noteFreq('C#5')).toBeCloseTo(554.3653, 3);
    expect(noteToMidi('Bb3')).toBe(noteToMidi('A#3'));
  });

  it('tabela cobre as oitavas 2 a 6 com lá4 = 440', () => {
    expect(NOTE_TABLE['A4']).toBeCloseTo(440, 6);
    expect(Object.keys(NOTE_TABLE)).toHaveLength(5 * 12);
  });

  it('nota inválida lança erro', () => {
    expect(() => noteToMidi('H4')).toThrow();
  });
});

describe('forma da música', () => {
  it('o loop tem 16 compassos, com seções A e B de 8', () => {
    expect(LOOP_BARS).toBe(16);
    expect(buildLoop('race')).toHaveLength(16);
    expect(buildLoop('menu')).toHaveLength(16);
  });

  it('a progressão é Am F C G', () => {
    expect(PROGRESSION.map((c) => c.name)).toEqual(['Am', 'F', 'C', 'G']);
  });

  it('cada frase de melodia soma 16 passos por compasso', () => {
    for (const phrase of [LEAD_A, LEAD_B]) {
      expect(phrase).toHaveLength(4);
      for (const bar of phrase) {
        const notes = parseBar(bar);
        const total = notes.reduce((s, n) => s + n.steps, 0);
        expect(total).toBe(16);
      }
    }
  });

  it('a faixa de corrida tem bateria e a de menu não', () => {
    const race = buildLoop('race').flat();
    const menu = buildLoop('menu').flat();
    expect(race.some((e) => e.kind === 'kick')).toBe(true);
    expect(menu.some((e) => e.kind === 'kick' || e.kind === 'snare' || e.kind === 'hat')).toBe(false);
  });

  it('eventos ficam dentro do compasso', () => {
    for (const bar of buildLoop('race')) {
      for (const e of bar) {
        expect(e.step).toBeGreaterThanOrEqual(0);
        expect(e.step + e.steps).toBeLessThanOrEqual(16);
      }
    }
  });

  it('a vinheta de vitória dura cerca de 3 s', () => {
    const end = Math.max(...FINISH_NOTES.map((n) => n.t + n.dur));
    expect(end).toBeGreaterThan(2.5);
    expect(end).toBeLessThan(3.5);
  });
});
