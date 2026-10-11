export type Pose = 'left' | 'center' | 'right';

/** Esterço (-1..1) a partir do qual o carro troca para a pose lateral. */
export const STEER_THRESHOLD = 0.3;

/** Escolhe a pose do sprite pelo esterço: negativo = esquerda, positivo = direita. */
export function poseForSteer(steer: number, threshold = STEER_THRESHOLD): Pose {
  if (steer <= -threshold) return 'left';
  if (steer >= threshold) return 'right';
  return 'center';
}

/** Esterço aparente de um rival: curvatura do trecho + movimento lateral (offset/s). */
export function rivalSteer(curve: number, lateralSpeed: number): number {
  return curve * 0.2 + lateralSpeed * 1.5;
}

/** Quique vertical do carro do jogador em px (>= 0, sobe): zebra e grama sacodem mais. */
export function carBounce(onKerb: boolean, offroad: boolean, speedFrac: number, t: number): number {
  const v = Math.max(0, Math.min(1, speedFrac));
  let amp = 0;
  if (onKerb) amp = 2.2;
  else if (offroad) amp = 1.6;
  if (amp === 0) return 0;
  return Math.abs(Math.sin(t * 38)) * amp * (0.3 + 0.7 * v);
}
