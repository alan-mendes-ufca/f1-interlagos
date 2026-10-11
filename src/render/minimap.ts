import { SEGMENT_LENGTH, type TrackGeometry } from '../contracts';
import { cornerDetails } from '../track/geometry';

/** Minimapa: traçado real da TrackGeometry girado para caber no painel. */

export interface MapLayout {
  /** Pontos do traçado em coordenadas do painel (px). */
  pts: { x: number; y: number }[];
}

export const MAP_W = 130;
export const MAP_H = 88;
const PAD = 9;
const HEADER = 0;
const FOOT = 13;

const cache = new WeakMap<TrackGeometry, MapLayout>();

/** Gira a polilinha pelo eixo principal (PCA) e ajusta ao retângulo útil do painel. */
export function layoutMap(geo: TrackGeometry, w = MAP_W, h = MAP_H): MapLayout {
  const hit = cache.get(geo);
  if (hit) return hit;
  const p = geo.points;
  const n = p.length;
  const mx = p.reduce((s, q) => s + q.x, 0) / n;
  const my = p.reduce((s, q) => s + q.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const q of p) {
    sxx += (q.x - mx) ** 2;
    syy += (q.y - my) ** 2;
    sxy += (q.x - mx) * (q.y - my);
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const c = Math.cos(-ang);
  const s = Math.sin(-ang);
  // norte para cima: y do mapa = -y do mundo
  const rot = p.map((q) => ({ x: (q.x - mx) * c - (q.y - my) * s, y: -((q.x - mx) * s + (q.y - my) * c) }));
  const minX = Math.min(...rot.map((q) => q.x));
  const maxX = Math.max(...rot.map((q) => q.x));
  const minY = Math.min(...rot.map((q) => q.y));
  const maxY = Math.max(...rot.map((q) => q.y));
  const aw = w - 2 * PAD;
  const ah = h - 2 * PAD - HEADER - FOOT;
  const k = Math.min(aw / (maxX - minX), ah / (maxY - minY));
  const ox = (w - (maxX - minX) * k) / 2 - minX * k;
  const oy = PAD + HEADER + (ah - (maxY - minY) * k) / 2 - minY * k;
  const layout = { pts: rot.map((q) => ({ x: q.x * k + ox, y: q.y * k + oy })) };
  cache.set(geo, layout);
  return layout;
}

/** Posição (px do painel) de um carro a `z` unidades de mundo da largada. */
export function mapPoint(layout: MapLayout, z: number, trackLength: number): { x: number; y: number } {
  const n = layout.pts.length;
  const f = (((z / trackLength) % 1) + 1) % 1;
  const t = f * n;
  const i = Math.floor(t) % n;
  const a = layout.pts[i];
  const b = layout.pts[(i + 1) % n];
  const u = t - Math.floor(t);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

/** Rótulo "T10 Bico de Pato" se o segmento está numa curva; senão o nome do trecho. */
export function mapLabel(geo: TrackGeometry, segIndex: number, sectionName: string): string {
  const c = cornerDetails(geo).find((k) => segIndex >= k.entryIndex && segIndex <= k.exitIndex);
  return c ? `T${c.turn} ${c.name}` : sectionName;
}

export interface MapCar {
  z: number;
  color: string;
}

export interface MinimapInput {
  geo: TrackGeometry;
  trackLength: number;
  player: { z: number };
  rivals: MapCar[];
  sectionName: string;
  clock: number;
  panel: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
  label: (ctx: CanvasRenderingContext2D, s: string, x: number, y: number) => void;
}

/** Desenha o painel do minimapa com o canto superior esquerdo em (x, y). */
export function drawMinimap(ctx: CanvasRenderingContext2D, x: number, y: number, m: MinimapInput): void {
  const lay = layoutMap(m.geo);
  m.panel(ctx, x, y, MAP_W, MAP_H);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const path = () => {
    ctx.beginPath();
    lay.pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
    ctx.closePath();
  };
  path();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#020a24';
  ctx.stroke();
  path();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // linha de chegada quadriculada
  const f = lay.pts[0];
  const g = lay.pts[1];
  const dx = g.x - f.x;
  const dy = g.y - f.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = -1; i <= 1; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#10142a';
      ctx.fillRect(Math.round(f.x + nx * 3 * i + (dx / len) * j - 1), Math.round(f.y + ny * 3 * i + (dy / len) * j - 1), 2, 2);
    }
  }

  for (const r of m.rivals) {
    const q = mapPoint(lay, r.z, m.trackLength);
    ctx.fillStyle = '#020a24';
    ctx.fillRect(Math.round(q.x) - 2, Math.round(q.y) - 2, 5, 5);
    ctx.fillStyle = r.color;
    ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 3, 3);
  }
  // jogador: ponto carmim maior, piscando
  const pq = mapPoint(lay, m.player.z, m.trackLength);
  const on = Math.floor(m.clock * 4) % 2 === 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(pq.x) - 3, Math.round(pq.y) - 3, 7, 7);
  ctx.fillStyle = on ? '#e0143c' : '#7a0a22';
  ctx.fillRect(Math.round(pq.x) - 2, Math.round(pq.y) - 2, 5, 5);
  ctx.restore();

  const seg = Math.floor(m.player.z / SEGMENT_LENGTH) % m.geo.points.length;
  m.label(ctx, mapLabel(m.geo, seg, m.sectionName), x + MAP_W / 2, y + MAP_H - FOOT - 1);
}

type RGB = [number, number, number];
const paintCache = new WeakMap<HTMLCanvasElement, string>();

/** Cor dominante (saturada) de uma pintura de carro, para o ponto do rival. */
export function paintColor(canvas: HTMLCanvasElement | undefined, fallback: string): string {
  if (!canvas) return fallback;
  const hit = paintCache.get(canvas);
  if (hit) return hit;
  let out = fallback;
  try {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const bins = new Map<number, { n: number; c: RGB }>();
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) continue;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        if (mx < 70 || (mx - mn) / Math.max(1, mx) < 0.45) continue; // descarta escuros e cinzas
        const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
        const e = bins.get(key);
        if (e) e.n++;
        else bins.set(key, { n: 1, c: [r, g, b] });
      }
      let best = 0;
      for (const e of bins.values()) {
        if (e.n > best) {
          best = e.n;
          out = `rgb(${e.c[0]},${e.c[1]},${e.c[2]})`;
        }
      }
    }
  } catch {
    /* canvas sem leitura: usa a cor padrão */
  }
  paintCache.set(canvas, out);
  return out;
}
