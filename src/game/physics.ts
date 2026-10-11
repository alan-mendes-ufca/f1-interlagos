import { ROAD_HALF_WIDTH_METERS, SEGMENT_LENGTH, UNITS_PER_METER, type CarState, type PropKind, type Segment } from '../contracts';

/* ==========================================================================
   Física em escala real. Internamente tudo em SI (m, m/s, m/s²); o estado dos
   carros guarda z e speed em unidades de mundo (UNITS_PER_METER por metro).
   ========================================================================== */

export const G = 9.81;
/** Velocidade máxima na reta: ~330 km/h. */
export const MAX_KMH = 330;
export const MAX_SPEED_MS = MAX_KMH / 3.6;
/** Em unidades de mundo por segundo. */
export const MAX_SPEED = MAX_SPEED_MS * UNITS_PER_METER;
export const GEARS = 8;
export const toMs = (speed: number) => speed / UNITS_PER_METER;
export const toUnits = (ms: number) => ms * UNITS_PER_METER;
export const toKmh = (speed: number) => (speed / UNITS_PER_METER) * 3.6;

// ---- aderência: a_lat = g(mu + k v²) --------------------------------------
/** Coeficiente de aderência mecânica. */
export const MU = 1.6;
/** Downforce: ~4,5 g a 250 km/h (69 m/s). */
export const DOWNFORCE_K = 6e-4;
/** O traçado do OSM é a linha central; a linha de corrida usa raio maior. */
export const LINE_GAIN = 1.15;

/** Aceleração lateral máxima (m/s²) na velocidade v (m/s). */
export const lateralGrip = (v: number) => G * (MU + DOWNFORCE_K * v * v);

/**
 * Velocidade-limite (m/s) para o raio R (m): v² / R = g(mu + k v²)
 * => v = sqrt(g mu / (1/R - g k)). Se o downforce cobre a curva, sem limite.
 */
export function cornerLimit(radiusMeters: number): number {
  if (!isFinite(radiusMeters)) return MAX_SPEED_MS;
  const d = 1 / (radiusMeters * LINE_GAIN) - G * DOWNFORCE_K;
  if (d <= 0) return MAX_SPEED_MS;
  return Math.min(MAX_SPEED_MS, Math.sqrt((G * MU) / d));
}

// ---- longitudinal --------------------------------------------------------
const TRACTION_A = 8; // m/s² limitada por tração em baixa velocidade
const POWER = 380; // W/kg
const DRAG = POWER / (MAX_SPEED_MS * MAX_SPEED_MS * MAX_SPEED_MS);
const ENGINE_BRAKE = 1.2; // m/s² ao soltar o acelerador

/** Aceleração (m/s²) a plena carga. */
export const accelMax = (v: number) => Math.max(0, Math.min(TRACTION_A, POWER / Math.max(v, 1)) - DRAG * v * v);
/** Desaceleração máxima de frenagem (m/s²): ~2,5 g em baixa, ~5 g a 330 km/h. */
export const brakeMax = (v: number) => Math.min(5.2, 2.5 + 2.5 * (v / MAX_SPEED_MS) ** 2) * G;
/** Distância (m) para ir de v a u (m/s) freando no máximo. */
export function brakeDistance(v: number, u: number): number {
  if (v <= u) return 0;
  let d = 0;
  const step = 2;
  for (let x = v; x > u; ) {
    const nx = Math.max(u, Math.sqrt(Math.max(0, x * x - 2 * (brakeMax(x) + DRAG * x * x) * step)));
    d += step;
    if (nx >= x) break;
    x = nx;
  }
  return d;
}

/** Marcha 1..8; monotônica na velocidade. */
export function gearForSpeed(speed: number): number {
  const g = Math.floor((Math.max(0, speed) / MAX_SPEED) * GEARS) + 1;
  return Math.min(GEARS, Math.max(1, g));
}

/** Rotação 0..1: sobe dentro de cada marcha e cai ao trocar. */
export function rpmFor(speed: number, gear: number): number {
  const band = MAX_SPEED / GEARS;
  const frac = Math.min(1, Math.max(0, (speed - (gear - 1) * band) / band));
  return 0.38 + 0.62 * frac;
}

/** Passo de velocidade (m/s) de um carro que persegue uma velocidade-alvo (IA). */
export function stepToward(v: number, target: number, dt: number, brakeUse = 1): number {
  if (v < target) return Math.min(target, v + accelMax(v) * dt);
  return Math.max(target, v - (brakeMax(v) * brakeUse + DRAG * v * v) * dt);
}

// ---- jogador -------------------------------------------------------------
const OFFROAD_KEEP = 22; // m/s (~80 km/h): teto na grama/brita
const OFFROAD_DECEL = 1.8 * G;
const KERB_DRAG = 1.5;
const X_LIMIT = 3.2;
const STEER_MAX = 8; // m/s lateral com esterço total
const TAU_STEER = 0.18;
const TAU_DRIFT = 0.12;
const TAU_SLIDE = 0.3;
const SLIDE_SCRUB = 0.4;

export interface Controls {
  /** -1 esquerda .. 1 direita */
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
}

export interface Dynamics {
  /** Segundos restantes do efeito de batida (para shake/HUD). */
  crashTimer: number;
  /** Cooldown para evitar várias batidas no mesmo objeto. */
  crashCooldown: number;
  onKerb: boolean;
  offroad: boolean;
  /** Excesso de aderência pedida (0 = dentro do limite, 1 = o dobro do limite). */
  slip: number;
}

export const createDynamics = (): Dynamics => ({ crashTimer: 0, crashCooldown: 0, onKerb: false, offroad: false, slip: 0 });

export interface LateralModel {
  /** Aceleração lateral pedida pela curva (m/s²). */
  required: number;
  /** Excesso sobre a aderência (m/s²). */
  excess: number;
  /** excess / aderência (0 = dentro do limite). */
  slip: number;
  /** Deriva para fora (m/s): ∝ pedido dentro do limite, ∝ excesso acima dele. */
  drift: number;
  /** Velocidade lateral máxima do esterço (m/s). */
  authority: number;
  /** Direção da deriva em x (-1 esquerda, +1 direita). */
  outward: number;
}

/** Modelo lateral simplificado: sem centrífuga arbitrária, só aderência real. */
export function lateralModel(v: number, seg: Segment): LateralModel {
  const R = seg.radiusMeters ?? Infinity;
  const required = isFinite(R) ? (v * v) / (R * LINE_GAIN) : 0;
  const aLat = lateralGrip(v);
  const excess = Math.max(0, required - aLat);
  const slip = excess / aLat;
  const drift = TAU_DRIFT * Math.min(required, aLat) + TAU_SLIDE * excess;
  const authority = (Math.min(STEER_MAX, TAU_STEER * aLat) * Math.min(1, v / 8)) / (1 + 1.5 * slip);
  return { required, excess, slip, drift, authority, outward: -Math.sign(seg.curve) };
}

/** Avança um passo de física do jogador. Não faz wrap de volta; isso é do race.ts. */
export function stepPlayer(car: CarState, dyn: Dynamics, ctrl: Controls, dt: number, seg: Segment): void {
  let v = toMs(car.speed);
  dyn.crashTimer = Math.max(0, dyn.crashTimer - dt);
  dyn.crashCooldown = Math.max(0, dyn.crashCooldown - dt);

  const ax = Math.abs(car.x);
  dyn.offroad = ax > 1.02;
  dyn.onKerb = seg.kerb && ax > 0.86 && ax <= 1.12;

  // aderência lateral: acima do limite o carro escorrega para fora
  const lm = lateralModel(v, seg);
  dyn.slip = lm.slip;
  const excess = lm.excess;

  let a: number;
  if (ctrl.throttle > 0) a = accelMax(v) * ctrl.throttle;
  else a = -ENGINE_BRAKE;
  a -= DRAG * v * v * (ctrl.throttle > 0 ? 0 : 1);
  if (ctrl.brake > 0) a -= brakeMax(v) * ctrl.brake;
  if (ctrl.handbrake) a -= 0.8 * G;
  if (dyn.onKerb) a -= KERB_DRAG;
  a -= SLIDE_SCRUB * excess;
  if (dyn.offroad) {
    // Grama/brita: freio forte até um teto baixo.
    if (v > OFFROAD_KEEP) a -= OFFROAD_DECEL;
    else a = Math.min(a, 0.3 * TRACTION_A);
  }
  v = Math.max(0, Math.min(MAX_SPEED_MS, v + a * dt));
  car.speed = toUnits(v);

  // Lateral (m/s): esterço (limitado pela aderência) contra a deriva da curva.
  const lm2 = lateralModel(v, seg);
  const lateral = ctrl.steer * lm2.authority + lm2.outward * lm2.drift;
  car.x += (lateral / ROAD_HALF_WIDTH_METERS) * dt;
  car.x = Math.max(-X_LIMIT, Math.min(X_LIMIT, car.x));

  car.z += car.speed * dt;
}

/** Raio lateral (em unidades de meia pista) de cada objeto de beira de pista; 0 = atravessável. */
export const PROP_RADIUS: Record<PropKind, number> = {
  grandstand: 0.6,
  floodlight: 0.12,
  tree: 0.22,
  ipe: 0.22,
  billboard: 0.3,
  marshal: 0.15,
  tyrewall: 0.25,
  pitbuilding: 0.7,
  lake: 0,
  skyline: 0,
  bush: 0.15,
  fence: 0.1,
  flag: 0.1,
  tvtower: 0.2,
  brake300: 0.1, brake200: 0.1, brake100: 0.1,
  gravel: 0, crowd: 0, building: 0, pond: 0,
};
/** Meia largura do carro (2 m) em unidades de meia pista. */
export const CAR_HALF_X = 1 / ROAD_HALF_WIDTH_METERS;

/** Colisão com props. Retorna true se bateu. */
export function collideProps(car: CarState, dyn: Dynamics, segments: Segment[]): boolean {
  if (dyn.crashCooldown > 0 || segments.length === 0) return false;
  const i = Math.floor(car.z / SEGMENT_LENGTH);
  for (let k = 0; k <= 1; k++) {
    const seg = segments[(i + k) % segments.length];
    for (const p of seg.props) {
      const r = PROP_RADIUS[p.kind];
      if (r > 0 && Math.abs(car.x - p.offset) < r + CAR_HALF_X) {
        crash(car, dyn, p.offset, r);
        return true;
      }
    }
  }
  return false;
}

function crash(car: CarState, dyn: Dynamics, offset: number, r: number): void {
  car.speed *= 0.3;
  // joga o carro para o lado da pista do objeto
  const side = Math.sign(car.x - offset) || -Math.sign(offset) || 1;
  car.x = offset + side * (r + CAR_HALF_X + 0.05);
  dyn.crashTimer = 1.0;
  dyn.crashCooldown = 0.8;
}

/** Comprimento de um carro (m) para colisão entre carros. */
const CAR_LENGTH_M = 5;

/** Colisão entre dois carros (jogador x rival, ou rival x rival). Retorna true se houve contato. */
export function collideCars(a: CarState, b: CarState, trackLength: number): boolean {
  let dz = b.z - a.z;
  if (dz > trackLength / 2) dz -= trackLength;
  if (dz < -trackLength / 2) dz += trackLength;
  const dx = b.x - a.x;
  if (Math.abs(dz) > CAR_LENGTH_M * UNITS_PER_METER || Math.abs(dx) > 2 * CAR_HALF_X) return false;
  const [back, front] = dz > 0 ? [a, b] : [b, a];
  const lateral = Math.sign(dx) || 1;
  // traseira de quem está atrás encosta no da frente: perde velocidade; o da frente perde um pouco
  if (back.speed > front.speed) back.speed = front.speed * 0.85;
  back.speed *= 0.97;
  front.speed *= 0.99;
  // afasta lateralmente
  const push = (2 * CAR_HALF_X - Math.abs(dx)) * 0.5 + 0.01;
  a.x -= lateral * push;
  b.x += lateral * push;
  return true;
}
