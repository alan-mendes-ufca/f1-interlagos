import type { RoadPalette } from '../contracts';
import { hash2, makeCanvas, rng, type Painter } from './canvas';
import { blob } from './draw';
import { CLOUD_PAL } from './palette';
import { bayer, lerpHex, rgb, ridge } from './util';

export const SKY_W = 960;
export const SKY_H = 270;
const SUN = { x: 300, y: 70 };

const SKY_TOP = '#1e6bff';
const SKY_BOT = '#7fd4ff';
const BANDS = 14;

/** Céu: gradiente em bandas com dithering entre elas, sol branco com halo e raios. */
export function sky(): HTMLCanvasElement {
  const { canvas, p } = makeCanvas(SKY_W, SKY_H);
  const img = p.ctx.createImageData(SKY_W, SKY_H);
  const bandCol = Array.from({ length: BANDS }, (_, i) => rgb(lerpHex(SKY_TOP, SKY_BOT, Math.pow(i / (BANDS - 1), 0.85))));
  const white: [number, number, number] = [255, 255, 255];
  const warm: [number, number, number] = [255, 250, 214];
  const MIX = [0, 0.1, 0.22, 0.38, 0.6];
  for (let y = 0; y < SKY_H; y++) {
    const v = (y / (SKY_H - 1)) * (BANDS - 1);
    const bi = Math.min(BANDS - 2, Math.floor(v));
    const f = Math.min(1, Math.max(0, (v - bi - 0.55) / 0.45));
    for (let x = 0; x < SKY_W; x++) {
      const base = bandCol[bi + (f > bayer(x, y) ? 1 : 0)];
      const dx = x + 0.5 - SUN.x;
      const dy = y + 0.5 - SUN.y;
      const d = Math.hypot(dx, dy);
      let c = base;
      if (d < 14) c = white;
      else if (d < 17) c = warm;
      else if (d < 110) {
        // Halo radial + raios que se estendem mais que o halo.
        const ang = Math.atan2(dy, dx);
        const ray = Math.pow(Math.max(0, Math.cos(ang * 12 + 0.4)), 14) * 0.55 + Math.pow(Math.max(0, Math.cos(ang * 6 + 1.1)), 30) * 0.4;
        const halo = Math.max(0, 1 - (d - 17) / 70);
        const g = halo * halo * 0.8 + ray * Math.max(0, 1 - (d - 17) / 93) * 0.9;
        const lv = Math.min(4, g * 4.4);
        const li = Math.floor(lv);
        const fr = lv - li;
        const L = li + (fr > bayer(x, y) ? 1 : 0);
        const k = MIX[Math.min(4, L)];
        if (k > 0) {
          const tgt = d < 24 ? warm : white;
          c = [0, 1, 2].map((i) => Math.round(base[i] + (tgt[i] - base[i]) * k)) as [number, number, number];
        }
      }
      const o = (y * SKY_W + x) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255;
    }
  }
  p.ctx.putImageData(img, 0, 0);
  return canvas;
}

// --------------------------------------------------------------------------
// Nuvens
// --------------------------------------------------------------------------

const CLOUD_UNDER = ['#7c7ed4', '#9a9eeb', '#b4bcf8'];

/** Cria um cúmulo isolado: puffs sombreados da direita para a esquerda, base plana lilás. */
function cumulus(w: number, h: number, seed: number): HTMLCanvasElement {
  const { canvas, p } = makeCanvas(w, h);
  const r = rng(seed);
  const base = h - 4;
  const n = Math.max(4, Math.round(w / 22));
  const R = Math.min((h - 8) / 2.4, w * 0.3);
  const puffs: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const dome = Math.pow(Math.sin(Math.PI * t), 0.75);
    const rr = Math.max(7, R * dome * (0.55 + r() * 0.45));
    puffs.push({ x: 6 + t * (w - 12), y: base - rr * 0.78, r: rr });
  }
  // Puffs extras no topo para a silhueta de couve-flor.
  for (let i = 0; i < Math.round(n / 2); i++) {
    const t = 0.25 + r() * 0.5;
    const rr = R * (0.5 + r() * 0.3);
    puffs.push({ x: 6 + t * (w - 12), y: base - R * 1.05 - rr * 0.1, r: rr });
  }
  puffs.sort((a, b) => b.x - a.x);
  for (const [i, pf] of puffs.entries()) blob(p, pf.x, pf.y, pf.r * 1.12, pf.r, CLOUD_PAL, seed + i, 7, 0.1, -0.12, 0.22);
  // Recorte da base plana e sombreamento por distância ao fundo da coluna.
  const img = p.ctx.getImageData(0, 0, w, h);
  const under = CLOUD_UNDER.map(rgb);
  for (let x = 0; x < w; x++) {
    let low = -1;
    for (let y = base; y >= 0; y--) {
      if (img.data[(y * w + x) * 4 + 3] > 0) {
        low = y;
        break;
      }
    }
    for (let y = base + 1; y < h; y++) img.data[(y * w + x) * 4 + 3] = 0;
    if (low < 0) continue;
    const bottom = Math.min(low, base);
    // A base plana: usa base como fundo para todas as colunas cobertas.
    for (let y = bottom + 1; y <= base; y++) {
      const o = (y * w + x) * 4;
      img.data[o + 3] = 0;
    }
    for (let y = Math.max(0, bottom - 5); y <= bottom; y++) {
      const o = (y * w + x) * 4;
      if (img.data[o + 3] === 0) continue;
      const dist = bottom - y;
      const dith = bayer(x, y);
      let c: number[];
      if (dist <= 1) c = under[0];
      else if (dist <= 3) c = under[1];
      else c = dith > 0.45 ? under[2] : [img.data[o], img.data[o + 1], img.data[o + 2]];
      // O terço esquerdo da base recebe menos sombra (luz vem da esquerda).
      if (x < w * 0.28 && dist > 1) c = dith > 0.5 ? under[2] : c;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
    }
  }
  p.ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Camada de nuvens 960x140, repetível nas bordas. */
export function clouds(): HTMLCanvasElement {
  const H = 140;
  const { canvas, p } = makeCanvas(SKY_W, H);
  p.ctx.imageSmoothingEnabled = false;
  const defs: [number, number, number, number][] = [
    // x, topo, largura, altura
    [20, 40, 170, 78],
    [250, 78, 96, 44],
    [380, 14, 190, 100],
    [610, 70, 120, 52],
    [760, 30, 150, 82],
    [140, 96, 80, 34],
    [520, 96, 70, 30],
    [870, 88, 90, 40],
    [330, 90, 60, 28],
    [690, 6, 70, 40],
  ];
  defs.forEach(([x, y, w, h], i) => {
    const c = cumulus(w, h, 900 + i * 31);
    for (const off of [0, -SKY_W, SKY_W]) p.ctx.drawImage(c, x + off, y);
  });
  return canvas;
}

// --------------------------------------------------------------------------
// Serra do Mar
// --------------------------------------------------------------------------

/** Serra do Mar azulada, picos verde-azulados, névoa na base. 960x90, repetível. */
export function mountains(): HTMLCanvasElement {
  const H = 90;
  const { canvas, p } = makeCanvas(SKY_W, H);
  const layers = [
    { top: 12, amp: 1, col: ['#a9b4f2', '#8c9ae6', '#7a86d6', '#6a72c4'], seed: 3, peak: '#7fc6c4' },
    { top: 30, amp: 0.8, col: ['#8a9ae8', '#6c7ed8', '#5a68c6', '#4a54b0'], seed: 7, peak: '#58b4b0' },
    { top: 44, amp: 0.55, col: ['#7a8ae0', '#5e6cc8', '#4c58b4', '#3e489c'], seed: 11, peak: '#46a0a0' },
  ];
  for (const [li, L] of layers.entries()) {
    const terms: [number, number, number][] = [
      [3, 14 * L.amp, L.seed],
      [5, 9 * L.amp, L.seed * 2.1],
      [9, 6 * L.amp, L.seed * 3.7],
      [17, 3 * L.amp, L.seed * 5.3],
      [31, 1.6 * L.amp, L.seed * 1.9],
    ];
    const hgt = (x: number): number => L.top + 22 + ridge(x, SKY_W, terms);
    for (let x = 0; x < SKY_W; x++) {
      const y0 = Math.round(hgt(x));
      const slope = hgt(x + 3) - hgt(x - 3);
      for (let y = y0; y < H; y++) {
        const d = y - y0;
        let tone = d < 2 ? 0 : d < 12 ? 1 : d < 26 ? 2 : 3;
        // Luz da esquerda: encostas voltadas à esquerda (descem para a esquerda) clareiam.
        if (slope < -1.2 && tone < 3) tone = Math.max(0, tone - 1);
        else if (slope > 1.2 && tone > 0 && tone < 3) tone += 1;
        let c = L.col[tone];
        // Picos altos recebem vegetação verde-azulada com dithering.
        if (d < 14 && y0 < L.top + 14 && bayer(x, y) > d / 14) c = d < 2 ? '#d4f0e8' : L.peak;
        // Ravinas verticais de textura.
        if (d > 3 && hash2(x >> 1, y >> 2, L.seed) > 0.97) c = L.col[Math.min(3, tone + 1)];
        p.px(x, y, c);
      }
      p.px(x, y0, li === 0 ? '#c8d4ff' : '#9fb0f6');
    }
  }
  // Névoa na base, em degraus dithered.
  const mist = [
    [0.1, 30],
    [0.22, 22],
    [0.38, 14],
    [0.6, 7],
  ];
  const mistCol = [127, 212, 255];
  for (const [a, h] of mist) {
    for (let y = H - h; y < H; y++) {
      for (let x = 0; x < SKY_W; x++) {
        if (bayer(x, y) < (a as number) * 2.2) p.px(x, y, `rgba(${mistCol[0]},${mistCol[1]},${mistCol[2]},0.55)`);
      }
    }
  }
  p.rect(0, H - 3, SKY_W, 3, '#8fdcff');
  return canvas;
}

// --------------------------------------------------------------------------
// Morros + skyline
// --------------------------------------------------------------------------

function building(p: Painter, x: number, base: number, w: number, h: number, seed: number): void {
  const r = rng(seed);
  const top = base - h;
  const lightSide = ['#ffffff', '#eef4ff'][Math.floor(r() * 2)];
  p.rect(x, top, w, h, lightSide);
  p.rect(x + Math.ceil(w * 0.62), top, w - Math.ceil(w * 0.62), h, '#b4c4f0');
  p.rect(x + w - 1, top, 1, h, '#8a9ede');
  // Janelas de vidro refletindo o céu: faixas horizontais com brilho diagonal.
  const glass = r() < 0.7;
  for (let y = top + 3; y < base - 2; y += 3) {
    for (let xx = x + 1; xx < x + w - 1; xx++) {
      const lit = xx < x + Math.ceil(w * 0.62);
      const sky1 = lit ? '#7fd4ff' : '#5a9ef0';
      const sky2 = lit ? '#bff0ff' : '#86bcf8';
      if (glass || (xx - x) % 2 === 0) p.px(xx, y, ((xx + y) % 7 < 2 ? sky2 : sky1));
    }
  }
  p.hline(x, top, w, '#5a72c4');
  p.vline(x, top, h, '#7a8ede');
  if (r() < 0.5) p.rect(x + 1, top - 2, Math.max(2, w - 3), 2, '#7a8ede');
}

/** Morros verdes e skyline de São Paulo (Av. Paulista), 960x80, repetível. */
export function hills(): HTMLCanvasElement {
  const H = 80;
  const { canvas, p } = makeCanvas(SKY_W, H);
  const horizon = 62;

  // Skyline: dois aglomerados (Paulista e centro), prédios claros.
  const clusters: [number, number][] = [
    [540, 250],
    [60, 90],
  ];
  const r = rng(77);
  for (const [cx0, span] of clusters) {
    let x = cx0;
    while (x < cx0 + span) {
      const w = 5 + Math.floor(r() * 7);
      const mid = 1 - Math.abs((x - cx0) / span - 0.5) * 1.5;
      const h = 12 + Math.floor((r() * 18 + 18) * Math.max(0.35, mid));
      building(p, x, horizon + 6, w, h, Math.floor(r() * 9999));
      x += w - 1 + Math.floor(r() * 2);
    }
  }
  // Antenas da Paulista: haste listrada vermelha e branca com ponta luminosa.
  for (const [ax, ah] of [
    [640, 58],
    [606, 44],
  ]) {
    for (let y = 0; y < ah; y++) p.px(ax, horizon - 22 - y + 22 - 20 - 0, y % 6 < 3 ? '#ff3a4a' : '#ffffff');
    p.px(ax, horizon - ah - 2, '#ff3a4a');
    p.px(ax - 1, horizon - ah - 2, '#ffd0d8');
    p.px(ax + 1, horizon - ah - 2, '#ffd0d8');
  }

  // Três camadas de morros (distante azulada, intermediária, próxima verde viva), com
  // torres de transmissão entre as duas primeiras e casinhas nas encostas.
  const hillLayers = [
    { off: 50, terms: [[2, 4, 0.5], [5, 3, 2.2], [11, 1.8, 0.4], [27, 1, 3]] as [number, number, number][], pal: ['#a8f0c8', '#62c8a8', '#4aa8a0', '#3a8a94'], dark: '#2a6a80' },
    { off: 58, terms: [[2, 5, 1], [4, 3.5, 2.2], [9, 2, 0.4], [23, 1.1, 3]] as [number, number, number][], pal: ['#9af0a0', '#4ec88a', '#34a888', '#278a7e'], dark: '#1f6a70' },
    { off: 67, terms: [[3, 5, 4], [7, 3, 1.3], [13, 2, 5], [29, 1, 0.7]] as [number, number, number][], pal: ['#b8ff7a', '#4cd44a', '#2fb23c', '#1f8a38'], dark: '#146a34' },
  ];
  const ridgeY = (li: number, x: number): number => hillLayers[li].off + ridge(((x % SKY_W) + SKY_W) % SKY_W, SKY_W, hillLayers[li].terms);
  const paintHill = (li: number): void => {
    const L = hillLayers[li];
    for (let x = 0; x < SKY_W; x++) {
      const y0 = Math.round(ridgeY(li, x));
      const slope = ridgeY(li, x + 3) - ridgeY(li, x - 3);
      for (let y = y0; y < H; y++) {
        const d = y - y0;
        let tone = d < 2 ? 0 : d < 7 ? 1 : d < 14 ? 2 : 3;
        if (slope < -0.8 && tone > 0) tone -= 1;
        if (slope > 0.9 && tone < 3) tone += 1;
        let c = L.pal[tone];
        if (d >= 5 && d < 9 && bayer(x, y) > (d - 5) / 4) c = L.pal[Math.max(0, tone - 1)];
        const hv = hash2(x >> 1, y >> 1, 40 + li);
        if (d > 1 && hv > 0.9) c = L.pal[Math.min(3, tone + 1)];
        else if (d > 1 && hv < 0.07) c = L.pal[Math.max(0, tone - 1)];
        p.px(x, y, c);
      }
      p.px(x, y0, li === 0 ? '#d8ffe0' : li === 1 ? '#c8ffc0' : '#e2ff9a');
      if (li === 2 && slope > 0.9) p.px(x, y0 + 1, L.dark);
    }
  };
  // Torre de transmissão em treliça (silhueta com contorno e perna clara).
  const pylon = (x: number, by: number, h: number): void => {
    for (let k = 0; k <= h; k++) {
      const half = 1 + Math.round((k / h) * 3);
      const y = by - k;
      p.px(x - half, y, '#4a4a98');
      p.px(x + half, y, '#3a3a80');
      if (k % 4 === 0) p.hline(x - half, y, half * 2 + 1, '#8a8ad8');
      else p.px(x - half + ((k >> 1) % 2 ? 1 : 0), y, '#6a6ab8');
    }
    for (const [dy, hw] of [[h - 2, 7], [h - 8, 6], [h - 14, 5]] as const) {
      p.hline(x - hw, by - dy, hw * 2 + 1, '#4a4a98');
      p.px(x - hw, by - dy + 1, '#c8c8f8');
      p.px(x + hw, by - dy + 1, '#c8c8f8');
    }
    p.px(x, by - h - 1, '#ff3a4a');
  };
  const wire = (x0: number, y0: number, x1: number, y1: number, sag: number): void => {
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0);
      p.px(x, Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag), '#5a5aa8');
    }
  };
  // Casinhas com telhado cerâmico.
  const casinha = (x: number, y: number, wall: string): void => {
    p.rect(x, y, 4, 3, wall);
    p.px(x + 3, y, '#b0a0e0');
    p.px(x + 3, y + 1, '#b0a0e0');
    p.rect(x - 1, y - 2, 6, 2, '#e8481e');
    p.hline(x, y - 3, 4, '#ff9a3a');
    p.px(x + 1, y + 1, '#2a52b8');
  };
  paintHill(0);
  const towers = [150, 330, 520, 760];
  towers.forEach((tx, i) => {
    const by = Math.round(ridgeY(0, tx)) + 2;
    pylon(tx, by, 20 - (i % 2) * 3);
  });
  for (let i = 0; i < towers.length - 1; i++) {
    const a1 = towers[i];
    const b1 = towers[i + 1];
    const ya = Math.round(ridgeY(0, a1)) + 2 - 17;
    const yb = Math.round(ridgeY(0, b1)) + 2 - 17 + ((i + 1) % 2) * 3;
    wire(a1 + 6, ya, b1 - 6, yb, 4);
    wire(a1 - 6, ya + 6, b1 + 6, yb + 6, 4);
  }
  const rr = rng(5);
  paintHill(1);
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(rr() * (SKY_W - 8));
    casinha(x, Math.round(ridgeY(1, x)) + 6 + Math.floor(rr() * 3), rr() < 0.5 ? '#ffffff' : '#ffe0a0');
  }
  paintHill(2);
  for (let c = 0; c < 8; c++) {
    const cx0 = 40 + c * 118 + Math.floor(rr() * 30);
    for (let i = 0; i < 5; i++) {
      const x = cx0 + i * 6 + Math.floor(rr() * 3);
      casinha(x, Math.round(ridgeY(2, x)) + 6 + Math.floor(rr() * 3), ['#ffffff', '#ffe0a0', '#ffc0d0', '#c0f0ff'][Math.floor(rr() * 4)]);
    }
  }
  // Árvores pequenas pontuando o morro da frente.
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rr() * SKY_W);
    const y = Math.round(ridgeY(2, x)) + 3 + Math.floor(rr() * 7);
    p.rect(x, y, 3, 2, '#14803e');
    p.px(x, y, '#5ae05a');
  }
  return canvas;
}

// --------------------------------------------------------------------------
// Estrada
// --------------------------------------------------------------------------

export const ROAD: RoadPalette = {
  asphaltLight: '#5a3a6e',
  asphaltDark: '#4e3262',
  grassLight: '#3fbf3f',
  grassDark: '#36a838',
  shoulderLight: '#f0dca8',
  shoulderDark: '#dcc48c',
  kerbA: '#ff2a4a',
  kerbB: '#ffffff',
  lane: '#ffffff',
  fog: '#7fd4ff',
};
