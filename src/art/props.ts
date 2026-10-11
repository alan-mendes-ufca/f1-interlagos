import type { PropKind, SpriteArt } from '../contracts';
import { hash2, makeCanvas, rng, type Painter } from './canvas';
import { blob, disc, shadow, type Pal5 } from './draw';
import { BUSH_PAL, C, IPE_PAL, TREE_DEEP_PAL, TREE_PAL } from './palette';
import { bayer, lerpHex } from './util';

const OUT = '#1a1038';
const SHADOW = '#2a1060';

function sprite(canvas: HTMLCanvasElement): SpriteArt {
  return { canvas, widthMeters: 0 };
}

/** Sombra projetada no chão para a direita (luz vem do alto à esquerda). */
function cast(p: Painter, x0: number, w: number, baseY: number, len: number, ry = 3, a = 0.34): void {
  shadow(p, x0 + w / 2 + len / 2, baseY - 1, w / 2 + len / 2, ry, a, SHADOW);
}

/** Bandeira do Brasil em retângulo w x h (a partir de w >= 6 mostra losango e círculo). */
function brFlag(p: Painter, x: number, y: number, w: number, h: number, wave?: (u: number) => number): void {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let u = 0; u < w; u++) {
    const dy = wave ? wave(u) : 0;
    const shade = wave ? wave(u + 1) - wave(u - 1) : 0;
    for (let v = 0; v < h; v++) {
      let c: string = C.greenBr;
      const rx = w * 0.43;
      const ry = h * 0.43;
      if (Math.abs(u - cx) / rx + Math.abs(v - cy) / ry <= 1) c = '#ffdf00';
      const d = Math.hypot(u - cx, v - cy);
      const rc = Math.min(w, h * 1.4) * 0.25;
      if (w >= 8 && d <= rc) {
        c = C.blueBr;
        if (Math.abs(v - cy + (u - cx) * 0.25) < Math.max(0.6, rc * 0.18)) c = '#ffffff';
      } else if (w < 8 && d <= 1) c = C.blueBr;
      if (shade > 0.5) c = lerpHex(c, '#1a1038', 0.28);
      else if (shade < -0.5) c = lerpHex(c, '#ffffff', 0.18);
      p.px(x + u, y + v + Math.round(dy), c);
    }
  }
}

// --------------------------------------------------------------------------
// Fonte 3x5 para os painéis
// --------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  E: ['111', '100', '110', '100', '111'],
  G: ['011', '100', '101', '101', '011'],
  I: ['111', '010', '010', '010', '111'],
  L: ['100', '100', '100', '100', '111'],
  N: ['111', '101', '101', '101', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  Ã: ['010', '101', '111', '101', '101'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
};

function textWidth(s: string, scale: number): number {
  return s.length * 4 * scale - scale;
}

function text(p: Painter, s: string, x: number, y: number, scale: number, color: string, shade?: string): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch];
    if (g) {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (g[r][c] === '1') {
            if (shade) p.rect(cx + c * scale + 1, y + r * scale + 1, scale, scale, shade);
            p.rect(cx + c * scale, y + r * scale, scale, scale, color);
          }
        }
      }
      if (ch === 'Ã') {
        p.rect(cx, y - scale, scale, scale, color);
        p.rect(cx + scale, y - 2 * scale, scale, scale, color);
        p.rect(cx + 2 * scale, y - scale, scale, scale, color);
      }
    }
    cx += 4 * scale;
  }
}

// --------------------------------------------------------------------------
// Arquibancada
// --------------------------------------------------------------------------

const SKIN = ['#ffd0a0', '#e8a070', '#b8703e', '#7a4424'];
const SHIRTS = ['#00b040', '#00b040', '#ffdf00', '#ffdf00', '#ffdf00', '#00b040', '#ffffff', '#2a62ff', '#ffdf00', '#00c850'];

function person(p: Painter, x: number, y: number, r: () => number, dim: boolean): void {
  const shirt = SHIRTS[Math.floor(r() * SHIRTS.length)];
  const skin = SKIN[Math.floor(r() * SKIN.length)];
  const hair = ['#3a1a10', '#1a1038', '#7a4a20', '#ffd23a'][Math.floor(r() * 4)];
  const tone = (c: string): string => (dim ? lerpHex(c, '#3a2a8a', 0.42) : c);
  p.rect(x, y + 2, 3, 3, tone(shirt));
  p.px(x + 2, y + 3, tone(lerpHex(shirt, '#1a1038', 0.3)));
  p.px(x + 2, y + 4, tone(lerpHex(shirt, '#1a1038', 0.3)));
  p.rect(x, y, 3, 2, tone(skin));
  p.hline(x, y - 1 + (r() < 0.3 ? 1 : 0), 3, tone(hair));
  if (r() < 0.16) {
    // Braço levantado, às vezes segurando uma bandeirinha do Brasil.
    p.px(x - 1, y + 1, tone(skin));
    p.px(x - 1, y, tone(skin));
    if (r() < 0.45) {
      p.px(x - 1, y - 1, tone('#e8e0ff'));
      p.rect(x - 3, y - 3, 3, 2, tone('#00b040'));
      p.px(x - 2, y - 3, tone('#ffdf00'));
    }
  } else if (r() < 0.12) {
    p.hline(x - 1, y - 1, 5, tone(SHIRTS[Math.floor(r() * 3)]));
  }
  if (r() < 0.25) p.px(x + 1, y + 3, tone('#ffffff'));
}

function grandstand(): SpriteArt {
  const W = 176;
  const H = 84;
  const { canvas, p } = makeCanvas(W, H);
  const r = rng(101);
  const baseY = H - 3;
  const left = 4;
  const gw = W - 16;
  // Estrutura de fundo (sombra sob a cobertura).
  p.rect(left, 12, gw, 62, '#4a3aa0');
  // Degraus: concreto com público.
  for (let row = 0; row < 6; row++) {
    const y0 = 20 + row * 9;
    const dim = row < 2;
    p.rect(left, y0 + 5, gw, 4, dim ? '#6a58c0' : '#a898f0');
    p.hline(left, y0 + 5, gw, dim ? '#8a78d8' : '#d8d0ff');
    p.hline(left, y0 + 8, gw, dim ? '#3a2a88' : '#7a68c8');
    for (let x = left + 1; x < left + gw - 3; x += 4) {
      if (r() < 0.9) person(p, x + (r() < 0.4 ? 1 : 0), y0 - 1, r, dim);
    }
  }
  // Faixas e bandeiras do Brasil penduradas na frente dos degraus.
  for (const fx of [14, 56, 98, 140]) brFlag(p, fx, 62, 14, 10, (u) => Math.sin(u * 0.7 + fx) * 0.8);
  // Muro frontal com faixa de patrocinadores genéricos.
  p.rect(left, 70, gw, 11, '#3b6bff');
  p.hline(left, 70, gw, '#9ab8ff');
  p.rect(left, 76, gw, 2, '#ffdf00');
  p.rect(left, 78, gw, 3, '#00b040');
  p.hline(left, 80, gw, '#0a7a3a');
  for (const x of [26, 70, 122]) text(p, 'BRASIL', x, 71, 1, '#ffffff', '#0b2a9a');
  // Pilares laterais e centrais.
  for (const px of [left - 2, 58, 114, left + gw - 1]) {
    p.rect(px, 10, 3, 72, '#c8d0f8');
    p.vline(px, 10, 72, '#ffffff');
    p.vline(px + 2, 10, 72, '#7f8cd8');
  }
  // Estrutura metálica: treliça em X sob a cobertura e terças.
  for (let x = left; x < left + gw - 7; x += 8) {
    for (let k = 0; k < 8; k++) {
      p.px(x + k, 14 + k, '#b8c0f0');
      p.px(x + 7 - k, 14 + k, '#8a96e0');
    }
  }
  p.hline(left, 14, gw, '#d8e0ff');
  p.hline(left, 21, gw, '#6a58c0');
  // Guarda-corpo frontal com corrimão.
  for (let x = left; x < left + gw; x += 6) p.vline(x, 66, 4, '#d8e0ff');
  p.hline(left, 66, gw, '#ffffff');
  // Cobertura: topo iluminado, beiral azul e carmim, sombra por baixo.
  p.rect(0, 0, W - 4, 9, '#f4f8ff');
  p.hline(0, 0, W - 4, '#ffffff');
  p.rect(0, 5, W - 4, 3, '#2a62ff');
  p.hline(0, 5, W - 4, '#7aa8ff');
  p.rect(0, 8, W - 4, 2, '#ff2a4a');
  p.hline(0, 10, W - 4, OUT);
  p.rect(0, 11, W - 4, 3, '#2a1a78');
  for (let x = 6; x < W - 10; x += 14) {
    p.rect(x, 1, 8, 3, '#d4defc');
    p.vline(x + 7, 1, 3, '#a8b8ec');
  }
  p.frame(0, 0, W - 4, 11, OUT);
  p.rect(0, baseY, W - 4, 3, '#a898f0');
  cast(p, 0, W - 4, H, 14, 3);
  return sprite(canvas);
}

// --------------------------------------------------------------------------
// Árvores
// --------------------------------------------------------------------------

function trunk(p: Painter, x: number, y0: number, y1: number, w: number): void {
  for (let y = y0; y <= y1; y++) {
    const wob = Math.round(Math.sin(y * 0.18) * 1.2);
    p.rect(x + wob - 1, y, w + 2, 1, OUT);
    p.rect(x + wob, y, w, 1, '#9a5a2a');
    p.px(x + wob, y, '#d68a4a');
    p.px(x + wob + 1, y, y % 3 ? '#b86e34' : '#d68a4a');
    p.px(x + wob + w - 1, y, '#5a2a1a');
    if (w > 3) p.px(x + wob + w - 2, y, '#7a3e22');
  }
}

/** Palmeira-imperial: tronco liso cinza-esverdeado com anéis e coroa de folhas arqueadas. */
function palm(p: Painter, x: number, top: number, base: number): void {
  for (let y = top + 6; y <= base; y++) {
    const t = (y - top) / (base - top);
    const w = 4 + Math.round(Math.sin(t * Math.PI * 0.9) * 1.5);
    p.rect(x - Math.floor(w / 2) - 1, y, w + 2, 1, OUT);
    p.rect(x - Math.floor(w / 2), y, w, 1, '#c8c4a4');
    p.px(x - Math.floor(w / 2), y, '#f4f0d0');
    p.px(x - Math.floor(w / 2) + 1, y, y % 4 === 0 ? '#9a9480' : '#e0dcb8');
    p.px(x + Math.ceil(w / 2) - 1, y, '#807a68');
    if (y % 5 === 0) p.hline(x - Math.floor(w / 2), y, w, '#8a8470');
  }
  // Pescoço verde da coroa.
  p.rect(x - 3, top + 2, 6, 8, OUT);
  p.rect(x - 2, top + 2, 4, 8, '#2fa84a');
  p.vline(x - 2, top + 2, 8, '#8ae068');
  // Folhas: 9 arcos com folíolos.
  const dirs = [-1, -0.75, -0.45, -0.2, 0.2, 0.45, 0.75, 1, 0];
  for (const [i, d] of dirs.entries()) {
    const len = 30 - Math.abs(d) * 6;
    for (let k = 0; k <= len; k++) {
      const t = k / len;
      const fx = x + d * len * t;
      const fy = top + 3 - Math.sin(t * 2.2) * (11 - Math.abs(d) * 5) + t * t * (10 + Math.abs(d) * 14);
      const light = d < 0 ? TREE_PAL.l : TREE_PAL.m;
      p.px(fx, fy - 1, OUT);
      p.px(fx, fy, i % 2 ? light : TREE_PAL.h);
      p.px(fx, fy + 1, d > 0 ? TREE_PAL.d : TREE_PAL.m);
      if (k % 2 === 0) {
        p.px(fx - 1, fy + 2, TREE_PAL.d);
        p.px(fx + 1, fy + 2, TREE_PAL.o);
      }
    }
  }
}

function tree(): SpriteArt {
  const W = 112;
  const H = 96;
  const { canvas, p } = makeCanvas(W, H);
  const base = H - 4;
  cast(p, 6, 100, H, 18, 3);
  // Palmeira-imperial ao fundo à direita.
  palm(p, 84, 6, base);
  // Sibipiruna: tronco curvo e copa larga em guarda-chuva com flores amarelas.
  trunk(p, 31, 54, base, 5);
  p.rect(26, base - 1, 15, 2, '#7a3e22');
  trunk(p, 22, 46, 62, 3);
  trunk(p, 42, 44, 62, 3);
  const lobes: [number, number, number, number, Pal5][] = [
    [18, 42, 18, 11, TREE_DEEP_PAL],
    [52, 40, 18, 11, TREE_DEEP_PAL],
    [34, 34, 22, 13, TREE_PAL],
    [14, 36, 14, 9, TREE_PAL],
    [54, 34, 14, 9, TREE_PAL],
    [30, 24, 16, 10, TREE_PAL],
    [44, 28, 14, 9, TREE_PAL],
    [22, 30, 14, 9, TREE_PAL],
  ];
  for (const [i, [cx, cy, rx, ry, pal]] of lobes.entries()) blob(p, cx, cy, rx, ry, pal, 10 + i, 8, 0.2, 0.0, 0.5);
  // Volume: cachos de luz no alto e sombra projetada pela copa no interior.
  for (const [i, [cx, cy]] of ([[22, 26], [36, 20], [48, 28], [14, 36], [56, 36]] as const).entries()) blob(p, cx, cy, 8, 5, TREE_PAL, 70 + i, 7, 0.2, -0.35, 0.5);
  blob(p, 38, 50, 20, 4, { ...TREE_DEEP_PAL, m: TREE_DEEP_PAL.d, l: TREE_DEEP_PAL.m }, 79, 8, 0.15, 0.4, 0.3);
  const r = rng(321);
  for (let i = 0; i < 40; i++) {
    const x = 14 + Math.floor(r() * 44);
    const y = 18 + Math.floor(r() * 30);
    if (p.ctx.getImageData(x, y, 1, 1).data[3] > 0) {
      p.px(x, y, r() < 0.7 ? '#ffe35a' : '#fff9b0');
      if (r() < 0.4) p.px(x + 1, y, '#ffc81e');
    }
  }
  return sprite(canvas);
}

function ipe(): SpriteArt {
  const W = 96;
  const H = 100;
  const { canvas, p } = makeCanvas(W, H);
  const base = H - 5;
  cast(p, 10, 76, H, 16, 3);
  // Pétalas caídas no chão.
  const rr = rng(55);
  for (let i = 0; i < 40; i++) p.px(14 + rr() * 60, base - 1 + rr() * 4, rr() < 0.6 ? '#ffe35a' : '#ffc81e');
  trunk(p, 42, 52, base, 4);
  p.rect(36, base - 1, 15, 2, '#7a3e22');
  trunk(p, 32, 40, 58, 2);
  trunk(p, 54, 38, 58, 2);
  const lobes: [number, number, number, number][] = [
    [28, 46, 18, 14],
    [64, 44, 18, 14],
    [46, 40, 24, 17],
    [30, 28, 16, 13],
    [62, 28, 16, 13],
    [46, 20, 18, 13],
  ];
  for (const [i, [cx, cy, rx, ry]] of lobes.entries()) blob(p, cx, cy, rx, ry, IPE_PAL, 40 + i, 9, 0.18, 0, 0.55);
  // Flores: cachos mais claros e escuros espalhados + folhas verdes raras.
  const r = rng(88);
  for (let i = 0; i < 160; i++) {
    const x = 14 + Math.floor(r() * 68);
    const y = 8 + Math.floor(r() * 54);
    if (p.ctx.getImageData(x, y, 1, 1).data[3] === 0) continue;
    const v = r();
    p.px(x, y, v < 0.4 ? '#fff9b0' : v < 0.7 ? '#ffd21e' : v < 0.9 ? '#e89a10' : '#4cc04a');
    if (v < 0.25) p.px(x + 1, y, '#ffe35a');
  }
  return sprite(canvas);
}

// --------------------------------------------------------------------------
// Placa, fiscal, pneus
// --------------------------------------------------------------------------

function billboard(): SpriteArt {
  const W = 128;
  const H = 76;
  const { canvas, p } = makeCanvas(W, H);
  cast(p, 6, 116, H, 14, 3);
  // Postes de aço com travessas.
  for (const x of [14, 108]) {
    p.rect(x - 1, 40, 6, 34, OUT);
    p.rect(x, 40, 4, 34, '#c8d0f4');
    p.vline(x, 40, 34, '#ffffff');
    p.vline(x + 3, 40, 34, '#7f8cd8');
    p.rect(x - 3, 72, 10, 3, '#8a96e0');
    p.hline(x - 3, 72, 10, '#d0d8ff');
  }
  for (let y = 46; y < 70; y += 6) {
    for (let k = 0; k < 6; k++) p.px(19 + k * 15, y + (k % 2) * 3, '#8a96e0');
  }
  // Painel principal.
  p.rect(2, 4, 124, 40, OUT);
  p.rect(3, 5, 122, 38, '#fff4c0');
  p.rect(5, 7, 118, 34, '#1b4fe0');
  p.hline(5, 7, 118, '#5a8aff');
  p.rect(5, 38, 118, 3, '#0b2a9a');
  // Listras verde e amarela diagonais nas pontas.
  for (let i = 0; i < 12; i++) {
    p.rect(5 + i, 7 + i, 1, 1, '#ffdf00');
    p.rect(122 - i, 7 + i, 1, 1, '#00b040');
  }
  const t1 = 'INTERLAGOS';
  text(p, t1, Math.floor((W - textWidth(t1, 3)) / 2), 12, 3, '#ffdf00', '#0b2a9a');
  const t2 = 'SÃO PAULO';
  text(p, t2, 14, 31, 1, '#ffffff');
  const t3 = 'GP BRASIL';
  text(p, t3, 128 - 14 - textWidth(t3, 1), 31, 1, '#ffffff');
  p.rect(60, 31, 8, 5, '#00b040');
  p.px(63, 33, '#ffdf00');
  p.px(64, 33, '#ffdf00');
  // Moldura com luz de recorte.
  p.hline(3, 5, 122, '#ffffff');
  p.vline(3, 5, 38, '#ffffff');
  return sprite(canvas);
}

function marshal(): SpriteArt {
  const W = 52;
  const H = 66;
  const { canvas, p } = makeCanvas(W, H);
  const b = H - 3;
  cast(p, 2, 46, H, 10, 2);
  // Guarita com listras.
  p.rect(2, 26, 22, b - 26, OUT);
  p.rect(3, 27, 20, b - 27, '#ffffff');
  for (let y = 38; y < b; y += 6) p.rect(3, y, 20, 3, '#ff2a4a');
  p.vline(3, 27, b - 27, '#ffffff');
  p.vline(22, 27, b - 27, '#b4c4f0');
  p.rect(6, 31, 12, 7, OUT);
  p.rect(7, 32, 10, 5, '#7fd4ff');
  p.hline(7, 32, 10, '#d0f4ff');
  p.px(8, 33, '#ffffff');
  p.rect(0, 22, 26, 5, '#ff2a4a');
  p.hline(0, 22, 26, '#ff8a9e');
  p.hline(0, 26, 26, '#a00c34');
  p.frame(0, 22, 26, 5, OUT);
  // Fiscal em macacão laranja com capacete branco, bandeira amarela.
  const px = 38;
  p.rect(px - 2, b - 14, 3, 14, '#1a1038');
  p.rect(px + 1, b - 14, 3, 14, '#1a1038');
  p.rect(px - 3, b - 26, 8, 13, OUT);
  p.rect(px - 2, b - 25, 6, 12, '#ff8a1a');
  p.vline(px - 2, b - 25, 12, '#ffc060');
  p.vline(px + 3, b - 25, 12, '#c04a0a');
  p.hline(px - 2, b - 20, 6, '#ffe060');
  p.rect(px - 2, b - 33, 6, 6, OUT);
  p.rect(px - 1, b - 32, 4, 4, '#e8a070');
  p.rect(px - 2, b - 34, 6, 3, '#ffffff');
  p.hline(px - 2, b - 34, 6, '#ffffff');
  p.px(px + 3, b - 33, '#b4c4f0');
  // Braço erguido com bastão e bandeira.
  p.rect(px + 4, b - 34, 2, 10, '#ff8a1a');
  p.vline(px + 7, b - 52, 22, '#e8e0ff');
  for (let u = 0; u < 12; u++) {
    const dy = Math.round(Math.sin(u * 0.7) * 1.2);
    p.rect(px + 8 + u, b - 52 + dy, 1, 8, u % 6 < 3 ? '#ffdf00' : '#ffe860');
    p.px(px + 8 + u, b - 52 + dy, '#fff9b0');
  }
  p.hline(px + 8, b - 44, 12, '#e8a010');
  return sprite(canvas);
}

function tyre(p: Painter, cx: number, cy: number, paint?: string): void {
  disc(p, cx, cy, 7, 6, OUT);
  disc(p, cx, cy, 6, 5, paint ?? '#2a2650');
  // Brilho de borracha/pintura no arco superior esquerdo.
  for (let a = 3.3; a < 4.9; a += 0.18) {
    p.px(cx + Math.cos(a) * 5, cy + Math.sin(a) * 4, paint ? '#ffffff' : '#6a66a8');
  }
  p.px(cx - 3, cy - 3, paint ? '#ffffff' : '#a8a4e8');
  disc(p, cx, cy, 3, 2.4, OUT);
  disc(p, cx, cy, 2, 1.4, '#0a0820');
  p.hline(cx - 4, cy + 4, 8, paint ? lerpHex(paint, '#1a1038', 0.4) : '#0a0820');
}

function tyrewall(): SpriteArt {
  const W = 116;
  const H = 36;
  const { canvas, p } = makeCanvas(W, H);
  cast(p, 2, 108, H, 12, 3);
  const rows = [26, 17, 8];
  rows.forEach((cy, ri) => {
    const off = ri % 2 ? 7 : 0;
    for (let x = 7 + off; x < W - 8; x += 14) {
      const idx = Math.floor((x - 7) / 14);
      const paint = ri === 2 ? (idx % 2 ? '#ff2a4a' : '#ffffff') : ri === 1 && idx % 4 === 1 ? '#ffffff' : undefined;
      tyre(p, x, cy, paint);
    }
  });
  // Cinta de amarração azul.
  p.hline(3, 16, W - 10, '#3b6bff');
  return sprite(canvas);
}

// --------------------------------------------------------------------------
// Boxes
// --------------------------------------------------------------------------

function pitbuilding(): SpriteArt {
  const W = 196;
  const H = 92;
  const { canvas, p } = makeCanvas(W, H);
  const r = rng(404);
  const base = H - 8;
  cast(p, 2, W - 12, H - 4, 14, 3);
  // Corpo: fachada clara com lado direito em sombra.
  p.rect(2, 12, W - 12, base - 12, '#f4f8ff');
  p.rect(2, 12, 6, base - 12, '#ffffff');
  p.rect(W - 16, 12, 6, base - 12, '#b4c4f0');
  // Andar superior: faixa de vidro refletindo o céu e sacadas.
  p.rect(4, 18, W - 16, 18, OUT);
  for (let x = 5; x < W - 14; x++) {
    for (let y = 19; y < 35; y++) {
      const g = (x + y * 2) % 23 < 3 ? '#dff8ff' : y < 24 ? '#7fd4ff' : y < 30 ? '#4aa8ff' : '#2a82f0';
      p.px(x, y, g);
    }
  }
  for (let x = 4; x < W - 12; x += 20) p.rect(x, 18, 2, 18, '#e8f0ff');
  p.rect(2, 36, W - 12, 3, '#c8d4f8');
  p.hline(2, 36, W - 12, '#ffffff');
  p.rect(2, 38, W - 12, 2, '#6a76c8');
  for (let x = 4; x < W - 12; x += 4) p.vline(x, 36, 3, OUT);
  // Telhado com faixas verde, amarela e azul e platibanda.
  p.rect(0, 2, W - 8, 10, '#ffffff');
  p.hline(0, 2, W - 8, '#ffffff');
  p.rect(0, 7, W - 8, 2, '#00b040');
  p.rect(0, 9, W - 8, 2, '#ffdf00');
  p.rect(0, 11, W - 8, 2, '#1b5fe0');
  p.hline(0, 5, W - 8, '#d0d8f8');
  p.frame(0, 2, W - 8, 11, OUT);
  // Boxes: portões abertos com equipes em cores diferentes.
  const teams = ['#2a52ff', '#9ae82a', '#ff8a1a', '#d8e0f8', '#9a3ae0', '#ff2a4a'];
  const bays = 6;
  const bw = Math.floor((W - 20) / bays);
  for (let i = 0; i < bays; i++) {
    const x0 = 8 + i * bw;
    const w = bw - 6;
    const y0 = 44;
    p.rect(x0 - 1, y0 - 1, w + 2, base - y0 + 1, OUT);
    // Interior escuro com piso claro.
    p.rect(x0, y0, w, base - y0, '#3a2a8a');
    p.rect(x0, y0 + 14, w, base - y0 - 14, '#5a46b0');
    p.hline(x0, y0 + 14, w, '#8a78e0');
    // Portão enrolado no alto.
    p.rect(x0, y0, w, 5, teams[i]);
    for (let y = y0 + 1; y < y0 + 5; y += 2) p.hline(x0, y, w, lerpHex(teams[i], '#1a1038', 0.35));
    p.hline(x0, y0, w, lerpHex(teams[i], '#ffffff', 0.5));
    // Mecânicos.
    for (let k = 0; k < 3; k++) {
      const mx = x0 + 3 + k * Math.floor(w / 3) + (r() < 0.5 ? 1 : 0);
      const my = base - 17 + Math.floor(r() * 2);
      p.rect(mx, my + 5, 3, 7, teams[i]);
      p.px(mx, my + 5, lerpHex(teams[i], '#ffffff', 0.5));
      p.rect(mx, my + 12, 3, 3, '#1a1038');
      p.rect(mx, my + 2, 3, 3, SKIN[Math.floor(r() * 4)]);
      p.hline(mx, my + 1, 3, teams[i]);
    }
    // Nariz de carro entrando no box.
    p.rect(x0 + Math.floor(w / 2) - 3, base - 6, 7, 5, teams[i]);
    p.hline(x0 + Math.floor(w / 2) - 3, base - 6, 7, '#ffffff');
    p.rect(x0 + Math.floor(w / 2) - 5, base - 3, 11, 3, '#1a1038');
    // Número do box no alto.
    p.rect(x0 + Math.floor(w / 2) - 3, y0 - 5, 7, 4, OUT);
    p.rect(x0 + Math.floor(w / 2) - 2, y0 - 4, 5, 2, '#ffdf00');
    p.px(x0 + Math.floor(w / 2), y0 - 4, '#1a1038');
  }
  // Muro dos boxes com telas e bolardos.
  p.rect(0, base, W - 8, 8, '#d8def8');
  p.hline(0, base, W - 8, '#ffffff');
  p.hline(0, base + 6, W - 8, '#7f8cd8');
  p.frame(0, base, W - 8, 8, OUT);
  for (let x = 14; x < W - 20; x += 32) {
    p.rect(x, base + 1, 14, 4, OUT);
    p.rect(x + 1, base + 2, 12, 2, '#2fd6ff');
  }
  // Mastros com bandeiras no telhado.
  for (const fx of [14, 98, 170]) {
    p.vline(fx, 0, 4, '#e8e0ff');
    brFlag(p, fx + 1, 0, 8, 6, (u) => Math.sin(u) * 0.7);
  }
  return sprite(canvas);
}

// --------------------------------------------------------------------------
// Represa, skyline, arbusto
// --------------------------------------------------------------------------

function lake(): SpriteArt {
  const W = 144;
  const H = 52;
  const { canvas, p } = makeCanvas(W, H);
  const top = 12;
  const bot = 40;
  // Margem oposta: faixa de mata e casas.
  for (let x = 0; x < W; x++) {
    const hh = 5 + Math.round(Math.sin(x * 0.21) * 2 + Math.sin(x * 0.07 + 1) * 2);
    for (let y = top - hh; y < top; y++) p.px(x, y, y === top - hh ? '#9af07a' : y < top - 2 ? '#2fb24a' : '#14803e');
  }
  // Água com gradiente em bandas e dithering.
  for (let y = top; y < bot; y++) {
    const t = (y - top) / (bot - top);
    for (let x = 0; x < W; x++) {
      const k = t * 4;
      const i = Math.floor(k);
      const f = k - i;
      const cols = ['#0e7aff', '#1a96ff', '#38b4ff', '#68d0ff', '#8fe0ff'];
      p.px(x, y, cols[Math.min(4, i + (f > bayer(x, y) ? 1 : 0))]);
    }
  }
  // Reflexos brilhantes do sol: dashes horizontais com padrão de ondulação.
  const r = rng(12);
  for (let i = 0; i < 70; i++) {
    const y = top + 2 + Math.floor(r() * (bot - top - 4));
    const x = Math.floor(r() * (W - 10));
    const len = 2 + Math.floor(r() * 5);
    p.hline(x, y, len, r() < 0.5 ? '#ffffff' : '#c8f4ff');
    if (r() < 0.4) p.hline(x + 1, y + 1, len - 1, '#38b4ff');
  }
  for (let y = top + 2; y < bot - 2; y += 3) p.hline(24 + ((y * 7) % 14), y, 14 - (y - top) / 4, '#ffffff');
  // Reflexo da mata da margem oposta (listras verdes dithered logo abaixo dela).
  for (let y = top; y < top + 7; y++) {
    for (let x = 0; x < W; x++) if (bayer(x, y) < 0.7 - (y - top) * 0.1 && (x + y) % 2 === 0) p.px(x, y, y < top + 3 ? '#14803e' : '#1a96d0');
  }
  // Trilha de brilho do sol: blocos que afinam, em dois tons (alternáveis para animar).
  for (let k = 0; k < 6; k++) {
    const y = top + 4 + k * 4;
    p.hline(88 - (k % 2) * 3, y, 20 - k * 2, k % 2 ? '#d8f8ff' : '#ffffff');
    p.hline(92, y + 1, 12 - k, '#a0e8ff');
  }
  // Veleiro.
  const sx = 98;
  const sy = top + 12;
  for (let k = 0; k < 14; k++) p.hline(sx, sy - k, Math.max(1, Math.round(k * 0.5)), '#ffffff');
  for (let k = 0; k < 10; k++) p.hline(sx - 1 - Math.round(k * 0.4), sy - k + 2, Math.max(1, Math.round(k * 0.4)), '#ff2a4a');
  p.vline(sx - 1, sy - 15, 17, OUT);
  p.rect(sx - 6, sy + 3, 14, 2, OUT);
  p.rect(sx - 5, sy + 3, 12, 1, '#ffdf00');
  // Margem próxima: areia e grama com juncos.
  for (let x = 0; x < W; x++) {
    const hh = 3 + Math.round(Math.sin(x * 0.3) * 1.3);
    p.rect(x, bot, 1, 2, '#f0dca8');
    for (let y = bot + 2; y < H - 2 + 0; y++) p.px(x, y, y - bot < hh ? '#5ae05a' : '#2fb24a');
    p.px(x, bot, '#ffffff');
  }
  for (let x = 4; x < W; x += 6) {
    p.vline(x, bot - 5 - ((x * 3) % 4), 5, '#14803e');
    p.px(x, bot - 5 - ((x * 3) % 4), '#c8ff7a');
  }
  p.hline(0, H - 2, W, '#14803e');
  p.hline(0, H - 1, W, '#0b4a3a');
  return sprite(canvas);
}

interface Facade {
  lit: string;
  shade: string;
  edge: string;
  glassLit: string;
  glassShade: string;
}

const FACADES: Facade[] = [
  { lit: '#ffffff', shade: '#a8bcee', edge: '#7a8ede', glassLit: '#7fd4ff', glassShade: '#4a8ee8' },
  { lit: '#ffe6c8', shade: '#e8a878', edge: '#b8704a', glassLit: '#7fd4ff', glassShade: '#4a8ee8' },
  { lit: '#e4d4ff', shade: '#a888e0', edge: '#7a58b8', glassLit: '#9ae0ff', glassShade: '#5a8ee8' },
  { lit: '#c8f4e8', shade: '#6ac8b0', edge: '#3a9884', glassLit: '#b8f0ff', glassShade: '#4aa8e0' },
  { lit: '#6ac0ff', shade: '#2a7ae0', edge: '#1a52b0', glassLit: '#d8f8ff', glassShade: '#7ac8ff' },
];

/** Prédio com fachada em duas faces; `crown` 0 plano, 1 escalonado, 2 inclinado, 3 caixa-d'água. */
function towerBlock(p: Painter, x: number, base: number, w: number, h: number, seed: number, antenna: boolean, fi = 0, crown = 0, fade = 0): void {
  const F = FACADES[fi % FACADES.length];
  const mixc = (c: string): string => (fade > 0 ? lerpHex(c, '#b4c4f0', fade) : c);
  const top = base - h;
  const lw = Math.ceil(w * 0.62);
  p.rect(x - 1, top - 1, w + 2, h + 1, mixc(OUT));
  p.rect(x, top, lw, h, mixc(F.lit));
  p.rect(x + lw, top, w - lw, h, mixc(F.shade));
  p.vline(x + w - 1, top, h, mixc(F.edge));
  for (let y = top + 3; y < base - 2; y += 3) {
    for (let xx = x + 1; xx < x + w - 1; xx++) {
      const lit = xx < x + lw;
      const mix = hash2(xx + seed, y, seed);
      if (mix < 0.12) continue;
      p.px(xx, y, mixc(lit ? ((xx + y) % 9 < 2 ? '#e0fbff' : F.glassLit) : F.glassShade));
      p.px(xx, y + 1, mixc(lit ? '#4aa8ff' : '#3a6ed0'));
    }
  }
  // Marquises a cada 5 andares.
  for (let y = top + 12; y < base - 4; y += 15) p.hline(x - 1, y, w + 2, mixc(F.edge));
  p.hline(x, top, w, mixc('#d8e4ff'));
  if (crown === 1) {
    p.rect(x + 2, top - 5, w - 4, 4, mixc(OUT));
    p.rect(x + 3, top - 4, w - 6, 3, mixc(F.lit));
    p.rect(x + 4, top - 8, Math.max(2, w - 8), 3, mixc(OUT));
    p.rect(x + 5, top - 7, Math.max(1, w - 10), 2, mixc(F.shade));
  } else if (crown === 2) {
    for (let k = 0; k < 6; k++) p.hline(x + k, top - 1 - k, Math.max(1, w - k * 2), k % 2 ? mixc(F.shade) : mixc('#ffffff'));
  } else if (crown === 3) {
    p.rect(x + 2, top - 6, 7, 6, mixc(OUT));
    p.rect(x + 3, top - 5, 5, 4, mixc('#c8d4ff'));
    p.px(x + 3, top - 5, mixc('#ffffff'));
  } else {
    p.rect(x + 2, top - 3, Math.max(2, w - 5), 2, mixc(OUT));
    p.rect(x + 3, top - 2, Math.max(1, w - 7), 1, mixc('#c8d4ff'));
  }
  if (antenna) {
    for (let k = 0; k < 18; k++) p.px(x + Math.floor(w / 2), top - 6 - k, k % 6 < 3 ? '#ff2a4a' : '#ffffff');
    p.px(x + Math.floor(w / 2), top - 25, '#ff2a4a');
  }
}

function skyline(): SpriteArt {
  const W = 168;
  const H = 128;
  const { canvas, p } = makeCanvas(W, H);
  const base = H - 6;
  cast(p, 2, W - 20, H - 4, 14, 3);
  // Fileira de trás: mais pálida (névoa), prédios variados.
  const back: [number, number, number][] = [[0, 12, 46], [14, 10, 70], [28, 14, 52], [62, 10, 84], [84, 12, 56], [106, 10, 74], [122, 14, 50], [150, 12, 62]];
  back.forEach(([x, w, h], i) => towerBlock(p, x, base - 2, w, h, 200 + i, false, (i + 2) % FACADES.length, i % 4, 0.5));
  const defs: [number, number, number, boolean, number, number][] = [
    [4, 14, 56, false, 1, 3],
    [20, 16, 80, false, 0, 1],
    [38, 12, 64, false, 3, 0],
    [52, 20, 96, true, 4, 2],
    [74, 14, 70, false, 2, 3],
    [90, 18, 88, false, 0, 1],
    [110, 14, 60, false, 1, 0],
    [126, 18, 76, true, 3, 2],
    [146, 12, 48, false, 2, 3],
  ];
  [...defs].sort((a, b) => b[2] - a[2]).forEach(([x, w, h, ant, fi, crown], i) => towerBlock(p, x, base - (i % 3), w, h, 7 + i, ant, fi, crown));
  p.rect(0, base, W - 8, 6, '#3fbf3f');
  p.hline(0, base, W - 8, '#9af07a');
  for (let x = 6; x < W - 14; x += 22) blob(p, x, base - 3, 9, 6, TREE_PAL, 90 + x, 7, 0.2, 0, 0.45);
  return sprite(canvas);
}

function bush(): SpriteArt {
  const W = 56;
  const H = 34;
  const { canvas, p } = makeCanvas(W, H);
  cast(p, 4, 44, H, 8, 2);
  blob(p, 16, 20, 14, 11, BUSH_PAL, 1, 8, 0.15, 0, 0.45);
  blob(p, 38, 21, 14, 10, BUSH_PAL, 2, 8, 0.15, 0, 0.45);
  blob(p, 27, 15, 17, 12, BUSH_PAL, 3, 9, 0.14, -0.05, 0.5);
  const r = rng(66);
  for (let i = 0; i < 14; i++) {
    const x = 10 + Math.floor(r() * 36);
    const y = 6 + Math.floor(r() * 20);
    if (p.ctx.getImageData(x, y, 1, 1).data[3] > 0) {
      p.px(x, y, i % 3 === 0 ? '#ffffff' : '#ffdf00');
      if (i % 3 === 0) p.px(x + 1, y + 1, '#ffd0e0');
    }
  }
  p.rect(10, H - 3, 36, 2, '#14803e');
  return sprite(canvas);
}

// --------------------------------------------------------------------------
// Alambrado, bandeira, torre de TV, refletor
// --------------------------------------------------------------------------

function fence(): SpriteArt {
  const W = 108;
  const H = 46;
  const { canvas, p } = makeCanvas(W, H);
  const base = H - 4;
  cast(p, 2, W - 12, H - 2, 12, 2);
  // Malha em losangos translúcida.
  for (let y = 10; y < base; y++) {
    for (let x = 2; x < W - 10; x++) {
      if ((x + y) % 6 === 0 || (x - y + 600) % 6 === 0) p.px(x, y, (x + y) % 8 < 4 ? '#a8b8f8' : '#7f90e0');
    }
  }
  // Postes com topo inclinado para dentro.
  for (let x = 4; x < W - 8; x += 26) {
    p.rect(x - 1, 6, 5, base - 4, OUT);
    p.rect(x, 6, 3, base - 5, '#e0e6ff');
    p.vline(x, 6, base - 5, '#ffffff');
    p.vline(x + 2, 6, base - 5, '#8a96e0');
    for (let k = 0; k < 6; k++) p.rect(x + 1 + k, 6 - k - 1 + 0, 2, 1, k % 2 ? '#e0e6ff' : '#ffffff');
  }
  // Travessa superior e rodapé de concreto.
  p.rect(2, 6, W - 10, 2, OUT);
  p.hline(2, 6, W - 10, '#ffffff');
  p.hline(2, 7, W - 10, '#8a96e0');
  p.rect(0, base, W - 8, 4, '#c8d0f4');
  p.hline(0, base, W - 8, '#ffffff');
  p.hline(0, base + 3, W - 8, '#7f8cd8');
  p.frame(0, base, W - 8, 4, OUT);
  return sprite(canvas);
}

function flag(): SpriteArt {
  const W = 52;
  const H = 88;
  const { canvas, p } = makeCanvas(W, H);
  const base = H - 3;
  cast(p, 4, 44, H, 10, 2);
  // Mastro metálico com bola dourada.
  p.rect(7, 6, 4, base - 6, OUT);
  p.rect(8, 6, 2, base - 6, '#e8ecff');
  p.vline(8, 6, base - 6, '#ffffff');
  p.vline(9, 6, base - 6, '#8a96e0');
  p.rect(6, 2, 6, 5, OUT);
  p.rect(7, 3, 4, 3, '#ffdf00');
  p.px(7, 3, '#ffffff');
  p.rect(4, base - 2, 10, 3, OUT);
  p.rect(5, base - 1, 8, 1, '#c8d0f4');
  // Bandeira do Brasil tremulando: 34x24.
  brFlag(p, 11, 8, 34, 24, (u) => Math.sin(u * 0.32) * (1 + u * 0.07));
  return sprite(canvas);
}

function tvtower(): SpriteArt {
  const W = 56;
  const H = 128;
  const { canvas, p } = makeCanvas(W, H);
  const base = H - 4;
  cast(p, 6, 36, H, 20, 2);
  // Pernas treliçadas convergindo.
  for (let y = 26; y <= base; y++) {
    const t = (y - 26) / (base - 26);
    const half = Math.round(5 + t * 11);
    const cx = 24;
    p.rect(cx - half - 1, y, 3, 1, OUT);
    p.rect(cx + half - 1, y, 3, 1, OUT);
    p.px(cx - half, y, '#ff8a1a');
    p.px(cx + half, y, '#c04a0a');
    if (y % 7 === 0) p.hline(cx - half, y, half * 2, '#ff8a1a');
    const phase = Math.floor(y / 7);
    const along = (y % 7) / 7;
    const dx = Math.round((phase % 2 ? along : 1 - along) * half * 2);
    p.px(cx - half + dx, y, '#ffb050');
  }
  // Plataformas intermediárias.
  for (const py of [58, 90]) {
    const t = (py - 26) / (base - 26);
    const half = Math.round(5 + t * 11);
    p.rect(24 - half - 3, py, half * 2 + 6, 3, OUT);
    p.rect(24 - half - 2, py, half * 2 + 4, 2, '#ffd0a0');
    p.hline(24 - half - 2, py, half * 2 + 4, '#ffffff');
  }
  // Cabine de transmissão no topo.
  p.rect(10, 8, 28, 20, OUT);
  p.rect(11, 9, 26, 18, '#ffffff');
  p.rect(37, 9, 1, 18, '#b4c4f0');
  p.rect(11, 22, 26, 4, '#1b5fe0');
  p.rect(13, 12, 22, 7, OUT);
  p.rect(14, 13, 20, 5, '#7fd4ff');
  p.hline(14, 13, 20, '#d8f8ff');
  p.px(17, 14, '#ffffff');
  p.rect(8, 6, 32, 3, '#ff2a4a');
  p.hline(8, 6, 32, '#ff8a9e');
  p.frame(8, 6, 32, 3, OUT);
  // Câmera/antena e prato.
  p.vline(24, 0, 6, '#e8ecff');
  p.px(24, 0, '#ff2a4a');
  p.rect(38, 12, 10, 6, OUT);
  p.rect(39, 13, 8, 4, '#c8d0f4');
  p.rect(46, 13, 3, 4, '#3b3a7a');
  p.rect(40, 18, 2, 4, OUT);
  disc(p, 5, 14, 5, 5, OUT);
  disc(p, 5, 14, 4, 4, '#f4f8ff');
  p.px(3, 12, '#ffffff');
  p.px(7, 16, '#8a96e0');
  return sprite(canvas);
}

function floodlight(): SpriteArt {
  const W = 36;
  const H = 112;
  const { canvas, p } = makeCanvas(W, H);
  const base = H - 4;
  cast(p, 6, 20, H, 16, 2);
  p.rect(14, 18, 5, base - 18, OUT);
  p.rect(15, 18, 3, base - 18, '#d8dffa');
  p.vline(15, 18, base - 18, '#ffffff');
  p.vline(17, 18, base - 18, '#7f8cd8');
  for (let y = 30; y < base; y += 9) p.px(16, y, '#8a96e0');
  p.rect(10, base - 2, 13, 3, OUT);
  p.rect(11, base - 1, 11, 1, '#c8d0f4');
  // Banco de refletores (apagados de dia: lentes claras).
  p.rect(2, 4, 30, 15, OUT);
  p.rect(3, 5, 28, 13, '#c8d0f4');
  p.hline(3, 5, 28, '#ffffff');
  p.hline(3, 17, 28, '#7f8cd8');
  for (let r2 = 0; r2 < 2; r2++) {
    for (let c = 0; c < 4; c++) {
      p.rect(5 + c * 7, 7 + r2 * 5, 5, 4, '#fff4c0');
      p.px(5 + c * 7, 7 + r2 * 5, '#ffffff');
      p.rect(5 + c * 7, 10 + r2 * 5, 5, 1, '#e8a010');
    }
  }
  return sprite(canvas);
}

// --------------------------------------------------------------------------
// v3: placas de frenagem, brita, público, casas, margem da represa
// --------------------------------------------------------------------------

function brakeBoard(label: string): SpriteArt {
  const W = 36;
  const H = 46;
  const { canvas, p } = makeCanvas(W, H);
  const base = H - 3;
  cast(p, 4, 28, H, 8, 2);
  // Haste baixa de aço e sapata.
  p.rect(16, 26, 4, base - 26, OUT);
  p.rect(17, 26, 2, base - 26, '#d8dffa');
  p.vline(17, 26, base - 26, '#ffffff');
  p.vline(18, 26, base - 26, '#7f8cd8');
  p.rect(12, base - 2, 12, 3, OUT);
  p.rect(13, base - 1, 10, 1, '#c8d0f4');
  // Placa: fundo branco, borda vermelha, número grande.
  p.rect(1, 1, 34, 26, OUT);
  p.rect(2, 2, 32, 24, '#ff2a4a');
  p.hline(2, 2, 32, '#ff8a9e');
  p.rect(5, 5, 26, 18, '#ffffff');
  p.hline(5, 5, 26, '#fff4c0');
  p.hline(5, 22, 26, '#c8d0f4');
  const tw = textWidth(label, 2);
  text(p, label, Math.floor((W - tw) / 2) + 1, 8, 2, '#1a1038', '#b4c4f0');
  p.vline(2, 3, 22, '#ff7a8e');
  p.vline(33, 3, 22, '#a00c34');
  return sprite(canvas);
}

function gravel(): SpriteArt {
  const W = 160;
  const H = 18;
  const { canvas, p } = makeCanvas(W, H);
  const r = rng(808);
  // Superfície da caixa de brita, bege com textura de pedras em 3 tons.
  p.rect(0, 1, W, 10, '#e8d098');
  p.speckle(0, 1, W, 10, ['#f8e8b8', '#d0b478', '#fff4d0', '#b89a5e'], 0.35, r);
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(r() * (W - 3));
    const y = 2 + Math.floor(r() * 8);
    p.px(x, y, '#8a6e40');
    p.px(x + 1, y, '#fff4d0');
  }
  // Rastros de pneu na brita.
  for (const y of [4, 7]) for (let x = 20 + y * 3; x < 130; x += 2) p.px(x, y, '#c8aa6c');
  p.hline(0, 1, W, '#fffbe0');
  // Borda frontal (concreto sujo) e faixa de sombra.
  p.rect(0, 11, W, 5, '#c8b078');
  p.hline(0, 11, W, '#f4e4b0');
  p.rect(0, 14, W, 2, '#8a7040');
  p.speckle(0, 12, W, 3, ['#a88c54', '#e0c888'], 0.3, r);
  p.rect(0, 16, W, 2, 'rgba(42,16,96,0.35)');
  p.frame(0, 0, W, 1, OUT);
  p.hline(0, 16, W, OUT);
  return sprite(canvas);
}

function crowd(): SpriteArt {
  const W = 120;
  const H = 44;
  const { canvas, p } = makeCanvas(W, H);
  const r = rng(909);
  const fenceTop = 22;
  // Duas fileiras de gente em pé, a de trás um pouco mais alta e mais escura.
  for (const [row, y0, dim] of [[0, 8, true], [1, 14, false]] as const) {
    for (let x = 1 + row * 2; x < W - 4; x += 4) {
      if (r() < 0.9) person(p, x, y0 + (r() < 0.3 ? 1 : 0), r, dim);
    }
  }
  // Bandeiras do Brasil maiores erguidas.
  for (const fx of [14, 44, 74, 100]) {
    p.vline(fx, 0, 16, '#e8e0ff');
    brFlag(p, fx + 1, 0, 14, 9, (u) => Math.sin(u * 0.6 + fx) * 0.9);
  }
  // Braços erguidos extras (aplaudindo).
  for (let i = 0; i < 12; i++) {
    const x = 3 + Math.floor(r() * (W - 8));
    p.px(x, 9, SKIN[Math.floor(r() * 4)]);
    p.px(x, 8, SKIN[Math.floor(r() * 4)]);
  }
  // Alambrado na frente.
  p.rect(0, fenceTop, W, 18, 'rgba(26,16,56,0.18)');
  for (let y = fenceTop + 1; y < fenceTop + 14; y++) for (let x = 0; x < W; x++) if ((x + y) % 5 === 0 || (x - y + 500) % 5 === 0) p.px(x, y, (x + y) % 8 < 4 ? '#a8b8f8' : '#7f90e0');
  for (let x = 2; x < W; x += 24) {
    p.rect(x - 1, fenceTop - 2, 4, 20, OUT);
    p.rect(x, fenceTop - 2, 2, 20, '#e0e6ff');
    p.vline(x, fenceTop - 2, 20, '#ffffff');
  }
  p.rect(0, fenceTop - 2, W, 2, OUT);
  p.hline(0, fenceTop - 2, W, '#ffffff');
  p.rect(0, fenceTop + 14, W, 6, '#c8d0f4');
  p.hline(0, fenceTop + 14, W, '#ffffff');
  p.hline(0, fenceTop + 19, W, '#7f8cd8');
  p.rect(0, H - 4, W, 4, 'rgba(42,16,96,0.3)');
  return sprite(canvas);
}

function house(p: Painter, x: number, base: number, w: number, h: number, wall: [string, string], roof: [string, string, string], seed: number, floors: number): void {
  const r = rng(seed);
  const top = base - h;
  // Corpo: parede iluminada à esquerda e sombra à direita.
  p.rect(x - 1, top - 1, w + 2, h + 1, OUT);
  p.rect(x, top, w, h, wall[0]);
  p.rect(x + Math.ceil(w * 0.68), top, w - Math.ceil(w * 0.68), h, wall[1]);
  p.vline(x, top, h, '#ffffff');
  // Janelas e porta.
  const fh = Math.floor((h - 2) / floors);
  for (let f = 0; f < floors; f++) {
    const wy = top + 3 + f * fh;
    for (let wx = x + 3; wx < x + w - 5; wx += 8) {
      p.rect(wx - 1, wy - 1, 6, 6, OUT);
      p.rect(wx, wy, 4, 4, '#7fd4ff');
      p.px(wx, wy, '#ffffff');
      p.hline(wx, wy + 3, 4, '#2a82f0');
      p.rect(wx - 1, wy + 5, 6, 1, wall[1]);
    }
  }
  p.rect(x + 3 + Math.floor(r() * 2), base - 8, 5, 8, OUT);
  p.rect(x + 4 + Math.floor(r() * 2), base - 7, 3, 7, '#c06a2a');
  // Telhado cerâmico de duas águas: fileiras de telhas.
  const rh = 11;
  for (let k = 0; k < rh; k++) {
    const inset = Math.floor(k * (w / 2 - 2) / rh);
    const y = top - 1 - k;
    p.hline(x - 2 + inset, y, w + 4 - inset * 2, OUT);
    p.hline(x - 1 + inset, y, w + 2 - inset * 2, k % 3 === 0 ? roof[2] : k % 2 ? roof[0] : roof[1]);
    for (let tx = x - 1 + inset; tx < x + w + 1 - inset; tx += 3) p.px(tx, y, roof[2]);
  }
  p.hline(x - 2, top, w + 4, roof[2]);
  p.hline(x + 2, top - rh, w - 4, '#fff4c0');
}

function building(): SpriteArt {
  const W = 120;
  const H = 70;
  const { canvas, p } = makeCanvas(W, H);
  const base = H - 4;
  cast(p, 2, W - 8, H - 2, 12, 3);
  // Casa de dois andares com telhado de telha, casa térrea e prédio baixo com caixa-d'água.
  house(p, 4, base, 36, 24, ['#fff0c8', '#e8c890'], ['#ff9a3a', '#e8641e', '#a8381a'], 1, 2);
  house(p, 44, base, 28, 18, ['#c8f0ff', '#8ac4e8'], ['#ff8a3a', '#e05a1e', '#a0301a'], 2, 1);
  // Prédio de apartamentos baixo (4 andares), laje plana e caixa-d'água.
  const bx = 78;
  const bw = 34;
  const bh = 42;
  p.rect(bx - 1, base - bh - 1, bw + 2, bh + 1, OUT);
  p.rect(bx, base - bh, bw, bh, '#ffd0a8');
  p.rect(bx + 24, base - bh, bw - 24, bh, '#e8a070');
  p.vline(bx, base - bh, bh, '#fff0e0');
  for (let f = 0; f < 4; f++) {
    const y = base - bh + 4 + f * 9;
    for (let x = bx + 3; x < bx + bw - 4; x += 8) {
      p.rect(x - 1, y - 1, 6, 6, OUT);
      p.rect(x, y, 4, 4, f % 2 ? '#7fd4ff' : '#bff0ff');
      p.px(x, y, '#ffffff');
    }
    p.hline(bx, y + 6, bw, '#c0784a');
    if (f % 2 === 0) p.rect(bx + 20, y - 1, 6, 1, '#ff2a4a');
  }
  p.rect(bx - 2, base - bh - 3, bw + 4, 3, '#e0e6ff');
  p.hline(bx - 2, base - bh - 3, bw + 4, '#ffffff');
  p.rect(bx + 4, base - bh - 10, 9, 7, OUT);
  p.rect(bx + 5, base - bh - 9, 7, 5, '#c8d4ff');
  p.vline(bx + 5, base - bh - 9, 5, '#ffffff');
  p.rect(0, base, W - 4, 4, '#3fbf3f');
  p.hline(0, base, W - 4, '#9af07a');
  // Muro e arbusto na frente.
  p.rect(2, base - 4, 76, 4, '#f4f0e0');
  p.hline(2, base - 4, 76, '#ffffff');
  blob(p, 108, base - 3, 7, 5, BUSH_PAL, 12, 7, 0.2, 0, 0.45);
  return sprite(canvas);
}

function pond(): SpriteArt {
  const W = 120;
  const H = 44;
  const { canvas, p } = makeCanvas(W, H);
  const r = rng(1010);
  const top = 12;
  const bot = 30;
  // Margem de trás: moita baixa.
  for (let x = 0; x < W; x += 8) blob(p, x + 4, top - 1, 7, 5, BUSH_PAL, 30 + x, 7, 0.2, 0, 0.45);
  // Água em bandas com dithering e dois tons de brilho.
  for (let y = top; y < bot; y++) {
    const t = (y - top) / (bot - top);
    for (let x = 0; x < W; x++) {
      const cols = ['#1a96ff', '#38b4ff', '#68d0ff', '#8fe0ff'];
      const k = t * 3;
      const i = Math.floor(k);
      p.px(x, y, cols[Math.min(3, i + (k - i > bayer(x, y) ? 1 : 0))]);
    }
  }
  for (let i = 0; i < 40; i++) {
    const y = top + 1 + Math.floor(r() * (bot - top - 2));
    const x = Math.floor(r() * (W - 8));
    const len = 2 + Math.floor(r() * 4);
    p.hline(x, y, len, r() < 0.5 ? '#ffffff' : '#c8f4ff');
  }
  // Margem próxima com grama.
  for (let x = 0; x < W; x++) {
    const hh = 3 + Math.round(Math.sin(x * 0.25) * 1.2);
    p.rect(x, bot, 1, 2, '#f0dca8');
    for (let y = bot + 2; y < H - 1; y++) p.px(x, y, y - bot < hh ? '#5ae05a' : '#2fb24a');
  }
  p.hline(0, H - 1, W, '#14803e');
  // Taboas: haste verde e espiga marrom, em tufos de alturas variadas.
  for (let x = 4; x < W - 2; x += 6 + Math.floor(r() * 5)) {
    const hh = 12 + Math.floor(r() * 12);
    p.vline(x, bot + 2 - hh, hh, '#14803e');
    p.vline(x + 1, bot + 2 - hh + 3, hh - 3, '#2fb24a');
    if (r() < 0.65) {
      p.rect(x - 1, bot + 2 - hh, 3, 6, OUT);
      p.rect(x, bot + 2 - hh + 1, 1, 4, '#b8702a');
      p.px(x, bot + 2 - hh + 1, '#e8a060');
    }
    p.hline(x - 3, bot + 2 - Math.floor(hh * 0.6), 3, '#5ae05a');
    p.hline(x + 2, bot + 2 - Math.floor(hh * 0.5), 3, '#14803e');
  }
  // Flores e juncos baixos.
  for (let i = 0; i < 18; i++) p.px(Math.floor(r() * W), bot + 3 + Math.floor(r() * 8), r() < 0.5 ? '#ffffff' : '#ffdf00');
  return sprite(canvas);
}

/** Largura REAL em metros de cada sprite (contrato v3). */
export const PROP_WIDTH_METERS: Record<PropKind, number> = {
  grandstand: 40,
  floodlight: 2,
  tree: 8,
  ipe: 7,
  billboard: 12,
  marshal: 3,
  tyrewall: 6,
  pitbuilding: 60,
  lake: 40,
  skyline: 80,
  bush: 2.5,
  fence: 10,
  flag: 2.5,
  tvtower: 4,
  brake300: 1.6,
  brake200: 1.6,
  brake100: 1.6,
  gravel: 20,
  crowd: 15,
  building: 15,
  pond: 30,
};

export function buildProps(): Record<PropKind, SpriteArt> {
  const made: Record<PropKind, SpriteArt> = {
    grandstand: grandstand(),
    floodlight: floodlight(),
    tree: tree(),
    ipe: ipe(),
    billboard: billboard(),
    marshal: marshal(),
    tyrewall: tyrewall(),
    pitbuilding: pitbuilding(),
    lake: lake(),
    skyline: skyline(),
    bush: bush(),
    fence: fence(),
    flag: flag(),
    tvtower: tvtower(),
    brake300: brakeBoard('300'),
    brake200: brakeBoard('200'),
    brake100: brakeBoard('100'),
    gravel: gravel(),
    crowd: crowd(),
    building: building(),
    pond: pond(),
  };
  for (const k of Object.keys(made) as PropKind[]) made[k].widthMeters = PROP_WIDTH_METERS[k];
  return made;
}
