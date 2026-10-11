import { ROAD_HALF_WIDTH_METERS, SEGMENT_LENGTH, UNITS_PER_METER, type CarState, type Segment } from '../contracts';
import { MAX_SPEED_MS, stepToward, toMs, toUnits } from './physics';
import { buildRacingLine, buildSpeedProfile } from './profile';

export interface Rival {
  car: CarState;
  /** Habilidade 0,92..0,99: fração do limite de aderência e da velocidade de ponta. */
  skill: number;
  /** Perfil de velocidade (m/s) por segmento, já com a antecipação da frenagem. */
  profile: number[];
  /** Relógio interno (s). */
  clock: number;
  rng: () => number;
  /** Lateral escolhido para ultrapassar e até quando manter. */
  passX: number;
  passUntil: number;
  /** Defesa de posição: lado interno da próxima curva e até quando. */
  defendX: number;
  defendUntil: number;
  defendedThisStraight: boolean;
  /** Erro ocasional: até quando e para que lado (+1 = direita) o carro vai largo. */
  errorUntil: number;
  errorSide: number;
}

/** Pista compartilhada pelos rivais: segmentos e linha de corrida. */
export interface AiTrack {
  segments: Segment[];
  line: number[];
}

export const makeAiTrack = (segments: Segment[]): AiTrack => ({ segments, line: buildRacingLine(segments) });

/** 9 rivais, habilidade 0,92..0,99 (o mais rápido sai na pole). */
export const RIVAL_DEFS: { name: string; skill: number }[] = [
  { name: 'M. Alvarenga', skill: 0.99 },
  { name: 'T. Brandt', skill: 0.98 },
  { name: 'L. Okafor', skill: 0.975 },
  { name: 'R. Vasquez', skill: 0.965 },
  { name: 'K. Lindqvist', skill: 0.955 },
  { name: 'S. Tanabe', skill: 0.95 },
  { name: 'D. Moreau', skill: 0.94 },
  { name: 'A. Cardoso', skill: 0.93 },
  { name: 'J. Hartmann', skill: 0.92 },
];

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRival(i: number, z: number, x: number, track: AiTrack): Rival {
  const d = RIVAL_DEFS[i];
  const top = MAX_SPEED_MS * (0.97 + 0.03 * d.skill);
  return {
    car: { z, x, speed: 0, lap: 0, sprite: i, name: d.name, finished: false },
    skill: d.skill,
    profile: buildSpeedProfile(track.segments, d.skill, 0.85, top),
    clock: 0,
    rng: mulberry(1000 + i * 7919),
    passX: 0,
    passUntil: 0,
    defendX: 0,
    defendUntil: 0,
    defendedThisStraight: false,
    errorUntil: 0,
    errorSide: 1,
  };
}

const wrapDz = (dz: number, len: number) => (dz < 0 ? dz + len : dz);
const clampX = (x: number) => Math.max(-0.82, Math.min(0.82, x));
/** Lateral em meias larguras equivalente a `m` metros. */
const lat = (m: number) => m / ROAD_HALF_WIDTH_METERS;
const LAT_RATE = 0.55; // meias larguras por segundo (~3,9 m/s)

/** Lado interno (+1 direita) da próxima curva em até `horizon` m, ou 0. */
function nextCornerSide(segments: Segment[], idx: number, horizon: number): { side: number; dist: number } {
  const n = segments.length;
  for (let k = 0; k < horizon / 5; k++) {
    const c = segments[(idx + k) % n].curve;
    if (Math.abs(c) > 2) return { side: Math.sign(c), dist: k * 5 };
  }
  return { side: 0, dist: horizon };
}

/**
 * Passo da IA de um rival. `others` inclui jogador e demais rivais (exceto ele mesmo).
 * O avanço de lap fica no race.ts.
 */
export function stepRival(r: Rival, others: CarState[], track: AiTrack, trackLength: number, dt: number, racing: boolean): void {
  const c = r.car;
  const { segments, line } = track;
  const n = segments.length;
  r.clock += dt;
  let v = toMs(c.speed);
  if (!racing) {
    c.speed = toUnits(Math.max(0, v - 25 * dt));
    return;
  }
  const idx = Math.floor(c.z / SEGMENT_LENGTH) % n;
  let target = r.profile[idx];
  let wantX = line[(idx + 2) % n];
  const inCorner = Math.abs(segments[idx].curve) > 2;
  if (inCorner) r.defendedThisStraight = false;

  // erro ocasional: entra largo e perde velocidade
  if (inCorner && r.clock > r.errorUntil && r.rng() < (1 - r.skill) * 0.12 * dt) {
    r.errorUntil = r.clock + 1.6;
    r.errorSide = -Math.sign(segments[idx].curve) || 1;
    v *= 0.88;
  }
  if (r.clock < r.errorUntil) {
    wantX = clampX(wantX + r.errorSide * 0.45);
    target *= 0.85;
  }

  // tráfego à frente e ao lado
  let blockLeft = false;
  let blockRight = false;
  let leader: CarState | null = null;
  let leaderGap = Infinity;
  let chaser: CarState | null = null;
  for (const o of others) {
    const dzm = wrapDz(o.z - c.z, trackLength) / UNITS_PER_METER;
    const behindM = trackLength / UNITS_PER_METER - dzm;
    const dxm = (o.x - c.x) * ROAD_HALF_WIDTH_METERS;
    if (dzm < 8 || behindM < 8) {
      // lado a lado: não fecha a porta
      if (Math.abs(dxm) < 4.2) {
        if (dxm > 0) blockRight = true;
        else blockLeft = true;
      }
    }
    if (dzm > 2 && dzm < 90 && Math.abs(dxm) < 3.4 && dzm < leaderGap) {
      leader = o;
      leaderGap = dzm;
    }
    if (behindM < 40 && Math.abs(dxm) < 4 && toMs(o.speed) > v * 0.98) chaser = o;
  }

  if (leader) {
    const lv = toMs(leader.speed);
    const faster = target > lv * 1.03;
    if (faster && leaderGap < 70 && r.clock > r.passUntil) {
      // escolhe o lado livre (preferindo o interno da próxima curva)
      const nc = nextCornerSide(segments, idx, 300);
      const prefer = nc.side !== 0 ? nc.side : leader.x > 0 ? -1 : 1;
      const tryOrder = [prefer, -prefer];
      let side = 0;
      for (const s of tryOrder) {
        const tx = leader.x + s * lat(3.6);
        if (Math.abs(tx) > 0.85) continue;
        if ((s > 0 && blockRight) || (s < 0 && blockLeft)) continue;
        side = s;
        break;
      }
      if (side !== 0) {
        r.passX = clampX(leader.x + side * lat(3.6));
        r.passUntil = r.clock + 2.2 + leaderGap / 40;
      }
    }
    // atrás de alguém que ainda ocupa a faixa: segue sem bater
    if (Math.abs((leader.x - c.x) * ROAD_HALF_WIDTH_METERS) < 2.6) {
      target = Math.min(target, lv + Math.max(0, leaderGap - 9) * 0.45);
    }
  }
  if (r.clock < r.passUntil) wantX = r.passX;

  // defesa no fim da reta: uma única mexida para o lado interno da próxima curva
  if (chaser && r.clock > r.passUntil) {
    const nc = nextCornerSide(segments, idx, 350);
    if (nc.side !== 0 && nc.dist < 320 && !r.defendedThisStraight && !inCorner) {
      r.defendedThisStraight = true;
      r.defendX = clampX(nc.side * 0.5);
      r.defendUntil = r.clock + 3.5;
    }
  }
  if (r.clock < r.defendUntil && r.clock >= r.passUntil) wantX = r.defendX;

  v = stepToward(v, Math.max(0, target), dt);
  c.speed = toUnits(v);

  // movimento lateral limitado, sem invadir quem está ao lado
  let step = Math.max(-LAT_RATE * dt, Math.min(LAT_RATE * dt, wantX - c.x));
  if ((step > 0 && blockRight) || (step < 0 && blockLeft)) step = 0;
  c.x += step;
  c.z += c.speed * dt;
}
