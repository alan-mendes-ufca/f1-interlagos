import { buildTrack } from './build';
import { sampleTrack } from './sample';
import { SEGMENT_LENGTH } from '../contracts';

describe('buildTrack', () => {
  const t = buildTrack(sampleTrack);
  const expected = sampleTrack.sections.reduce((n, s) => n + s.length, 0);

  it('gera o número esperado de segmentos e comprimento', () => {
    expect(t.segments).toHaveLength(expected);
    expect(t.length).toBe(expected * SEGMENT_LENGTH);
    expect(t.segments.every((s, i) => s.index === i)).toBe(true);
  });

  it('fecha a altura em 0 e é contínuo', () => {
    expect(t.segments[0].y1).toBeCloseTo(0);
    expect(t.segments[t.segments.length - 1].y2).toBeCloseTo(0);
    for (let i = 1; i < t.segments.length; i++) expect(t.segments[i].y1).toBeCloseTo(t.segments[i - 1].y2);
  });

  it('corrige morros que não fecham sozinhos', () => {
    const r = buildTrack({ name: 'x', startSegment: 0, sections: [{ name: 'a', length: 10, curve: 0, hill: 5000 }, { name: 'b', length: 10, curve: 0, hill: 0 }] });
    expect(r.segments[19].y2).toBeCloseTo(0);
  });

  it('liga kerb apenas quando |curve| > 2', () => {
    for (const s of t.segments) expect(s.kerb).toBe(Math.abs(s.curve) > 2);
    expect(t.segments.some((s) => s.kerb)).toBe(true);
    expect(t.segments.some((s) => !s.kerb)).toBe(true);
  });

  it('distribui props por every', () => {
    expect(t.segments[0].props.length).toBeGreaterThan(0);
    expect(t.segments[1].props).toHaveLength(0);
  });
});
