import type { Painter } from './canvas';
import { bayer, lerpHex } from './util';

/* Mini rasterizador 3D para a arte dos carros: modelo em metros, z-buffer, sombreamento
   em 4 tons por material (sem antialiasing), contorno e luz de recorte em pós-processo.
   Serve para que as poses left/right tenham perspectiva de verdade (a carroceria gira). */

export type V3 = readonly [number, number, number];
export type Tones = readonly [string, string, string, string];
/** Textura procedural: devolve cor, índice de tom (0..3) ou null (usa o sombreamento). */
export type TexFn = (u: number, v: number) => string | number | null;

export interface Prim {
  pts: V3[];
  uv?: [number, number][];
  /** Normais por vértice (espaço do modelo, unitárias). */
  nrm: V3[];
  tones: Tones;
  part: number;
  tex?: TexFn;
  /** Tom fixo (ignora a luz). */
  unlit?: number;
  /** Mais que 1 aproxima da câmera no teste de profundidade (decalques). */
  bias?: number;
}

export interface Tube {
  a: V3;
  b: V3;
  color: string;
  part: number;
}

export interface CamCfg {
  yaw: number;
  /** Pivô do giro (z, em metros). */
  pivotZ: number;
  pitch: number;
  dist: number;
  focal: number;
  /** Centro do sprite em px e pixel y do ponto de referência no chão. */
  cx: number;
  groundY: number;
  groundRef: V3;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export class Scene {
  prims: Prim[] = [];
  tubes: Tube[] = [];

  /** Polígono convexo com normal para fora do sólido cujo centro é `center`. */
  face(pts: V3[], center: V3, tones: Tones, part: number, opts: { uv?: [number, number][]; tex?: TexFn; unlit?: number; bias?: number } = {}): void {
    let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
    const fc: V3 = [
      pts.reduce((s, q) => s + q[0], 0) / pts.length,
      pts.reduce((s, q) => s + q[1], 0) / pts.length,
      pts.reduce((s, q) => s + q[2], 0) / pts.length,
    ];
    if (dot(n, sub(fc, center)) < 0) n = [-n[0], -n[1], -n[2]];
    this.prims.push({ pts, nrm: pts.map(() => n), tones, part, ...opts });
  }

  box(b: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }, tones: Tones, part: number, tex: { rear?: TexFn; top?: TexFn; side?: TexFn } = {}): void {
    const { x0, x1, y0, y1, z0, z1 } = b;
    const c: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    this.loft([{ z: z0, xl: x0, xr: x1, y0, y1 }, { z: z1, xl: x0, xr: x1, y0, y1 }], tones, part, c, tex);
  }

  /** Sólido entre seções transversais (z crescente), lados e tampas. */
  loft(secs: Sec[], tones: Tones, part: number, center: V3 | null, tex: { rear?: TexFn; top?: TexFn; side?: TexFn } = {}): void {
    const c = center ?? [0, (secs[0].y0 + secs[0].y1) / 2, (secs[0].z + secs[secs.length - 1].z) / 2];
    const mid = (s: Sec): V3 => [(s.xl + s.xr) / 2, (s.y0 + s.y1) / 2, s.z];
    const cc = (s: Sec): V3 => (center ? c : mid(s));
    for (let i = 0; i < secs.length - 1; i++) {
      const a = secs[i];
      const b = secs[i + 1];
      const ctr = center ? c : ([(mid(a)[0] + mid(b)[0]) / 2, (mid(a)[1] + mid(b)[1]) / 2, (a.z + b.z) / 2] as V3);
      this.face([[a.xl, a.y1, a.z], [a.xr, a.y1, a.z], [b.xr, b.y1, b.z], [b.xl, b.y1, b.z]], ctr, tones, part, { uv: [[a.xl, a.z], [a.xr, a.z], [b.xr, b.z], [b.xl, b.z]], tex: tex.top });
      this.face([[a.xl, a.y0, a.z], [a.xr, a.y0, a.z], [b.xr, b.y0, b.z], [b.xl, b.y0, b.z]], ctr, tones, part);
      this.face([[a.xl, a.y0, a.z], [a.xl, a.y1, a.z], [b.xl, b.y1, b.z], [b.xl, b.y0, b.z]], ctr, tones, part, { uv: [[a.z, a.y0], [a.z, a.y1], [b.z, b.y1], [b.z, b.y0]], tex: tex.side });
      this.face([[a.xr, a.y0, a.z], [a.xr, a.y1, a.z], [b.xr, b.y1, b.z], [b.xr, b.y0, b.z]], ctr, tones, part, { uv: [[a.z, a.y0], [a.z, a.y1], [b.z, b.y1], [b.z, b.y0]], tex: tex.side });
    }
    const f = secs[0];
    const l = secs[secs.length - 1];
    this.face([[f.xl, f.y0, f.z], [f.xr, f.y0, f.z], [f.xr, f.y1, f.z], [f.xl, f.y1, f.z]], cc(f), tones, part, { uv: [[f.xl, f.y0], [f.xr, f.y0], [f.xr, f.y1], [f.xl, f.y1]], tex: tex.rear });
    this.face([[l.xl, l.y0, l.z], [l.xr, l.y0, l.z], [l.xr, l.y1, l.z], [l.xl, l.y1, l.z]], cc(l), tones, part);
  }

  /** Prisma extrudado em x a partir de um polígono convexo (z, y). Bom para endplates e barbatana. */
  extrudeX(poly: [number, number][], x0: number, x1: number, tones: Tones, part: number, tex?: TexFn): void {
    const c: V3 = [(x0 + x1) / 2, poly.reduce((s, q) => s + q[1], 0) / poly.length, poly.reduce((s, q) => s + q[0], 0) / poly.length];
    for (const x of [x0, x1]) {
      this.face(poly.map(([z, y]) => [x, y, z] as V3), c, tones, part, { uv: poly.map(([z, y]) => [z, y] as [number, number]), tex });
    }
    for (let i = 0; i < poly.length; i++) {
      const [za, ya] = poly[i];
      const [zb, yb] = poly[(i + 1) % poly.length];
      this.face([[x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb]], c, tones, part);
    }
  }

  /** Cilindro com eixo em x (pneu): faixa de rodagem com normais suaves e duas tampas texturizadas. */
  wheel(w: { cx: number; cy: number; cz: number; r: number; w: number; n?: number }, tread: Tones, wall: Tones, part: number, capTex: TexFn, treadTex?: TexFn): void {
    const n = w.n ?? 14;
    const xa = w.cx - w.w / 2;
    const xb = w.cx + w.w / 2;
    const ring = (x: number, i: number): V3 => [x, w.cy + w.r * Math.cos((i / n) * Math.PI * 2), w.cz + w.r * Math.sin((i / n) * Math.PI * 2)];
    const dir = (i: number): V3 => [0, Math.cos((i / n) * Math.PI * 2), Math.sin((i / n) * Math.PI * 2)];
    for (let i = 0; i < n; i++) {
      const j = i + 1;
      this.prims.push({
        pts: [ring(xa, i), ring(xb, i), ring(xb, j), ring(xa, j)],
        nrm: [dir(i), dir(i), dir(j), dir(j)],
        uv: [[0, i], [1, i], [1, j], [0, j]],
        tones: tread,
        part,
        tex: treadTex,
      });
    }
    for (const [x, nx] of [[xa, -1], [xb, 1]] as const) {
      const pts: V3[] = [];
      const uv: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const p = ring(x, i);
        pts.push(p);
        uv.push([(p[2] - w.cz) / w.r, (p[1] - w.cy) / w.r]);
      }
      this.prims.push({ pts, nrm: pts.map(() => [nx, 0, 0] as V3), uv, tones: wall, part, tex: capTex });
    }
  }

  /** Elipsoide (capacete). */
  ellipsoid(c: V3, r: V3, tones: Tones, part: number, tex?: TexFn, nu = 10, nv = 7): void {
    const pt = (i: number, j: number): { p: V3; n: V3 } => {
      const lon = (i / nu) * Math.PI * 2;
      const lat = (j / nv) * Math.PI - Math.PI / 2;
      const n: V3 = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
      return { p: [c[0] + r[0] * n[0], c[1] + r[1] * n[1], c[2] + r[2] * n[2]], n };
    };
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = pt(i, j);
        const b = pt(i + 1, j);
        const d = pt(i + 1, j + 1);
        const e = pt(i, j + 1);
        this.prims.push({
          pts: [a.p, b.p, d.p, e.p],
          nrm: [a.n, b.n, d.n, e.n],
          uv: [[i / nu, j / nv], [(i + 1) / nu, j / nv], [(i + 1) / nu, (j + 1) / nv], [i / nu, (j + 1) / nv]],
          tones,
          part,
          tex,
        });
      }
    }
  }

  tube(a: V3, b: V3, color: string, part: number): void {
    this.tubes.push({ a, b, color, part });
  }
}

export interface Sec {
  z: number;
  xl: number;
  xr: number;
  y0: number;
  y1: number;
}

// --------------------------------------------------------------------------
// Rasterização
// --------------------------------------------------------------------------

export interface Frame {
  w: number;
  h: number;
  color: (string | null)[];
  part: Int16Array;
  iz: Float32Array;
  tone: Int8Array;
  /** Projeção de um ponto do modelo para a tela (px). */
  project: (p: V3) => { x: number; y: number };
}

const LIGHT = norm([-0.5, 0.78, -0.42]);

export function render(scene: Scene, W: number, H: number, cam: CamCfg): Frame {
  const cy0 = Math.cos(cam.yaw);
  const sy0 = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const camPos: V3 = [0, 0.5 + cam.dist * Math.tan(cam.pitch), -1.6 - cam.dist];
  const rot = (p: V3): V3 => {
    const x = p[0];
    const z = p[2] - cam.pivotZ;
    return [x * cy0 + z * sy0, p[1], -x * sy0 + z * cy0 + cam.pivotZ];
  };
  const toCam = (p: V3): V3 => {
    const q = sub(rot(p), camPos);
    return [q[0], q[1] * cp + q[2] * sp, -q[1] * sp + q[2] * cp];
  };
  const nCam = (n: V3): V3 => {
    const x = n[0] * cy0 + n[2] * sy0;
    const z = -n[0] * sy0 + n[2] * cy0;
    return [x, n[1] * cp + z * sp, -n[1] * sp + z * cp];
  };
  const gr = toCam(cam.groundRef);
  const offY = cam.groundY - (-cam.focal * gr[1]) / gr[2];
  const proj = (c: V3): { x: number; y: number; iz: number } => ({ x: cam.cx + (cam.focal * c[0]) / c[2], y: offY - (cam.focal * c[1]) / c[2], iz: 1 / c[2] });

  const color: (string | null)[] = new Array(W * H).fill(null);
  const part = new Int16Array(W * H);
  const iz = new Float32Array(W * H);
  const tone = new Int8Array(W * H).fill(-1);

  for (const pr of scene.prims) {
    const cs = pr.pts.map(toCam);
    const sv = cs.map(proj);
    const ns = pr.nrm.map((n) => norm(nCam(n)));
    for (let k = 1; k < pr.pts.length - 1; k++) {
      const idx = [0, k, k + 1];
      const a = sv[idx[0]];
      const b = sv[idx[1]];
      const c = sv[idx[2]];
      const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (Math.abs(area) < 1e-6) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
      const x1 = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
      const y1 = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) / area;
          const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) / area;
          const w2 = 1 - w0 - w1;
          const e = -1e-6;
          if (w0 < e || w1 < e || w2 < e) continue;
          const z = w0 * a.iz + w1 * b.iz + w2 * c.iz;
          const zb = z * (pr.bias ?? 1);
          const o = y * W + x;
          if (zb <= iz[o]) continue;
          const q0 = w0 * a.iz;
          const q1 = w1 * b.iz;
          const q2 = w2 * c.iz;
          const qs = q0 + q1 + q2;
          const f0 = q0 / qs;
          const f1 = q1 / qs;
          const f2 = q2 / qs;
          let t: number;
          if (pr.unlit !== undefined) t = pr.unlit;
          else {
            const n0 = ns[idx[0]];
            const n1 = ns[idx[1]];
            const n2 = ns[idx[2]];
            const nn = norm([f0 * n0[0] + f1 * n1[0] + f2 * n2[0], f0 * n0[1] + f1 * n1[1] + f2 * n2[1], f0 * n0[2] + f1 * n1[2] + f2 * n2[2]]);
            const l = dot(nn, LIGHT) + (pr.nrm[0] !== pr.nrm[1] ? (bayer(x, y) - 0.5) * 0.12 : 0);
            t = l > 0.6 ? 0 : l > 0.28 ? 1 : l > -0.02 ? 2 : 3;
          }
          let col: string = pr.tones[t];
          if (pr.tex && pr.uv) {
            const u = f0 * pr.uv[idx[0]][0] + f1 * pr.uv[idx[1]][0] + f2 * pr.uv[idx[2]][0];
            const v = f0 * pr.uv[idx[0]][1] + f1 * pr.uv[idx[1]][1] + f2 * pr.uv[idx[2]][1];
            const r = pr.tex(u, v);
            if (r === null) {
              /* sombreamento padrão */
            } else if (typeof r === 'number') {
              t = Math.max(0, Math.min(3, Math.round(r + (t - 1))));
              col = pr.tones[t];
            } else col = r;
          }
          color[o] = col;
          part[o] = pr.part;
          iz[o] = zb;
          tone[o] = t;
        }
      }
    }
  }

  // Tubos finos (braços de suspensão, hastes).
  for (const tb of scene.tubes) {
    const a = proj(toCam(tb.a));
    const b = proj(toCam(tb.b));
    const steps = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))) * 2 + 1;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.floor(a.x + (b.x - a.x) * t);
      const y = Math.floor(a.y + (b.y - a.y) * t);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const o = y * W + x;
      const z = (a.iz + (b.iz - a.iz) * t) * 1.02;
      if (z <= iz[o]) continue;
      color[o] = tb.color;
      part[o] = tb.part;
      iz[o] = z;
      tone[o] = 1;
    }
  }

  return {
    w: W,
    h: H,
    color,
    part,
    iz,
    tone,
    project: (p) => {
      const q = proj(toCam(p));
      return { x: q.x, y: q.y };
    },
  };
}

/** Luz de recorte, linhas de separação entre peças e contorno externo. Escreve no Painter. */
export function finish(f: Frame, p: Painter, outline: string, soft: Set<string> = new Set()): void {
  const { w, h, color, part, iz, tone } = f;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x);
  const opaque = (o: number): boolean => o >= 0 && color[o] !== null;
  const out: (string | null)[] = color.slice();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * w + x;
      const c = color[o];
      if (c === null) continue;
      const farther = (n: number): boolean => !opaque(n) || (part[n] !== part[o] && iz[n] < iz[o] * 0.985);
      let col = c;
      // Luz de recorte: borda superior e esquerda de superfícies iluminadas.
      if (tone[o] <= 2) {
        if (farther(at(x, y - 1))) col = lerpHex(c, '#ffffff', tone[o] === 0 ? 0.62 : 0.42);
        else if (farther(at(x - 1, y))) col = lerpHex(c, '#ffffff', 0.25);
      }
      // Linha de separação escura no lado mais distante entre peças diferentes.
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
        const n = at(x + dx, y + dy);
        if (n >= 0 && opaque(n) && part[n] !== part[o] && iz[n] > iz[o] * 1.015 && !soft.has(`${part[o]}:${part[n]}`)) {
          col = lerpHex(col, outline, 0.6);
          break;
        }
      }
      out[o] = col;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * w + x;
      if (out[o] !== null) {
        p.px(x, y, out[o] as string);
        continue;
      }
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
        if (opaque(at(x + dx, y + dy))) {
          p.px(x, y, outline);
          break;
        }
      }
    }
  }
}
