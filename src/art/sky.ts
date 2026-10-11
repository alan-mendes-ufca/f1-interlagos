import { makeCanvas, rng } from './canvas';
import { C } from './palette';

// Gradiente do entardecer: azul profundo -> ciano -> lilás -> carmim no horizonte.
// Roxo entre ciano e carmim evita a passagem cinzenta.
const SKY_STOPS: [number, string][] = [
  [0, '#0b1a4a'],
  [0.2, '#1b4f9a'],
  [0.4, '#2fd6ff'],
  [0.5, '#b44fd6'],
  [0.58, '#ff3a6e'],
  [1, '#ff3a6e'],
];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const BANDS = 16;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function stopColor(t: number): string {
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    const [t0, c0] = SKY_STOPS[i];
    const [t1, c1] = SKY_STOPS[i + 1];
    if (t <= t1) {
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return rgbToHex(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
    }
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

/** Céu 960x270 em faixas, com dithering ordenado (Bayer 4x4) entre as faixas e estrelas no topo. */
export function sky(): HTMLCanvasElement {
  const W = 960;
  const H = 270;
  const { canvas, p } = makeCanvas(W, H);
  const bandColors: string[] = [];
  for (let i = 0; i <= BANDS; i++) bandColors.push(stopColor(Math.min(1, (i + 0.5) / BANDS)));

  for (let y = 0; y < H; y++) {
    const pos = ((y + 0.5) / H) * BANDS;
    const k = Math.floor(pos);
    const f = pos - k;
    let runStart = 0;
    let runColor = '';
    for (let x = 0; x <= W; x++) {
      let color = '';
      if (x < W) {
        const th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        color = bandColors[Math.min(BANDS, f > th ? k + 1 : k)];
      }
      if (x === 0) {
        runColor = color;
      } else if (x === W || color !== runColor) {
        p.rect(runStart, y, x - runStart, 1, runColor);
        runStart = x;
        runColor = color;
      }
    }
  }

  // Estrelas: só no topo, com algumas cruzes maiores.
  const r = rng(9001);
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(r() * W);
    const y = Math.floor(Math.pow(r(), 1.6) * 110);
    p.px(x, y, r() < 0.6 ? C.cream : C.cyanLight);
  }
  for (let i = 0; i < 9; i++) {
    const x = 20 + Math.floor(r() * (W - 40));
    const y = 6 + Math.floor(r() * 60);
    p.px(x, y, '#ffffff');
    p.px(x - 1, y, C.cyanLight).px(x + 1, y, C.cyanLight).px(x, y - 1, C.cyanLight).px(x, y + 1, C.cyanLight);
  }
  return canvas;
}

/** Morros verde-azulados e skyline de São Paulo (960x120, fundo transparente, largura contínua para parallax). */
export function hills(): HTMLCanvasElement {
  const W = 960;
  const H = 120;
  const { canvas, p } = makeCanvas(W, H);
  const r = rng(4401);
  const TAU = Math.PI * 2;
  // Frequências inteiras (ciclos por 960 px): o padrão repete sem emenda.
  const back = (x: number) => 50 + 9 * Math.sin((TAU * 2 * x) / W + 0.7) + 5 * Math.sin((TAU * 5 * x) / W + 2.1);
  const front = (x: number) => 84 + 6 * Math.sin((TAU * 3 * x) / W + 4.0) + 4 * Math.sin((TAU * 7 * x) / W + 1.3);

  // Morros de trás.
  for (let x = 0; x < W; x++) {
    const top = Math.round(back(x));
    p.rect(x, top, 1, H - top, C.teal);
    p.px(x, top, C.tealRim);
  }

  // Skyline: prédios escuros com janelas acesas, base em y=96.
  const BASE = 96;
  let x = 0;
  while (x < W) {
    const bw = Math.min(W - x, 5 + Math.floor(r() * 11));
    const bh = 14 + Math.floor(r() * r() * 58);
    const top = BASE - bh;
    p.rect(x, top, bw, bh, C.violetDeep);
    p.vline(x, top, bh, C.violetRim);
    for (let wy = top + 3; wy < BASE - 2; wy += 4) {
      for (let wx = x + 2; wx < x + bw - 1; wx += 3) {
        if (r() < 0.38) p.rect(wx, wy, 2, 2, C.amber);
        else p.px(wx, wy, '#2a1a5a');
      }
    }
    if (bh > 52 && r() < 0.5) {
      const ax = x + Math.floor(bw / 2);
      p.vline(ax, top - 6, 6, C.violetRim);
      p.px(ax, top - 7, C.signalRed);
    }
    x += bw;
  }

  // Morros da frente, cobrindo a base dos prédios.
  for (let x = 0; x < W; x++) {
    const top = Math.round(front(x));
    p.rect(x, top, 1, H - top, C.tealDeep);
    p.px(x, top, C.tealRim);
    p.px(x, top + 1, '#2a8a80');
  }
  return canvas;
}
