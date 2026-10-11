import { ROAD_WIDTH, SEGMENT_LENGTH, VIEW_H, VIEW_W, type ArtBundle, type RaceState, type Segment } from '../contracts';

export const HORIZON = 112;
const CAM_H = 780;
const CAM_DEPTH = 0.95;
const DRAW = 220;
const NEAR = 20;

type RGB = [number, number, number];
const FOG: RGB = [7, 20, 52];
const C = {
  asphalt: [[44, 56, 78], [48, 61, 84]] as RGB[],
  grass: [[22, 92, 86], [18, 82, 80]] as RGB[],
  kerbRed: [196, 28, 52] as RGB,
  kerbWhite: [236, 240, 248] as RGB,
  line: [232, 238, 248] as RGB,
  edge: [214, 222, 236] as RGB,
};

const rgb = (c: RGB, f: number) =>
  `rgb(${Math.round(c[0] + (FOG[0] - c[0]) * f)},${Math.round(c[1] + (FOG[1] - c[1]) * f)},${Math.round(c[2] + (FOG[2] - c[2]) * f)})`;

export interface GlowPoint {
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface Proj {
  ok: boolean;
  x1: number; y1: number; w1: number; s1: number;
  x2: number; y2: number; w2: number;
  clip: number;
  fog: number;
}

export interface RenderOpts {
  /** Deslocamento da câmera em px (sacudida). */
  shakeX?: number;
  shakeY?: number;
}

export class RoadRenderer {
  private proj: Proj[] = Array.from({ length: DRAW }, () => ({ ok: false, x1: 0, y1: 0, w1: 0, s1: 0, x2: 0, y2: 0, w2: 0, clip: VIEW_H, fog: 0 }));
  private skyOff = 0;
  private hillOff = 0;
  private lastZ = -1;
  readonly glows: GlowPoint[] = [];
  /** Altura da câmera no último frame (útil para sacudida/HUD). */
  camY = 0;

  constructor(private segments: Segment[], private trackLength: number, private art: ArtBundle) {}

  setArt(art: ArtBundle): void {
    this.art = art;
  }

  render(ctx: CanvasRenderingContext2D, race: RaceState, opts: RenderOpts = {}): GlowPoint[] {
    const { segments, art } = this;
    const N = segments.length;
    const player = race.player;
    const camZ = player.z;
    const baseIdx = Math.floor(camZ / SEGMENT_LENGTH) % N;
    const baseSeg = segments[baseIdx];
    const pct = (camZ % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const camY = CAM_H + baseSeg.y1 + (baseSeg.y2 - baseSeg.y1) * pct;
    this.camY = camY;
    const camX = player.x * ROAD_WIDTH;

    // parallax
    let dz = this.lastZ < 0 ? 0 : camZ - this.lastZ;
    if (dz < -this.trackLength / 2) dz += this.trackLength;
    if (dz < 0 || dz > 2000) dz = 0;
    this.lastZ = camZ;
    this.skyOff += baseSeg.curve * (dz / SEGMENT_LENGTH) * 0.35;
    this.hillOff += baseSeg.curve * (dz / SEGMENT_LENGTH) * 0.9;
    const lift = Math.max(-14, Math.min(14, (camY - CAM_H) * -0.004));

    ctx.save();
    ctx.translate(Math.round(opts.shakeX ?? 0), Math.round(opts.shakeY ?? 0));
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = rgb(C.grass[0], 0.4);
    ctx.fillRect(-8, HORIZON, VIEW_W + 16, VIEW_H - HORIZON + 8);
    ctx.fillStyle = rgb([8, 24, 70], 0);
    ctx.fillRect(-8, -8, VIEW_W + 16, HORIZON + 8);
    this.drawParallax(ctx, art.sky, this.skyOff, HORIZON - art.sky.height + 24 + lift * 0.5);
    this.drawParallax(ctx, art.hills, this.hillOff, HORIZON - art.hills.height + 2 + lift);

    // projeção
    let x = 0;
    let dx = -(baseSeg.curve * pct);
    let maxY = VIEW_H + 8;
    const half = VIEW_W / 2;
    const proj = this.proj;
    for (let n = 0; n < DRAW; n++) {
      const seg = segments[(baseIdx + n) % N];
      const p = proj[n];
      const zw1 = (baseIdx + n) * SEGMENT_LENGTH - camZ;
      const zw2 = zw1 + SEGMENT_LENGTH;
      const z1 = Math.max(NEAR, zw1);
      const z2 = Math.max(NEAR + 1, zw2);
      const s1 = CAM_DEPTH / z1;
      const s2 = CAM_DEPTH / z2;
      p.s1 = s1;
      p.x1 = half + s1 * (-(x) - camX) * half;
      p.y1 = HORIZON - s1 * (seg.y1 - camY) * (VIEW_H / 2);
      p.w1 = s1 * ROAD_WIDTH * half;
      p.x2 = half + s2 * (-(x + dx) - camX) * half;
      p.y2 = HORIZON - s2 * (seg.y2 - camY) * (VIEW_H / 2);
      p.w2 = s2 * ROAD_WIDTH * half;
      p.fog = 1 - Math.exp(-Math.pow(n / DRAW, 2) * 4.5);
      p.ok = zw2 > NEAR + 1 && p.y2 < p.y1 && p.y2 < maxY;
      p.clip = maxY;
      if (p.ok) {
        this.drawSegment(ctx, seg, p, maxY);
        maxY = p.y2;
      }
      x += dx;
      dx += seg.curve;
    }

    // sprites de trás para frente
    this.glows.length = 0;
    const byIndex = new Map<number, number[]>();
    race.rivals.forEach((r, i) => {
      const si = Math.floor(r.z / SEGMENT_LENGTH) % N;
      const arr = byIndex.get(si);
      if (arr) arr.push(i);
      else byIndex.set(si, [i]);
    });
    for (let n = DRAW - 1; n >= 0; n--) {
      const p = proj[n];
      const segIdx = (baseIdx + n) % N;
      const seg = segments[segIdx];
      if (p.s1 > 0 && (baseIdx + n) * SEGMENT_LENGTH - camZ > NEAR) {
        for (const pl of seg.props) {
          const sp = art.props[pl.kind];
          if (sp) this.drawSprite(ctx, sp, p.x1 + p.w1 * pl.offset, p.y1, p.s1, p.clip, p.fog);
        }
      }
      const rs = byIndex.get(segIdx);
      if (rs) {
        for (const ri of rs) {
          const r = race.rivals[ri];
          const rel = (baseIdx + n) * SEGMENT_LENGTH + (r.z % SEGMENT_LENGTH) - camZ;
          if (rel < 60) continue;
          const t = (r.z % SEGMENT_LENGTH) / SEGMENT_LENGTH;
          const sx = p.x1 + (p.x2 - p.x1) * t;
          const sy = p.y1 + (p.y2 - p.y1) * t;
          const w = p.w1 + (p.w2 - p.w1) * t;
          const scale = CAM_DEPTH / rel;
          const car = art.rivalCars[r.sprite % art.rivalCars.length];
          if (car) this.drawSprite(ctx, car, sx + w * r.x, sy, scale, p.clip, p.fog);
        }
      }
    }
    ctx.restore();
    return this.glows;
  }

  private drawParallax(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, off: number, y: number): void {
    const w = img.width;
    let ox = -(((off % w) + w) % w);
    ox = Math.round(ox);
    for (let px = ox; px < VIEW_W; px += w) ctx.drawImage(img, px, Math.round(y));
  }

  private drawSegment(ctx: CanvasRenderingContext2D, seg: Segment, p: Proj, maxY: number): void {
    const f = p.fog;
    const par = (seg.index >> 2) & 1;
    const y1 = Math.min(Math.round(p.y1), maxY);
    const y2 = Math.round(p.y2);
    const h = y1 - y2;
    if (h <= 0) return;

    ctx.fillStyle = rgb(C.grass[par], f);
    ctx.fillRect(-8, y2, VIEW_W + 16, h);

    const quad = (fa: number, fb: number) => {
      ctx.beginPath();
      ctx.moveTo(Math.round(p.x1 + p.w1 * fa), y1);
      ctx.lineTo(Math.round(p.x1 + p.w1 * fb), y1);
      ctx.lineTo(Math.round(p.x2 + p.w2 * fb), y2);
      ctx.lineTo(Math.round(p.x2 + p.w2 * fa), y2);
      ctx.closePath();
      ctx.fill();
    };

    if (seg.kerb) {
      ctx.fillStyle = rgb((seg.index & 1) === 0 ? C.kerbRed : C.kerbWhite, f);
      quad(-1.12, -1);
      quad(1, 1.12);
    } else {
      ctx.fillStyle = rgb(C.edge, f);
      quad(-1.02, -0.985);
      quad(0.985, 1.02);
    }
    ctx.fillStyle = rgb(C.asphalt[par], f);
    quad(-1, 1);

    // reta de largada: linha central tracejada e faixa de chegada
    const nearStart = seg.index < 28 || seg.index >= this.segments.length - 10;
    if (nearStart && seg.index % 4 < 2 && seg.index < 28) {
      ctx.fillStyle = rgb(C.line, f);
      quad(-0.012, 0.012);
    }
    if (seg.index === 0) {
      ctx.fillStyle = rgb(C.line, f);
      quad(-1, 1);
      ctx.fillStyle = rgb([20, 24, 34], f);
      for (let k = -4; k < 4; k += 2) quad(k / 4, (k + 1) / 4);
    }
  }

  private drawSprite(ctx: CanvasRenderingContext2D, sp: { canvas: HTMLCanvasElement; worldWidth: number; glow?: { color: string; radius: number; dy: number } }, cx: number, groundY: number, scale: number, clipY: number, fog: number): void {
    const c = sp.canvas;
    const destW = sp.worldWidth * scale * (VIEW_W / 2);
    if (destW < 1 || destW > VIEW_W * 4) return;
    const destH = (destW * c.height) / c.width;
    const top = groundY - destH;
    const left = cx - destW / 2;
    if (left > VIEW_W || left + destW < 0) return;
    const clipH = Math.max(0, groundY - clipY);
    const visH = destH - clipH;
    if (visH <= 0) return;
    ctx.globalAlpha = 1 - fog * 0.85;
    ctx.drawImage(c, 0, 0, c.width, (c.height * visH) / destH, Math.round(left), Math.round(top), Math.max(1, Math.round(destW)), Math.max(1, Math.round(visH)));
    ctx.globalAlpha = 1;
    if (sp.glow && clipH === 0) {
      const k = destW / c.width;
      this.glows.push({ x: cx, y: top + sp.glow.dy * k, radius: sp.glow.radius * k * 1.3, color: sp.glow.color });
    }
  }
}
