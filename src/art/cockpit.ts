import { makeCanvas, type Painter } from './canvas';
import { disc } from './draw';
import { C } from './palette';

/** Área do display central do volante, em pixels do canvas do volante (140x70). */
export const WHEEL_DISPLAY = { x: 38, y: 22, w: 64, h: 23 };

/** Halo de titânio: arco em cima, arcos laterais descendo e pilar central fino. */
function halo(p: Painter): void {
  const CX = 240;
  const tube = ['#eef4ff', '#b8c6e0', '#7f8fb0', '#7f8fb0', '#2a3560'];
  for (let x = 96; x <= 384; x++) {
    const dx = (x - CX) / 144;
    const top = Math.round(22 + dx * dx * 108);
    tube.forEach((c, t) => p.px(x, top + t, c));
  }
  // Arcos laterais: continuam do arco até a carenagem.
  for (let y = 130; y <= 214; y++) {
    const xl = Math.round(96 - (y - 130) * 0.45);
    const xr = 480 - 1 - xl;
    for (let t = 0; t < 4; t++) {
      const c = ['#eef4ff', '#b8c6e0', '#7f8fb0', '#2a3560'][t];
      p.px(xl + t, y, c);
      p.px(xr - t, y, c);
    }
  }
  // Pilar central fino, descendo até a base.
  p.vline(239, 27, 243, '#7f8fb0');
  p.vline(238, 27, 243, '#b8c6e0');
  p.vline(240, 27, 243, '#2a3560');
}

/** Carenagem lateral do monocoque em carmim, com recorte ciano na borda superior. */
function pods(p: Painter): void {
  for (let x = 0; x < 120; x++) {
    const top = Math.round(232 - x * 0.22);
    p.rect(x, top, 1, 270 - top, C.carmine);
    p.px(x, top, C.cyan);
    p.px(x, top + 1, '#ff7a8c');
    p.px(x, top + 14, C.carmineDeep);
    p.rect(x, 252, 1, 18, C.carmineDeep);
    // lado de dentro da carenagem fica um pouco mais escuro
    if (x > 90) p.px(x, top + 2, '#ff3a6e');
  }
}

/** Pneu dianteiro com cantos arredondados e aro discreto. */
function frontTyre(p: Painter, x0: number, y0: number): void {
  const w = 50;
  const h = 70;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cornerX = Math.min(x, w - 1 - x);
      const cornerY = Math.min(y, h - 1 - y);
      if (cornerX + cornerY < 5 && cornerX < 5 && cornerY < 5) continue;
      p.px(x0 + x, y0 + y, C.tyre);
    }
  }
  p.hline(x0 + 8, y0 + 1, w - 16, '#2e2a52');
  p.hline(x0 + 6, y0 + 2, w - 12, '#1d1b38');
  p.rect(x0 + 14, y0 + 30, w - 28, 10, '#17152e');
  p.hline(x0 + 14, y0 + 30, w - 28, '#3a3d66');
}

/** Retrovisor pequeno, com carcaça carmim e vidro ciano. */
function mirror(p: Painter, x0: number, y0: number, flip: boolean): void {
  const sx = (x: number) => (flip ? x0 + 13 - x : x0 + x);
  // haste
  p.rect(flip ? x0 + 4 : x0 + 9, y0 + 9, 2, 60, C.carmineDeep);
  p.rect(sx(0), y0, 14, 9, C.carmine);
  p.hline(sx(1), y0, 12, '#ff7a8c');
  p.frame(sx(0), y0, 14, 9, C.carmineDeep);
  p.rect(sx(2), y0 + 2, 9, 5, C.navy);
  p.hline(sx(3), y0 + 2, 6, C.cyan);
}

/** Cockpit 480x270, transparente no centro. Desenhado na ordem: pneus, carenagem, halo e retrovisores. */
export function cockpit(): HTMLCanvasElement {
  const { canvas, p } = makeCanvas(480, 270);
  pods(p);
  // Carenagem espelhada à direita.
  for (let x = 0; x < 120; x++) {
    const top = Math.round(232 - x * 0.22);
    const xr = 479 - x;
    p.rect(xr, top, 1, 270 - top, C.carmine);
    p.px(xr, top, C.cyan);
    p.px(xr, top + 1, '#ff7a8c');
    p.px(xr, top + 14, C.carmineDeep);
    p.rect(xr, 252, 1, 18, C.carmineDeep);
    if (x > 90) p.px(xr, top + 2, '#ff3a6e');
  }
  frontTyre(p, 0, 200);
  frontTyre(p, 430, 200);
  halo(p);
  mirror(p, 40, 146, false);
  mirror(p, 426, 146, true);
  return canvas;
}

/** Volante de F1 140x70: manoplas nas laterais, LEDs de rpm no topo e display central preto azulado vazio. */
export function wheel(): HTMLCanvasElement {
  const { canvas, p } = makeCanvas(140, 70);
  // Corpo principal.
  p.block(4, 12, 132, 56, '#1a1d3e', '#3d4680', '#0a0c20', C.ink);
  // Faixa de LEDs de rpm no topo.
  p.rect(30, 3, 80, 7, '#070a1e');
  p.frame(30, 3, 80, 7, '#2a3a7a');
  for (let i = 0; i < 15; i++) {
    const lit = i < 9;
    const color = !lit ? '#22305a' : i < 4 ? C.green : i < 7 ? C.cyan : i < 9 ? C.amber : C.signalRed;
    p.rect(35 + i * 5, 6, 3, 2, color);
  }
  // Manoplas (grips) com textura de borracha.
  for (const x0 of [0, 117]) {
    p.rect(x0, 24, 23, 44, '#23285a');
    p.speckle(x0 + 1, 25, 21, 42, ['#141838', '#2b3370'], 0.22, mulberryLike(x0 + 3));
    p.frame(x0, 24, 23, 44, C.ink);
    p.vline(x0 + 1, 26, 40, '#3d4880');
  }
  // Display central: preto azulado, vazio (o HUD escreve por cima).
  const d = WHEEL_DISPLAY;
  p.rect(d.x, d.y, d.w, d.h, '#060a22');
  p.frame(d.x, d.y, d.w, d.h, '#2a3a7a');
  p.hline(d.x + 1, d.y + 1, d.w - 2, '#101a44');
  // Rotativos laterais.
  disc(p, 28, 40, 3, 3, C.amber);
  disc(p, 28, 40, 1, 1, '#3a2a06');
  disc(p, 111, 40, 3, 3, C.cyan);
  disc(p, 111, 40, 1, 1, '#06304a');
  // Botões coloridos abaixo do display.
  for (const [x, c] of [
    [44, C.cyan],
    [52, C.carmine],
    [88, C.amber],
    [96, C.green],
  ] as const) {
    disc(p, x, 51, 2.5, 2.5, c);
    p.px(x, 51, '#ffffff');
  }
  // Fenda de paddle e base.
  p.hline(30, 60, 80, '#0a0c20');
  p.hline(30, 61, 80, '#1d2350');
  return canvas;
}

/** Ruído determinístico simples para a textura da manopla. */
function mulberryLike(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
