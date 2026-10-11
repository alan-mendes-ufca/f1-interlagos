/** [r, g, b] de #rrggbb. */
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Interpolação linear entre duas cores #rrggbb, devolve #rrggbb. */
export function lerpHex(a: string, b: string, t: number): string {
  const ca = rgb(a);
  const cb = rgb(b);
  const k = Math.max(0, Math.min(1, t));
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Limiar de dithering ordenado (Bayer 4x4) em (0, 1). */
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/** Soma de senos com frequências inteiras: silhueta que repete nas bordas do período. */
export function ridge(x: number, period: number, terms: [number, number, number][]): number {
  let v = 0;
  for (const [k, a, ph] of terms) v += a * Math.sin((2 * Math.PI * k * x) / period + ph);
  return v;
}
