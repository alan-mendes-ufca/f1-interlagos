import geoJson from '../track/data/interlagos-geo.json';
import { SEGMENT_LENGTH, UNITS_PER_METER, type CarState, type Segment } from '../contracts';
import { buildSegmentsFromGeometry, cornerDetails, loadGeometry } from '../track/geometry';
import {
  cornerLimit, createDynamics, gearForSpeed, GEARS, lateralGrip, lateralModel, MAX_SPEED, stepPlayer, toKmh, toMs, type Controls,
} from './physics';
import { buildSpeedProfile } from './profile';

const car = (x: number, speed: number): CarState => ({ z: 0, x, speed, lap: 1, sprite: -1, name: 'P', finished: false });
const seg: Segment = { index: 0, curve: 0, y1: 0, y2: 0, sectionName: 't', props: [], kerb: false, radiusMeters: Infinity };
const full: Controls = { steer: 0, throttle: 1, brake: 0, handbrake: false };

const geo = loadGeometry(geoJson);
const { segments, length } = buildSegmentsFromGeometry(geo);
const corners = cornerDetails(geo);
const limitAt = (turn: number) => {
  const c = corners[turn - 1];
  let best = Infinity;
  for (let i = c.apexIndex - 2; i <= c.apexIndex + 2; i++) best = Math.min(best, cornerLimit(segments[i].radiusMeters ?? Infinity));
  return best * 3.6;
};

describe('física', () => {
  it('câmbio é monotônico e limitado a 1..8', () => {
    let prev = 0;
    for (let v = 0; v <= MAX_SPEED; v += 10) {
      const g = gearForSpeed(v);
      expect(g).toBeGreaterThanOrEqual(prev);
      expect(g).toBeGreaterThanOrEqual(1);
      expect(g).toBeLessThanOrEqual(GEARS);
      prev = g;
    }
    expect(gearForSpeed(MAX_SPEED)).toBe(GEARS);
  });

  it('aderência chega a ~4-5 g a 250 km/h', () => {
    expect(lateralGrip(250 / 3.6) / 9.81).toBeGreaterThan(3.8);
    expect(lateralGrip(250 / 3.6) / 9.81).toBeLessThan(5.2);
  });

  it('fora da pista fica muito mais lento que na pista', () => {
    const on = car(0, 60 * UNITS_PER_METER);
    const off = car(1.5, 60 * UNITS_PER_METER);
    const d1 = createDynamics();
    const d2 = createDynamics();
    for (let i = 0; i < 120; i++) {
      stepPlayer(on, d1, full, 1 / 60, seg);
      stepPlayer(off, d2, full, 1 / 60, seg);
    }
    expect(off.speed).toBeLessThan(on.speed * 0.6);
  });

  it('acelera até perto da velocidade máxima (~330 km/h)', () => {
    const c = car(0, 0);
    const d = createDynamics();
    for (let i = 0; i < 60 * 45; i++) stepPlayer(c, d, full, 1 / 60, seg);
    expect(toKmh(c.speed)).toBeGreaterThan(310);
    expect(toKmh(c.speed)).toBeLessThanOrEqual(330.01);
  });

  it('acima do limite de aderência o carro escorrega para fora', () => {
    const curve: Segment = { ...seg, curve: 4, radiusMeters: 40 };
    const fast = car(0, 80 * UNITS_PER_METER);
    const slow = car(0, 20 * UNITS_PER_METER);
    stepPlayer(fast, createDynamics(), { ...full, throttle: 0 }, 0.5, curve);
    stepPlayer(slow, createDynamics(), { ...full, throttle: 0 }, 0.5, curve);
    expect(fast.x).toBeLessThan(slow.x - 0.05);
    expect(fast.x).toBeLessThan(0);
    expect(lateralModel(80, curve).slip).toBeGreaterThan(0);
    expect(lateralModel(20, curve).slip).toBe(0);
  });

  it('frenagem forte em alta e menor em baixa velocidade', () => {
    const hi = car(0, 90 * UNITS_PER_METER);
    const lo = car(0, 20 * UNITS_PER_METER);
    const b: Controls = { steer: 0, throttle: 0, brake: 1, handbrake: false };
    stepPlayer(hi, createDynamics(), b, 0.2, seg);
    stepPlayer(lo, createDynamics(), b, 0.2, seg);
    const dHi = (90 - toMs(hi.speed)) / 0.2;
    const dLo = (20 - toMs(lo.speed)) / 0.2;
    expect(dHi / 9.81).toBeGreaterThan(4.3);
    expect(dLo / 9.81).toBeGreaterThan(2.2);
    expect(dLo / 9.81).toBeLessThan(3.2);
  });
});

describe('perfil de curvas', () => {
  it('v_max(Bico de Pato) < v_max(Junção)', () => {
    const bico = limitAt(10);
    const juncao = limitAt(12);
    expect(corners[9].name).toBe('Bico de Pato');
    expect(corners[11].name).toBe('Junção');
    expect(bico).toBeLessThan(juncao);
  });

  it('Bico de Pato é a curva mais lenta e fica abaixo de ~100 km/h', () => {
    const all = corners.map((_, i) => limitAt(i + 1));
    expect(limitAt(10)).toBeLessThan(100);
    expect(limitAt(10)).toBe(Math.min(...all));
  });
});

/** Piloto perfeito: segue o perfil de v_max com frenagem antecipada e segura a pista no centro. */
function perfectLap(): { time: number; maxSlip: number; minX: number; maxX: number } {
  const profile = buildSpeedProfile(segments, 1, 0.85);
  const c: CarState = { z: 0, x: 0, speed: 0, lap: 1, sprite: -1, name: 'P', finished: false };
  const d = createDynamics();
  const dt = 1 / 60;
  let t = 0;
  let maxSlip = 0;
  let minX = 0;
  let maxX = 0;
  // uma volta de aquecimento lançada + uma volta cronometrada
  for (let laps = 0; laps < 2; laps++) {
    const startT = t;
    let lapZ = 0;
    while (lapZ < length) {
      const i = Math.floor(c.z / SEGMENT_LENGTH) % segments.length;
      const s = segments[i];
      const v = toMs(c.speed);
      // olha ~10 m à frente para a frenagem não chegar atrasada
      const target = Math.min(profile[i], profile[(i + 1) % segments.length], profile[(i + 2) % segments.length]);
      const lm = lateralModel(v, s);
      const ctrl: Controls = {
        throttle: v < target ? 1 : 0,
        brake: v > target + 0.3 ? 1 : 0,
        handbrake: false,
        steer: Math.max(-1, Math.min(1, (-c.x * 7 * 2 - lm.outward * lm.drift) / Math.max(0.5, lm.authority))),
      };
      const z0 = c.z;
      stepPlayer(c, d, ctrl, dt, s);
      lapZ += c.z - z0;
      if (c.z >= length) c.z -= length;
      t += dt;
      maxSlip = Math.max(maxSlip, d.slip);
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      if (t > 400) throw new Error('volta não fecha');
    }
    if (laps === 1) return { time: t - startT, maxSlip, minX, maxX };
  }
  throw new Error('inalcançável');
}

describe('piloto perfeito', () => {
  it('fecha a volta entre 1:15 e 1:25 sem escorregar nem sair da pista', () => {
    const r = perfectLap();
    expect(r.time).toBeGreaterThan(75);
    expect(r.time).toBeLessThan(85);
    expect(r.maxSlip).toBeLessThan(0.15);
    expect(Math.abs(r.minX)).toBeLessThan(1);
    expect(Math.abs(r.maxX)).toBeLessThan(1);
  });
});
