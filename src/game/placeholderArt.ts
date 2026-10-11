import { VIEW_H, VIEW_W, type ArtBundle, type PropKind, type SpriteArt } from '../contracts';

function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function box(w: number, h: number, color: string, worldWidth: number, glow?: SpriteArt['glow'], top?: string): SpriteArt {
  const [canvas, g] = cv(w, h);
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  if (top) {
    g.fillStyle = top;
    g.fillRect(0, 0, w, Math.max(2, h >> 3));
  }
  return { canvas, worldWidth, glow };
}

/** Arte provisória de retângulos coloridos (fallback quando src/art/index.ts não existe). */
export function buildPlaceholderArt(): ArtBundle {
  const props: Record<PropKind, SpriteArt> = {
    grandstand: box(64, 32, '#4a3a5a', 1600, { color: '#ffb347', radius: 40, dy: 8 }, '#ffb347'),
    floodlight: box(6, 64, '#9fb6d0', 120, { color: '#e8f4ff', radius: 36, dy: 0 }, '#ffffff'),
    tree: box(24, 48, '#1f6b55', 500),
    ipe: box(24, 48, '#e8c020', 500),
    billboard: box(40, 24, '#1e4f9a', 700, undefined, '#ffffff'),
    marshal: box(12, 20, '#d04a2a', 260, { color: '#ff9040', radius: 14, dy: 2 }),
    tyrewall: box(40, 10, '#1a1a22', 600, undefined, '#c0392b'),
    pitbuilding: box(80, 36, '#2b3a55', 2200, { color: '#7fd0ff', radius: 30, dy: 10 }),
    lake: box(80, 6, '#17406a', 3000),
    skyline: box(120, 50, '#0e1a36', 5000, { color: '#ffd070', radius: 20, dy: 20 }),
  };
  const colors = ['#d62839', '#f0a30a', '#1b9aaa', '#9b5de5', '#e8e8f0'];
  const rivalCars = colors.map((c) => {
    const [canvas, g] = cv(36, 16);
    g.fillStyle = '#111';
    g.fillRect(0, 6, 8, 10);
    g.fillRect(28, 6, 8, 10);
    g.fillStyle = c;
    g.fillRect(8, 2, 20, 12);
    g.fillRect(4, 10, 28, 4);
    g.fillStyle = '#ff3030';
    g.fillRect(14, 0, 8, 3);
    return { canvas, worldWidth: 480, glow: { color: '#ff2020', radius: 10, dy: 2 } } as SpriteArt;
  });

  const [sky, s] = cv(VIEW_W * 2, 130);
  const gr = s.createLinearGradient(0, 0, 0, 130);
  gr.addColorStop(0, '#050c24');
  gr.addColorStop(0.6, '#10306a');
  gr.addColorStop(1, '#2a7a9a');
  s.fillStyle = gr;
  s.fillRect(0, 0, sky.width, 130);
  s.fillStyle = '#ffffff';
  for (let i = 0; i < 60; i++) s.fillRect((i * 97) % sky.width, (i * 31) % 70, 1, 1);

  const [hills, h] = cv(VIEW_W * 2, 50);
  h.fillStyle = '#0a1830';
  for (let x = 0; x < hills.width; x += 8) {
    const hh = 14 + 10 * Math.sin(x * 0.03) + 8 * Math.sin(x * 0.11);
    h.fillRect(x, 50 - hh, 8, hh);
  }
  h.fillStyle = '#ffd070';
  for (let i = 0; i < 40; i++) h.fillRect((i * 53) % hills.width, 40 + (i % 5), 1, 1);

  const [cockpit, c] = cv(VIEW_W, VIEW_H);
  c.fillStyle = '#0b0d14';
  c.beginPath();
  c.moveTo(0, VIEW_H);
  c.lineTo(0, 170);
  c.lineTo(150, 215);
  c.lineTo(190, VIEW_H);
  c.fill();
  c.beginPath();
  c.moveTo(VIEW_W, VIEW_H);
  c.lineTo(VIEW_W, 170);
  c.lineTo(VIEW_W - 150, 215);
  c.lineTo(VIEW_W - 190, VIEW_H);
  c.fill();
  c.fillRect(VIEW_W / 2 - 70, 216, 140, 54);
  c.fillStyle = '#16192a';
  c.fillRect(0, 150, 24, 60);
  c.fillRect(VIEW_W - 24, 150, 24, 60);

  const [wheel, w] = cv(120, 70);
  w.fillStyle = '#1b1d28';
  w.fillRect(0, 12, 120, 40);
  w.fillStyle = '#2c3044';
  w.fillRect(30, 0, 60, 70);
  w.fillStyle = '#05080c';
  w.fillRect(40, 8, 40, 22);

  return { props, rivalCars, sky, hills, cockpit, wheel, wheelDisplay: { x: 40, y: 8, w: 40, h: 22 } };
}
