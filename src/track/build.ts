import { SEGMENT_LENGTH, type Segment, type TrackDef } from '../contracts';

const easeInOut = (a: number, b: number, p: number) => a + (b - a) * (0.5 - Math.cos(p * Math.PI) / 2);

/** Fração do trecho usada para suavizar a entrada na curva (a saída é a entrada do trecho seguinte). */
const ENTER_FRACTION = 0.3;

/**
 * Expande o TrackDef em segmentos.
 * - Curvas: cada trecho entra com ease in/out a partir da curvatura do trecho anterior
 *   (o primeiro herda do último, então o circuito fecha sem salto).
 * - Morros: altura por ease in/out em cada trecho; o erro final é distribuído linearmente
 *   para que a altura volte a 0 na linha de chegada.
 */
export function buildTrack(def: TrackDef): { segments: Segment[]; length: number } {
  const secs = def.sections;
  const total = secs.reduce((n, s) => n + s.length, 0);
  if (total <= 0) throw new Error('TrackDef sem segmentos');

  // Alturas nos nós 0..total
  const ys: number[] = new Array(total + 1);
  let base = 0;
  let k = 0;
  for (const s of secs) {
    for (let i = 0; i < s.length; i++) ys[k + i] = base + s.hill * easeInOut(0, 1, i / s.length);
    base += s.hill;
    k += s.length;
  }
  ys[total] = base;
  const err = ys[total];
  for (let i = 0; i <= total; i++) ys[i] -= err * (i / total);
  ys[total] = 0;

  const segments: Segment[] = [];
  let prevCurve = secs[secs.length - 1].curve;
  for (const s of secs) {
    const enter = Math.max(1, Math.floor(s.length * ENTER_FRACTION));
    for (let i = 0; i < s.length; i++) {
      const index = segments.length;
      const curve = i < enter ? easeInOut(prevCurve, s.curve, i / enter) : s.curve;
      const props = [];
      for (const rule of s.props ?? []) {
        if (rule.every > 0 && i % rule.every === 0) props.push(...rule.place);
      }
      segments.push({
        index,
        curve,
        y1: ys[index],
        y2: ys[index + 1],
        sectionName: s.name,
        props,
        kerb: Math.abs(curve) > 2,
      });
    }
    prevCurve = s.curve;
  }
  return { segments, length: total * SEGMENT_LENGTH };
}
