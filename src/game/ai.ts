import { SEGMENT_LENGTH, type CarState, type Segment } from '../contracts';
import { MAX_SPEED } from './physics';

export interface Rival {
  car: CarState;
  /** Fração de MAX_SPEED que o piloto sustenta nas retas. */
  top: number;
  /** Coragem nas curvas: maior = freia mais tarde. */
  nerve: number;
  /** Faixa preferida na largada. */
  lane: number;
}

export const RIVAL_DEFS: { name: string; top: number; nerve: number }[] = [
  { name: 'M. Alvarenga', top: 0.955, nerve: 1.0 },
  { name: 'T. Brandt', top: 0.935, nerve: 0.95 },
  { name: 'L. Okafor', top: 0.915, nerve: 1.05 },
  { name: 'R. Vasquez', top: 0.89, nerve: 0.9 },
  { name: 'K. Lindqvist', top: 0.865, nerve: 0.85 },
];

export function createRival(i: number, z: number, x: number): Rival {
  const d = RIVAL_DEFS[i];
  return {
    car: { z, x, speed: 0, lap: 0, sprite: i, name: d.name, finished: false },
    top: d.top,
    nerve: d.nerve,
    lane: x,
  };
}

const LOOKAHEAD = 18;
const wrapDz = (dz: number, len: number) => (dz < 0 ? dz + len : dz);

/** Velocidade segura para a curva mais fechada nos próximos segmentos. */
function cornerSpeed(r: Rival, segments: Segment[]): { limit: number; curve: number } {
  const base = Math.floor(r.car.z / SEGMENT_LENGTH);
  let worst = 0;
  let curve = 0;
  for (let k = 0; k < LOOKAHEAD; k++) {
    const c = segments[(base + k) % segments.length].curve;
    // curvas mais próximas pesam mais
    const w = Math.abs(c) * (1 - k / (LOOKAHEAD * 1.6));
    if (w > worst) {
      worst = w;
      curve = c;
    }
  }
  const limit = MAX_SPEED * Math.max(0.3, 1 - worst * 0.1 * (2 - r.nerve));
  return { limit, curve };
}

/**
 * Passo da IA de um rival. `others` inclui jogador e demais rivais (exceto ele mesmo).
 * O avanço de z e a contagem de voltas ficam no race.ts.
 */
export function stepRival(r: Rival, others: CarState[], segments: Segment[], trackLength: number, dt: number, racing: boolean): void {
  const c = r.car;
  if (!racing) {
    c.speed = Math.max(0, c.speed - 4000 * dt);
    return;
  }
  const { limit, curve } = cornerSpeed(r, segments);
  let desired = Math.min(MAX_SPEED * r.top, limit);
  let targetX = curve !== 0 ? Math.sign(curve) * 0.35 : r.lane * 0.6;

  for (const o of others) {
    const dz = wrapDz(o.z - c.z, trackLength);
    if (dz > 0 && dz < 900 && Math.abs(o.x - c.x) < 0.38) {
      // desvia para o lado com mais espaço
      const dir = o.x > 0 ? -1 : 1;
      targetX = Math.max(-0.85, Math.min(0.85, o.x + dir * 0.42));
      if (dz < 280) desired = Math.min(desired, o.speed * 0.95);
    }
  }

  const rate = desired > c.speed ? 1000 * (1 - c.speed / (MAX_SPEED * 1.02)) + 120 : 4200;
  c.speed = c.speed < desired ? Math.min(desired, c.speed + rate * dt) : Math.max(desired, c.speed - rate * dt);
  const dx = targetX - c.x;
  c.x += Math.max(-0.7 * dt, Math.min(0.7 * dt, dx));
  c.z += c.speed * dt;
}
