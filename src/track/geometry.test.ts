import geoJson from './data/interlagos-geo.json';
import { SEGMENT_METERS, SEGMENT_LENGTH } from '../contracts';
import { buildSegmentsFromGeometry, cornerDetails, EXPECTED_SIDES, loadGeometry } from './geometry';

const geo = loadGeometry(geoJson);
const corners = cornerDetails(geo);
const built = buildSegmentsFromGeometry(geo);

describe('geometria de Interlagos', () => {
  it('comprimento ~4308 m', () => {
    expect(Math.abs(geo.lengthMeters - 4308)).toBeLessThan(20);
    expect(Math.abs(built.length / (SEGMENT_LENGTH / SEGMENT_METERS) - 4308)).toBeLessThan(20);
    expect(built.segments).toHaveLength(geo.points.length);
  });

  it('detecta 15 curvas (±1), maioria à esquerda', () => {
    expect(Math.abs(geo.corners.length - 15)).toBeLessThanOrEqual(1);
    const left = corners.filter((c) => c.side === 'E').length;
    expect(left).toBeGreaterThan(corners.length / 2);
  });

  it('segue a sequência oficial de lados e nomes', () => {
    expect(corners.map((c) => c.side).join('')).toBe(EXPECTED_SIDES);
    expect(corners[0].name).toBe('S do Senna');
    expect(corners[9].name).toBe('Bico de Pato');
  });

  it('largada ~350 m antes do ápice da curva 1', () => {
    expect(geo.corners[0].apexMeters).toBeGreaterThan(330);
    expect(geo.corners[0].apexMeters).toBeLessThan(370);
  });

  it('S do Senna começa virando à esquerda no jogo (curve < 0)', () => {
    const c1 = corners[0];
    const seg = built.segments[c1.apexIndex];
    expect(seg.curve).toBeLessThan(-2);
    const c2 = built.segments[corners[1].apexIndex];
    expect(c2.curve).toBeGreaterThan(2);
  });

  it('Bico de Pato é grampo e o mais fechado', () => {
    const bico = corners[9];
    expect(bico.radius).toBeLessThan(40);
    expect(Math.min(...corners.map((c) => c.radius))).toBeGreaterThan(bico.radius - 6);
  });

  it('segmentos têm metros, raio e nome', () => {
    for (const s of built.segments) {
      expect(s.meters).toBe(s.index * SEGMENT_METERS);
      expect(s.radiusMeters).toBeGreaterThan(0);
      expect(s.sectionName.length).toBeGreaterThan(0);
    }
    expect(built.segments[0].sectionName).toBe('Reta dos Boxes');
  });
});
