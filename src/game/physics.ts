import { SEGMENT_LENGTH, type CarState, type PropKind, type Segment } from '../contracts';

/** Velocidade máxima em unidades de mundo por segundo (exibida como ~330 km/h). */
export const MAX_SPEED = 4500;
export const MAX_KMH = 330;
export const GEARS = 8;
export const toKmh = (speed: number) => (speed / MAX_SPEED) * MAX_KMH;

const ACCEL = 1150;
const BRAKE = 6200;
const HANDBRAKE = 4500; // extra, somado ao freio
const COAST = 420;
const DRAG = 0.00003;
const STEER_RATE = 2.4;
const CENTRIFUGAL = 0.42;
const OFFROAD_CAP = MAX_SPEED * 0.2;
const OFFROAD_DECEL = 4200;
const KERB_DRAG = 500;
const X_LIMIT = 3.2;

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
}

export const createDynamics = (): Dynamics => ({ crashTimer: 0, crashCooldown: 0, onKerb: false, offroad: false });

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

/** Avança um passo de física do jogador. Não faz wrap de volta; isso é do race.ts. */
export function stepPlayer(car: CarState, dyn: Dynamics, ctrl: Controls, dt: number, seg: Segment): void {
  const sp = car.speed / MAX_SPEED;
  dyn.crashTimer = Math.max(0, dyn.crashTimer - dt);
  dyn.crashCooldown = Math.max(0, dyn.crashCooldown - dt);

  const ax = Math.abs(car.x);
  dyn.offroad = ax > 1;
  dyn.onKerb = seg.kerb && ax > 0.86 && ax <= 1.1;

  let a = 0;
  if (ctrl.throttle > 0) a += ACCEL * ctrl.throttle * Math.max(0, 1 - car.speed / (MAX_SPEED * 1.01));
  else a -= COAST;
  a -= DRAG * car.speed * car.speed * (ctrl.throttle > 0 ? 0 : 1);
  if (ctrl.brake > 0) a -= BRAKE * ctrl.brake;
  if (ctrl.handbrake) a -= HANDBRAKE;
  if (dyn.onKerb) a -= KERB_DRAG;
  if (dyn.offroad) {
    // Grama/brita: a velocidade cai em direção a um teto baixo.
    if (car.speed > OFFROAD_CAP) a -= OFFROAD_DECEL;
    else a = Math.min(a, 0.3 * ACCEL);
  }
  car.speed = Math.min(MAX_SPEED, Math.max(0, car.speed + a * dt));

  // Direção proporcional à velocidade + força centrífuga ∝ speed² * curve.
  const steerMove = dt * STEER_RATE * Math.min(1, sp * 1.6);
  car.x += ctrl.steer * steerMove;
  car.x -= dt * CENTRIFUGAL * sp * sp * seg.curve;
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
};
const CAR_RADIUS = 0.12;

/** Colisão com props. Retorna true se bateu. */
export function collideProps(car: CarState, dyn: Dynamics, segments: Segment[]): boolean {
  if (dyn.crashCooldown > 0 || segments.length === 0) return false;
  const i = Math.floor(car.z / SEGMENT_LENGTH);
  for (let k = 0; k <= 1; k++) {
    const seg = segments[(i + k) % segments.length];
    for (const p of seg.props) {
      const r = PROP_RADIUS[p.kind];
      if (r > 0 && Math.abs(car.x - p.offset) < r + CAR_RADIUS) {
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
  car.x = offset + side * (r + CAR_RADIUS + 0.05);
  dyn.crashTimer = 1.0;
  dyn.crashCooldown = 0.8;
}

/** Colisão entre dois carros (jogador x rival, ou rival x rival). Retorna true se houve contato. */
export function collideCars(a: CarState, b: CarState, trackLength: number): boolean {
  let dz = b.z - a.z;
  if (dz > trackLength / 2) dz -= trackLength;
  if (dz < -trackLength / 2) dz += trackLength;
  const dx = b.x - a.x;
  if (Math.abs(dz) > 320 || Math.abs(dx) > 0.3) return false;
  // a traseira de quem está atrás encosta no da frente
  const [back, front] = dz > 0 ? [a, b] : [b, a];
  const lateral = Math.sign(dx) || 1;
  if (back.speed > front.speed) back.speed = front.speed * 0.8;
  front.speed = Math.min(MAX_SPEED, front.speed * 1.02);
  const push = (0.3 - Math.abs(dx)) * 0.5 + 0.02;
  a.x -= lateral * push;
  b.x += lateral * push;
  return true;
}
