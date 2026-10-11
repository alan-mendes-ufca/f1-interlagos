import { hash2, rgba, type Painter } from './canvas';

/** Paleta de volume: o = contorno, d = sombra, m = meio, l = luz, h = brilho (recorte). */
export interface Pal5 {
  o: string;
  d: string;
  m: string;
  l: string;
  h: string;
}

/** Massa orgânica (copa, rocha) com contorno irregular, luz de recorte em cima-esquerda e sombra embaixo-direita. */
export function blob(p: Painter, cx: number, cy: number, rx: number, ry: number, pal: Pal5, seed: number, lobes = 6, amp = 0.16, bias = 0, noise = 0.4): void {
  const ph = hash2(seed, 7, 3) * 6.283;
  const edge = 1.15 / ((rx + ry) / 2);
  for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx / rx, dy / ry);
      const r = 1 + amp * Math.sin(Math.atan2(dy / ry, dx / rx) * lobes + ph);
      if (d > r + edge) continue;
      if (d > r) {
        p.px(x, y, pal.o);
        continue;
      }
      const s = -(dx / rx) * 0.55 - (dy / ry) * 0.85 - bias + (hash2(x, y, seed) - 0.5) * noise;
      p.px(x, y, s > 1.0 ? pal.h : s > 0.38 ? pal.l : s > -0.28 ? pal.m : s > -0.9 ? pal.d : pal.o);
    }
  }
}

/** Sombra projetada no chão (duas elipses translúcidas). */
export function shadow(p: Painter, cx: number, cy: number, rx: number, ry: number, a = 0.3, color = '#04202e'): void {
  for (const [k, al] of [
    [1, a * 0.6],
    [0.62, a * 0.6],
  ] as const) {
    const col = rgba(color, al);
    for (let y = Math.floor(cy - ry * k); y <= Math.ceil(cy + ry * k); y++) {
      for (let x = Math.floor(cx - rx * k); x <= Math.ceil(cx + rx * k); x++) {
        const dx = (x + 0.5 - cx) / (rx * k);
        const dy = (y + 0.5 - cy) / (ry * k);
        if (dx * dx + dy * dy <= 1) p.px(x, y, col);
      }
    }
  }
}

/** Disco preenchido (elipse) de cor sólida. */
export function disc(p: Painter, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) p.px(x, y, color);
    }
  }
}
