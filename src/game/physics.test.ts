import { type CarState, type Segment } from '../contracts';
import { createDynamics, gearForSpeed, GEARS, MAX_SPEED, stepPlayer, toKmh, type Controls } from './physics';

const car = (x: number, speed: number): CarState => ({ z: 0, x, speed, lap: 1, sprite: -1, name: 'P', finished: false });
const seg: Segment = { index: 0, curve: 0, y1: 0, y2: 0, sectionName: 't', props: [], kerb: false };
const full: Controls = { steer: 0, throttle: 1, brake: 0, handbrake: false };

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

  it('fora da pista fica mais lento que na pista', () => {
    const on = car(0, 3000);
    const off = car(1.5, 3000);
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
    for (let i = 0; i < 60 * 40; i++) stepPlayer(c, d, full, 1 / 60, seg);
    expect(toKmh(c.speed)).toBeGreaterThan(300);
    expect(toKmh(c.speed)).toBeLessThanOrEqual(330);
  });

  it('curva empurra o carro para fora', () => {
    const c = car(0, 4000);
    stepPlayer(c, createDynamics(), { ...full, throttle: 0 }, 1 / 60, { ...seg, curve: 4 });
    expect(c.x).toBeLessThan(0);
  });
});
