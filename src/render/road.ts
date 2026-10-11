import { ROAD_WIDTH, SEGMENT_LENGTH, SEGMENT_METERS, UNITS_PER_METER, VIEW_H, VIEW_W, type ArtBundle, type CarSprites, type RaceState, type RoadPalette, type Segment, type SpriteArt } from '../contracts';
import { MAX_SPEED } from '../game/physics';
import { carBounce, poseForSteer, rivalSteer } from './pose';

/** Horizonte (px a partir do topo). */
export const HORIZON = 90;
/** Câmera 11 m atrás do carro e 7,5 m acima da pista. */
export const CAM_BACK = 11 * UNITS_PER_METER;
const CAM_H = 7.5 * UNITS_PER_METER;
/** Distância focal em px (FOV horizontal ~92°). Vale para x e y: projeção sem distorção. */
export const FOCAL = 250;
/** Distância de desenho: 130 segmentos de 5 m = 650 m. */
const DRAW = 130;
const NEAR = 2 * UNITS_PER_METER;
/** Base do carro do jogador na tela: onde o chão a CAM_BACK da câmera é projetado. */
const CAR_BASE_Y = Math.round(HORIZON + (FOCAL * CAM_H) / CAM_BACK);
/** Segment.curve (~180/R) -> deslocamento lateral por segmento² em unidades de mundo.
 *  Fisicamente 25/R metros por segmento²; o fator visual deixa o grampo legível sem sair da tela. */
export const CURVE_VISUAL = 1.15;
const CURVE_WORLD = ((SEGMENT_METERS * SEGMENT_METERS * UNITS_PER_METER) / 180) * CURVE_VISUAL;

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const v = h.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

interface Pal {
  asphalt: RGB[];
  grass: RGB[];
  shoulder: RGB[];
  kerb: RGB[];
  lane: RGB;
  fog: RGB;
}
const makePal = (r: RoadPalette): Pal => ({
  asphalt: [hex(r.asphaltLight), hex(r.asphaltDark)],
  grass: [hex(r.grassLight), hex(r.grassDark)],
  shoulder: [hex(r.shoulderLight), hex(r.shoulderDark)],
  kerb: [hex(r.kerbA), hex(r.kerbB)],
  lane: hex(r.lane),
  fog: hex(r.fog),
});

export interface GlowPoint {
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface Proj {
  x1: number; y1: number; w1: number; s1: number;
  x2: number; y2: number; w2: number;
  clip: number;
  fog: number;
  ok: boolean;
}

export interface RenderOpts {
  /** Relógio em segundos (para o quique e a deriva das nuvens). */
  time?: number;
  /** Deslocamento da câmera em px (só em batidas). */
  shakeX?: number;
  shakeY?: number;
  /** Esterço suavizado do jogador (-1..1). */
  steer?: number;
  onKerb?: boolean;
  offroad?: boolean;
}

const wrap = (v: number, n: number) => ((v % n) + n) % n;

export class RoadRenderer {
  private proj: Proj[] = Array.from({ length: DRAW }, () => ({ ok: false, x1: 0, y1: 0, w1: 0, s1: 0, x2: 0, y2: 0, w2: 0, clip: VIEW_H, fog: 0 }));
  private off = [0, 0, 0, 0];
  private lastZ = -1;
  private pal: Pal;
  private prevX: number[] = [];
  private latV: number[] = [];
  readonly glows: GlowPoint[] = [];
  camY = 0;

  constructor(private segments: Segment[], private trackLength: number, private art: ArtBundle) {
    this.pal = makePal(art.road);
  }

  setArt(art: ArtBundle): void {
    this.art = art;
    this.pal = makePal(art.road);
  }

  render(ctx: CanvasRenderingContext2D, race: RaceState, opts: RenderOpts = {}): GlowPoint[] {
    const { segments, art, pal } = this;
    const N = segments.length;
    const L = this.trackLength;
    const player = race.player;
    const t = opts.time ?? 0;
    const camZ = wrap(player.z - CAM_BACK, L);
    const baseIdx = Math.floor(camZ / SEGMENT_LENGTH) % N;
    const baseSeg = segments[baseIdx];
    const pct = (camZ % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const camY = CAM_H + baseSeg.y1 + (baseSeg.y2 - baseSeg.y1) * pct;
    this.camY = camY;
    const camX = player.x * ROAD_WIDTH;

    // parallax: curvatura acumulada (do trecho sob o jogador) e resposta vertical aos morros
    let dz = this.lastZ < 0 ? 0 : player.z - this.lastZ;
    if (dz < -L / 2) dz += L;
    if (dz < 0 || dz > 2000) dz = 0;
    this.lastZ = player.z;
    const pSeg = segments[Math.floor(player.z / SEGMENT_LENGTH) % N];
    const dc = pSeg.curve * (dz / SEGMENT_LENGTH) * 0.45;
    this.off[0] += dc * 0.04;
    this.off[1] += dc * 0.12;
    this.off[2] += dc * 0.35;
    this.off[3] += dc * 0.8;
    const slope = (baseSeg.y2 - baseSeg.y1) / SEGMENT_LENGTH;
    const lift = Math.max(-1, Math.min(1, slope * 0.8)) * 10;

    ctx.save();
    ctx.translate(Math.round(opts.shakeX ?? 0), Math.round(opts.shakeY ?? 0));
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = rgb(pal.grass[0], pal.fog, 0.4);
    ctx.fillRect(-8, HORIZON, VIEW_W + 16, VIEW_H - HORIZON + 8);
    ctx.fillStyle = rgb(pal.fog, pal.fog, 0);
    ctx.fillRect(-8, -8, VIEW_W + 16, HORIZON + 8);
    this.layer(ctx, art.sky, this.off[0], HORIZON - Math.round(art.sky.height * 0.7) + lift * 0.2);
    this.layer(ctx, art.clouds, this.off[1] + t * 1.5, HORIZON - art.clouds.height + 40 + lift * 0.4);
    this.layer(ctx, art.mountains, this.off[2], HORIZON - art.mountains.height + 3 + lift * 0.7);
    this.layer(ctx, art.hills, this.off[3], HORIZON - art.hills.height + 4 + lift);

    // projeção
    let x = 0;
    let dx = -(baseSeg.curve * CURVE_WORLD * pct);
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
      const s1 = FOCAL / z1;
      const s2 = FOCAL / z2;
      p.s1 = s1;
      p.x1 = half + s1 * (x - camX);
      p.y1 = HORIZON - s1 * (seg.y1 - camY);
      p.w1 = s1 * ROAD_WIDTH;
      p.x2 = half + s2 * (x + dx - camX);
      p.y2 = HORIZON - s2 * (seg.y2 - camY);
      p.w2 = s2 * ROAD_WIDTH;
      p.fog = 1 - Math.exp(-Math.pow(n / DRAW, 2) * 4.5);
      p.ok = zw2 > NEAR + 1 && p.y2 < p.y1 && p.y2 < maxY;
      p.clip = maxY;
      if (p.ok) {
        this.drawSegment(ctx, seg, p, maxY);
        maxY = Math.round(p.y2);
      }
      x += dx;
      dx += seg.curve * CURVE_WORLD;
    }

    // rivais por segmento (rel = distância à câmera)
    const byN = new Map<number, number[]>();
    const front: number[] = [];
    race.rivals.forEach((r, i) => {
      const rel = wrap(r.z - camZ, L);
      if (rel < NEAR + 40 || rel >= (DRAW - 1) * SEGMENT_LENGTH) return;
      if (rel >= CAM_BACK) {
        const n = Math.floor((camZ % SEGMENT_LENGTH + rel) / SEGMENT_LENGTH);
        const arr = byN.get(n);
        if (arr) arr.push(i);
        else byN.set(n, [i]);
      } else front.push(i);
    });
    // movimento lateral dos rivais para escolher a pose
    race.rivals.forEach((r, i) => {
      const prev = this.prevX[i] ?? r.x;
      this.latV[i] = (this.latV[i] ?? 0) * 0.85 + (r.x - prev) * 60 * 0.15;
      this.prevX[i] = r.x;
    });

    this.glows.length = 0;
    for (let n = DRAW - 1; n >= 0; n--) {
      const p = proj[n];
      const seg = segments[(baseIdx + n) % N];
      if (p.s1 > 0 && (baseIdx + n) * SEGMENT_LENGTH - camZ > NEAR) {
        for (const pl of seg.props) {
          const sp = art.props[pl.kind];
          if (sp) this.drawSprite(ctx, sp, p.x1 + p.w1 * pl.offset, p.y1, p.s1, p.clip, p.fog);
        }
      }
      const rs = byN.get(n);
      if (rs) for (const ri of rs) this.drawRival(ctx, race, ri, camZ, baseIdx);
    }
    this.drawPlayer(ctx, race, opts);
    front.sort((a, b) => wrap(race.rivals[b].z - camZ, L) - wrap(race.rivals[a].z - camZ, L));
    for (const ri of front) this.drawRival(ctx, race, ri, camZ, baseIdx);
    ctx.restore();
    return this.glows;
  }

  private drawRival(ctx: CanvasRenderingContext2D, race: RaceState, ri: number, camZ: number, baseIdx: number): void {
    const { segments, art } = this;
    const r = race.rivals[ri];
    const rel = wrap(r.z - camZ, this.trackLength);
    const rz = (camZ % SEGMENT_LENGTH) + rel;
    const n = Math.floor(rz / SEGMENT_LENGTH);
    const p = this.proj[n];
    if (!p) return;
    const seg = segments[(baseIdx + n) % segments.length];
    const t = (rz % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const sx = p.x1 + (p.x2 - p.x1) * t;
    const sy = p.y1 + (p.y2 - p.y1) * t;
    const w = p.w1 + (p.w2 - p.w1) * t;
    const car = art.rivalCars[r.sprite % art.rivalCars.length];
    if (!car) return;
    const sprite = car[poseForSteer(rivalSteer(seg.curve, this.latV[ri] ?? 0))];
    this.drawCar(ctx, sprite, sx + w * r.x, sy, sprite.widthMeters * UNITS_PER_METER * (FOCAL / rel), p.clip, p.fog);
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, race: RaceState, opts: RenderOpts): void {
    const car: CarSprites = this.art.playerCar;
    const st = race.player;
    const steer = opts.steer ?? 0;
    const sp = Math.max(0, Math.min(1, st.speed / MAX_SPEED));
    const seg = this.segments[Math.floor(st.z / SEGMENT_LENGTH) % this.segments.length];
    // deslocamento lateral leve: a curva empurra o carro para fora e o esterço puxa para dentro
    const carW = car.center.widthMeters * UNITS_PER_METER * (FOCAL / CAM_BACK);
    const cx = VIEW_W / 2 + Math.round(-seg.curve * sp * 0.8 + steer * 3);
    const bounce = carBounce(!!opts.onKerb, !!opts.offroad, sp, opts.time ?? 0);
    const baseY = CAR_BASE_Y - Math.round(bounce);
    // sombra elíptica
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(cx, CAR_BASE_Y - 1, carW * 0.5, Math.max(2, carW * 0.07), 0, 0, Math.PI * 2);
    ctx.fill();
    this.drawCar(ctx, car[poseForSteer(steer)], cx, baseY, carW, VIEW_H + 8, 0);
  }

  private drawCar(ctx: CanvasRenderingContext2D, sp: SpriteArt, cx: number, groundY: number, destW: number, clipY: number, fog: number): void {
    const c = sp.canvas;
    if (destW < 1 || destW > VIEW_W * 4) return;
    const destH = (destW * c.height) / c.width;
    const left = cx - destW / 2;
    if (left > VIEW_W || left + destW < 0) return;
    const clipH = Math.max(0, groundY - clipY);
    const visH = destH - clipH;
    if (visH <= 0) return;
    ctx.globalAlpha = 1 - fog * 0.6;
    ctx.drawImage(c, 0, 0, c.width, (c.height * visH) / destH, Math.round(left), Math.round(groundY - destH), Math.max(1, Math.round(destW)), Math.max(1, Math.round(visH)));
    ctx.globalAlpha = 1;
    if (sp.glow && clipH === 0) {
      const k = destW / c.width;
      this.glows.push({ x: cx, y: groundY - destH + sp.glow.dy * k, radius: Math.max(3, sp.glow.radius * k * 1.3), color: sp.glow.color });
    }
  }

  private layer(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, off: number, y: number): void {
    const w = img.width;
    if (w <= 0) return;
    const ox = Math.round(-wrap(off, w));
    for (let px = ox; px < VIEW_W; px += w) ctx.drawImage(img, px, Math.round(y));
  }

  private drawSegment(ctx: CanvasRenderingContext2D, seg: Segment, p: Proj, maxY: number): void {
    const { pal } = this;
    const f = p.fog;
    const fog = pal.fog;
    const par = (seg.index >> 2) & 1;
    const par2 = (seg.index >> 1) & 1;
    const y1 = Math.min(Math.round(p.y1), maxY);
    const y2 = Math.round(p.y2);
    const h = y1 - y2;
    if (h <= 0) return;

    ctx.fillStyle = rgb(pal.grass[par], fog, f);
    ctx.fillRect(-8, y2, VIEW_W + 16, h);

    // faixa entre as bordas fa..fb (múltiplos da meia pista); t0..t1 recorta em profundidade
    const quad = (fa: number, fb: number, t0 = 0, t1 = 1) => {
      const yA = y1 + (y2 - y1) * t0;
      const yB = y1 + (y2 - y1) * t1;
      const xa = (k: number, t: number) => Math.round(p.x1 + (p.x2 - p.x1) * t + (p.w1 + (p.w2 - p.w1) * t) * k);
      ctx.beginPath();
      ctx.moveTo(xa(fa, t0), yA);
      ctx.lineTo(xa(fb, t0), yA);
      ctx.lineTo(xa(fb, t1), yB);
      ctx.lineTo(xa(fa, t1), yB);
      ctx.closePath();
      ctx.fill();
    };

    // acostamento, zebra, asfalto e linhas de borda
    ctx.fillStyle = rgb(pal.shoulder[par2], fog, f);
    quad(-1.45, -1, 0, 1);
    quad(1, 1.45, 0, 1);
    if (seg.kerb) {
      ctx.fillStyle = rgb(pal.kerb[(seg.index >> 1) & 1], fog, f);
      quad(-1.14, -1);
      quad(1, 1.14);
    }
    ctx.fillStyle = rgb(pal.asphalt[par], fog, f);
    quad(-1, 1);
    ctx.fillStyle = rgb(pal.lane, fog, f);
    quad(-0.985, -0.945);
    quad(0.945, 0.985);

    // linha central tracejada só na Reta dos Boxes
    if (seg.sectionName === 'Reta dos Boxes' && seg.index % 4 < 2) quad(-0.012, 0.012);

    // faixa quadriculada de largada/chegada
    if (seg.index === 0) {
      const cols = 12;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = rgb((c + r) % 2 === 0 ? [250, 250, 250] : [24, 26, 34], fog, f);
          quad(-1 + (2 * c) / cols, -1 + (2 * (c + 1)) / cols, r / 2, (r + 1) / 2);
        }
      }
    }
  }

  private drawSprite(ctx: CanvasRenderingContext2D, sp: SpriteArt, cx: number, groundY: number, scale: number, clipY: number, fog: number): void {
    const c = sp.canvas;
    const destW = sp.widthMeters * UNITS_PER_METER * scale;
    if (destW < 1 || destW > VIEW_W * 8) return;
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

function rgb(c: RGB, fog: RGB, f: number): string {
  return `rgb(${Math.round(c[0] + (fog[0] - c[0]) * f)},${Math.round(c[1] + (fog[1] - c[1]) * f)},${Math.round(c[2] + (fog[2] - c[2]) * f)})`;
}
