import type { PropKind, SpriteArt } from '../contracts';
import { makeCanvas, rng, type Painter } from './canvas';
import { blob, disc, shadow } from './draw';
import { C, IPE_PAL, LEAF_DARK_PAL, TREE_PAL } from './palette';

function sprite(canvas: HTMLCanvasElement, worldWidth: number, glow?: { color: string; radius: number; dy: number }): SpriteArt {
  return glow ? { canvas, worldWidth, glow } : { canvas, worldWidth };
}

const CROWD = [C.green, C.green, C.yellowCrowd, C.yellowCrowd, C.green, C.yellowCrowd, C.orangeCrowd, C.blueCrowd, C.cream, C.carmine];

/** Arquibancada com público colorido, cobertura com luz âmbar sob o telhado. */
function grandstand(): SpriteArt {
  const W = 120;
  const H = 64;
  const { canvas, p } = makeCanvas(W, H);
  const r = rng(101);
  // Cobertura com luzes âmbar.
  p.rect(0, 0, W, 4, '#1a1f5a');
  p.hline(0, 0, W, '#4a58c0');
  p.hline(0, 4, W, C.carmineDeep);
  for (let x = 3; x < W; x += 8) {
    p.rect(x, 5, 3, 2, C.amber);
    p.px(x + 1, 5, C.cream);
  }
  // Degraus com público.
  for (let row = 0; row < 7; row++) {
    const y0 = 12 + row * 7;
    p.rect(3, y0, W - 6, 7, '#3a2f7a');
    p.hline(3, y0, W - 6, '#5a4ab0');
    for (let x = 4; x < W - 4; x++) {
      for (let yy = y0 + 1; yy < y0 + 4; yy += 2) {
        if (r() < 0.6) p.px(x, yy, CROWD[Math.floor(r() * CROWD.length)]);
      }
    }
  }
  // Pilares e base.
  for (const x of [1, 59, 118]) p.vline(x, 10, H - 13, '#2a2f78');
  p.rect(0, H - 3, W, 3, '#0f0a2a');
  // Bandeirinhas do Brasil.
  for (const x of [10, 38, 66, 94]) {
    p.rect(x, 13, 4, 1, C.green);
    p.rect(x, 14, 4, 1, C.yellowCrowd);
    p.px(x + 1, 14, C.blueCrowd);
    p.px(x + 2, 14, C.blueCrowd);
  }
  return sprite(canvas, 3000, { color: C.amber, radius: 44, dy: -24 });
}

/** Torre de refletor alta e fina, com lâmpadas amarelas fortes. */
function floodlight(): SpriteArt {
  const W = 24;
  const H = 96;
  const { canvas, p } = makeCanvas(W, H);
  for (let y = 18; y <= 95; y++) {
    const w = y > 70 ? 5 : y > 40 ? 4 : 3;
    const x0 = 12 - Math.floor(w / 2);
    p.rect(x0, y, w, 1, '#2a2f78');
    p.px(x0, y, '#5a66c0');
    p.px(x0 + w - 1, y, '#0f1440');
    if (y % 8 === 0) p.hline(x0, y, w, '#0f1440');
  }
  // Cabeça com refletor.
  p.rect(2, 2, 20, 12, '#1a1f5a');
  p.rect(4, 4, 16, 8, C.amber);
  p.rect(7, 5, 10, 6, C.cream);
  p.vline(4, 4, 8, C.amberDeep);
  p.vline(19, 4, 8, C.amberDeep);
  p.frame(2, 2, 20, 12, C.ink);
  // Pés.
  p.rect(6, 92, 4, 4, '#1a1f5a');
  p.rect(14, 92, 4, 4, '#1a1f5a');
  return sprite(canvas, 500, { color: C.yellowCrowd, radius: 90, dy: -8 });
}

/** Sibipiruna verde-escura com recorte ciano. */
function tree(): SpriteArt {
  const W = 56;
  const H = 72;
  const { canvas, p } = makeCanvas(W, H);
  shadow(p, 28, 69, 16, 3, 0.35);
  p.rect(26, 44, 4, 26, '#3a2412');
  p.vline(26, 44, 26, '#7a4a22');
  blob(p, 28, 26, 22, 17, TREE_PAL, 11, 6, 0.18, 0, 0.45);
  blob(p, 16, 32, 11, 10, TREE_PAL, 12, 5);
  blob(p, 40, 32, 11, 10, TREE_PAL, 13, 5);
  blob(p, 28, 40, 14, 8, TREE_PAL, 14, 5);
  blob(p, 24, 18, 9, 7, LEAF_DARK_PAL, 15, 5);
  return sprite(canvas, 1200);
}

/** Ipê-amarelo florido: copa dourada com poucas folhas verdes. */
function ipe(): SpriteArt {
  const W = 56;
  const H = 64;
  const { canvas, p } = makeCanvas(W, H);
  shadow(p, 28, 61, 15, 3, 0.3);
  p.rect(26, 40, 4, 22, '#4a2a14');
  p.vline(26, 40, 22, '#8a5a2a');
  blob(p, 28, 26, 22, 17, LEAF_DARK_PAL, 21, 6, 0.18, 0, 0.45);
  blob(p, 18, 24, 12, 10, IPE_PAL, 22, 5);
  blob(p, 38, 22, 12, 10, IPE_PAL, 23, 5);
  blob(p, 28, 14, 11, 8, IPE_PAL, 24, 5);
  blob(p, 30, 34, 13, 8, IPE_PAL, 25, 5);
  return sprite(canvas, 1200);
}

// Fonte 3x5 do texto genérico da placa.
const FONT: Record<string, string[]> = {
  A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  'Ã': ['X.X', '.X.', 'XXX', 'X.X', 'X.X'],
  B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
  E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
  G: ['.XX', 'X..', 'X.X', 'X.X', '.XX'],
  I: ['XXX', '.X.', '.X.', '.X.', 'XXX'],
  L: ['X..', 'X..', 'X..', 'X..', 'XXX'],
  N: ['X.X', 'XXX', 'XXX', 'XXX', 'X.X'],
  O: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
  P: ['XX.', 'X.X', 'XX.', 'X..', 'X..'],
  R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'],
  S: ['.XX', 'X..', '.X.', '..X', 'XX.'],
  T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
  U: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
};

function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += ch === ' ' ? 3 : 4;
  return w - 1;
}

function drawText(p: Painter, text: string, x: number, y: number, color: string): void {
  let cx = x;
  for (const ch of text) {
    if (ch === ' ') {
      cx += 3;
      continue;
    }
    const glyph = FONT[ch];
    if (!glyph) throw new Error(`Glifo ausente: ${ch}`);
    glyph.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) if (row[rx] === 'X') p.px(cx + rx, y + ry, color);
    });
    cx += 4;
  }
}

/** Placa com texto genérico (sem marcas reais), sobre dois pés. */
function billboard(): SpriteArt {
  const W = 72;
  const H = 40;
  const { canvas, p } = makeCanvas(W, H);
  p.vline(14, 28, 12, '#2a2f78');
  p.vline(57, 28, 12, '#2a2f78');
  p.rect(12, 38, 6, 2, '#0f0a2a');
  p.rect(55, 38, 6, 2, '#0f0a2a');
  p.rect(0, 2, W, 26, C.navy);
  p.frame(0, 2, W, 26, C.cyan);
  p.rect(1, 3, W - 2, 2, C.carmine);
  p.rect(1, 24, W - 2, 2, C.amber);
  drawText(p, 'INTERLAGOS', Math.floor((W - textWidth('INTERLAGOS')) / 2), 8, C.amber);
  drawText(p, 'SÃO PAULO', Math.floor((W - textWidth('SÃO PAULO')) / 2), 16, C.cream);
  return sprite(canvas, 1400);
}

/** Posto de fiscal: cabine, fiscal com macacão laranja e bandeira amarela. */
function marshal(): SpriteArt {
  const W = 32;
  const H = 48;
  const { canvas, p } = makeCanvas(W, H);
  p.vline(27, 4, 22, '#2a2f78');
  p.rect(28, 6, 4, 6, C.yellowCrowd);
  p.hline(28, 6, 4, C.cream);
  p.rect(28, 12, 3, 1, C.amberDeep);
  p.rect(2, 40, 28, 8, '#1a1f5a');
  p.hline(2, 40, 28, '#4a58c0');
  p.block(6, 26, 20, 14, C.carmine, '#ff7a8c', C.carmineDeep, C.ink);
  p.rect(9, 29, 8, 4, C.navy);
  p.hline(9, 29, 8, C.cyan);
  p.rect(0, 22, 24, 4, C.carmineDeep);
  p.hline(0, 22, 24, '#ff3a6e');
  // fiscal
  p.rect(18, 19, 4, 4, C.yellowCrowd);
  p.rect(17, 23, 6, 4, C.orangeCrowd);
  p.px(18, 26, C.cream);
  return sprite(canvas, 900);
}

/** Barreira de pneus: duas fileiras com faixas vermelhas e brancas. */
function tyrewall(): SpriteArt {
  const W = 64;
  const H = 24;
  const { canvas, p } = makeCanvas(W, H);
  for (let i = 0; i < 8; i++) {
    disc(p, 4 + i * 8, 15, 4, 4, '#0d0a1f');
    disc(p, 4 + i * 8, 15, 2, 2, '#2e2a52');
  }
  for (let i = 0; i < 7; i++) {
    disc(p, 8 + i * 8, 8, 4, 4, '#0d0a1f');
    disc(p, 8 + i * 8, 8, 2, 2, '#2e2a52');
  }
  for (let x = 0; x < W; x += 4) {
    p.rect(x, 12, 4, 2, (x / 4) % 2 === 0 ? C.carmine : '#fff4c0');
  }
  p.hline(0, 23, W, '#04020a');
  return sprite(canvas, 1000);
}

/** Prédio dos boxes: fachada navy, faixa carmim e baias iluminadas em âmbar. */
function pitbuilding(): SpriteArt {
  const W = 160;
  const H = 56;
  const { canvas, p } = makeCanvas(W, H);
  p.rect(0, 10, W, 4, C.carmine);
  p.hline(0, 10, W, C.cyan);
  p.block(0, 14, W, 42, '#1d2470', '#3a46b0', '#121650', C.ink);
  // Janelas do andar de cima.
  for (let x = 6; x < W - 8; x += 12) {
    p.rect(x, 20, 8, 5, C.amber);
    p.hline(x, 20, 8, C.cream);
    p.frame(x, 20, 8, 5, C.ink);
  }
  // Baias: aberturas escuras com luz âmbar no fundo.
  for (let i = 0; i < 8; i++) {
    const x = 6 + i * 19;
    p.rect(x, 32, 15, 24, '#050617');
    p.rect(x + 2, 36, 11, 20, C.amberDeep);
    p.rect(x + 3, 37, 9, 6, C.cream);
    p.frame(x, 32, 15, 24, C.ink);
  }
  p.rect(0, H - 2, W, 2, '#0a0826');
  return sprite(canvas, 3200, { color: C.amber, radius: 60, dy: -20 });
}

/** Trecho de lago: superfície refletindo o céu (magenta, lilás, ciano e azul de cima para baixo). */
function lake(): SpriteArt {
  const W = 128;
  const H = 20;
  const { canvas, p } = makeCanvas(W, H);
  const r = rng(707);
  const bands: [number, string, string][] = [
    [0, C.carmine, '#ffc0d4'],
    [4, C.purple, '#e0a8ff'],
    [8, C.cyan, C.cyanLight],
    [14, C.blue, C.cyan],
  ];
  for (let y = 0; y < H; y++) {
    let base = bands[0];
    for (const b of bands) if (y >= b[0]) base = b;
    p.rect(0, y, W, 1, base[1]);
    // Ondulação: pequenos traços claros.
    const n = Math.floor(W / 12);
    for (let i = 0; i < n; i++) {
      if (r() < 0.5) continue;
      const x = Math.floor(r() * (W - 8));
      p.hline(x, y, 3 + Math.floor(r() * 5), base[2]);
    }
  }
  p.hline(0, 0, W, '#ffe0ec');
  return sprite(canvas, 2000);
}

/** Bloco de prédios próximos com janelas acesas e luz vermelha de antena. */
function skyline(): SpriteArt {
  const W = 160;
  const H = 96;
  const { canvas, p } = makeCanvas(W, H);
  const r = rng(555);
  let x = 0;
  while (x < W) {
    const bw = Math.min(W - x, 14 + Math.floor(r() * 18));
    const bh = 40 + Math.floor(r() * 52);
    const top = H - bh;
    p.rect(x, top, bw, bh, C.violetDeep);
    p.vline(x, top, bh, C.violetRim);
    p.hline(x, top, bw, '#4a3a92');
    for (let wy = top + 4; wy < H - 3; wy += 5) {
      for (let wx = x + 3; wx < x + bw - 2; wx += 4) {
        if (r() < 0.4) p.rect(wx, wy, 2, 2, C.amber);
        else if (r() < 0.3) p.px(wx, wy, C.purple);
      }
    }
    if (bh > 80 && r() < 0.6) {
      const ax = x + Math.floor(bw / 2);
      p.vline(ax, top - 8, 8, C.violetRim);
      p.px(ax, top - 9, C.signalRed);
    }
    x += bw;
  }
  return sprite(canvas, 3000, { color: C.amber, radius: 30, dy: -30 });
}

/** Todos os PropKind com sprite; base do sprite fica na última linha do canvas (sobre a estrada). */
export function buildProps(): Omit<Record<PropKind, SpriteArt>, 'bush' | 'fence' | 'flag' | 'tvtower'> {
  return {
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
  };
}
