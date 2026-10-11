import { SEGMENT_LENGTH, SEGMENT_METERS, type Segment } from '../contracts';
import { brakeDistance, brakeMax, cornerLimit, MAX_SPEED_MS } from './physics';

/** Velocidade-limite de curva (m/s) de cada segmento, sem antecipação de frenagem. */
export function cornerLimits(segments: Segment[]): number[] {
  return segments.map((s) => cornerLimit(s.radiusMeters ?? Infinity));
}

/**
 * Perfil de velocidade (m/s) por segmento: o menor entre o limite de curva e o
 * que ainda dá para frear a tempo do limite mais à frente (passada reversa).
 * `grip` (<= 1) reduz o limite de curva; `brakeUse` (<= 1) usa só parte da frenagem.
 */
export function buildSpeedProfile(segments: Segment[], grip = 1, brakeUse = 1, topSpeed = MAX_SPEED_MS): number[] {
  const n = segments.length;
  const v = cornerLimits(segments).map((l) => Math.min(topSpeed, l * grip));
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 2 * n; k >= 0; k--) {
      const i = k % n;
      const j = (i + 1) % n;
      const reach = Math.sqrt(v[j] * v[j] + 2 * brakeMax(v[j]) * brakeUse * SEGMENT_METERS);
      if (reach < v[i]) v[i] = reach;
    }
  }
  return v;
}

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/**
 * Linha de corrida (offset lateral, em meias larguras) por segmento:
 * por fora na entrada, por dentro no ápice e por fora na saída.
 */
export function buildRacingLine(segments: Segment[], inside = 0.55, outside = 0.5): number[] {
  const n = segments.length;
  const win = 4;
  const cs = segments.map((_, i) => {
    let s = 0;
    for (let j = -win; j <= win; j++) s += segments[wrap(i + j, n)].curve;
    return s / (2 * win + 1);
  });
  const sat = (c: number) => Math.max(-1, Math.min(1, c / 2));
  const ahead = Math.round(70 / SEGMENT_METERS);
  const behind = Math.round(50 / SEGMENT_METERS);
  const raw = segments.map((_, i) => {
    const here = sat(cs[i]);
    const room = 1 - Math.abs(here);
    // curva > 0 = direita: o lado de dentro é x > 0
    return inside * here - outside * room * 0.5 * (sat(cs[wrap(i + ahead, n)]) + sat(cs[wrap(i - behind, n)]));
  });
  const sm = 5;
  return raw.map((_, i) => {
    let s = 0;
    for (let j = -sm; j <= sm; j++) s += raw[wrap(i + j, n)];
    return Math.max(-0.75, Math.min(0.75, s / (2 * sm + 1)));
  });
}

export interface BrakeAdvice {
  /** Limite da curva à frente em km/h. */
  limitKmh: number;
  /** Distância até o ponto limite (m). */
  distance: number;
  /** Já dentro da distância de frenagem e acima do limite. */
  brake: boolean;
  /** Nome do trecho da curva à frente. */
  name: string;
}

/**
 * Procura, nos próximos `horizon` metros, a curva que exige frear: velocidade
 * (m/s) acima do limite e distância menor que a de frenagem (com folga).
 */
export function brakeAdvice(segments: Segment[], limits: number[], z: number, vMs: number, horizon = 450): BrakeAdvice | null {
  const n = segments.length;
  const i0 = Math.floor(z / SEGMENT_LENGTH);
  let found: BrakeAdvice | null = null;
  for (let k = 0; k < horizon / SEGMENT_METERS; k++) {
    const j = (i0 + k) % n;
    const lim = limits[j];
    if (lim >= vMs * 0.97 || lim >= MAX_SPEED_MS - 1) continue;
    const dist = k * SEGMENT_METERS;
    const need = brakeDistance(vMs, lim);
    if (dist <= need * 1.4 + 40) {
      found = { limitKmh: lim * 3.6, distance: dist, brake: true, name: segments[j].sectionName };
      break;
    }
    if (!found) found = { limitKmh: lim * 3.6, distance: dist, brake: false, name: segments[j].sectionName };
  }
  return found;
}
