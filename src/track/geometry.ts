/* ==========================================================================
   Geometria real de Interlagos -> TrackGeometry -> segmentos de 5 m.
   Convenção: x = leste, y = norte (metros). Curva à ESQUERDA tem variação de
   heading POSITIVA (anti-horário). No jogo, Segment.curve < 0 = esquerda.
   ========================================================================== */

import { SEGMENT_METERS, UNITS_PER_METER, type Segment, type TrackGeometry } from '../contracts';

type Pt = { x: number; y: number; z: number };

/** Nomes oficiais das 15 curvas, na ordem de corrida, e o lado esperado (E/D). */
const TURN_NAMES = [
  'S do Senna', 'S do Senna', 'Curva do Sol', 'Descida do Lago', 'Descida do Lago',
  'Ferradura', 'Ferradura', 'Laranjinha', 'Pinheirinho', 'Bico de Pato',
  'Mergulho', 'Junção', 'Café', 'Subida dos Boxes', 'Arquibancadas',
];
export const EXPECTED_SIDES = 'EDEEEDDDEDEEEEE';

/** Retas nomeadas, indexadas pela curva que vem ANTES delas. */
const STRAIGHT_AFTER: Record<number, string> = {
  3: 'Reta Oposta', 5: 'Reta do Lago', 13: 'Subida dos Boxes', 14: 'Subida dos Boxes', 15: 'Reta dos Boxes',
};

/** Distância da linha de chegada ao ápice da curva 1. */
const START_BEFORE_APEX_M = 350;
/** Exagero vertical do relevo (drama sem distorcer). */
export const VERTICAL_EXAGGERATION = 1.7;
/** Curve = 180/R: grampo (R 25-30) fica em ~6-7, Curva do Sol (R 110) em ~1,6. */
export const CURVE_K = 180;
/** Raio abaixo do qual há zebra. */
const KERB_RADIUS = 250;

const norm = (d: number) => {
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Variação de heading (rad) no ponto i: positiva = esquerda. */
function headingDeltas(p: Pt[]): number[] {
  const n = p.length;
  const hd = p.map((a, i) => {
    const b = p[(i + 1) % n];
    return Math.atan2(b.y - a.y, b.x - a.x);
  });
  return hd.map((h, i) => norm(h - hd[mod(i - 1, n)]));
}

/** Curvatura (1/m, + = esquerda) média numa janela de ±w pontos. */
function smoothCurvature(dh: number[], spacing: number, w: number): number[] {
  const n = dh.length;
  return dh.map((_, i) => {
    let s = 0;
    for (let j = -w; j <= w; j++) s += dh[mod(i + j, n)];
    return s / (2 * w + 1) / spacing;
  });
}

interface RawCorner {
  side: 1 | -1; // +1 = esquerda
  entry: number;
  apex: number;
  exit: number;
  angleDeg: number;
  minRadius: number;
}

const DETECT_ENTER = 1 / 400;
const DETECT_GAP = 8;
const DETECT_MIN_DEG = 12;
const SPLIT_MIN_SEP = 8;
const SPLIT_DIP = 0.65;
const SPLIT_PEAK = 1 / 80;

/** Detecta as curvas (índices na polilinha original), sem numerar. */
function detectCorners(p: Pt[], spacing: number): RawCorner[] {
  const n = p.length;
  const dh = headingDeltas(p);
  const k = smoothCurvature(dh, spacing, 3);
  const w = 10;
  // início da varredura: ponto mais "reto" (menor soma de |dh| numa janela)
  let base = 0;
  let bestSum = Infinity;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = -w; j <= w; j++) s += Math.abs(dh[mod(i + j, n)]);
    if (s < bestSum) {
      bestSum = s;
      base = i;
    }
  }
  interface Run { sg: number; first: number; last: number }
  const runs: Run[] = [];
  let cur: Run | null = null;
  for (let m = 0; m < n; m++) {
    const i = mod(base + m, n);
    if (Math.abs(k[i]) <= DETECT_ENTER) continue;
    const sg = Math.sign(k[i]);
    if (cur && cur.sg === sg && m - cur.last <= DETECT_GAP) cur.last = m;
    else {
      if (cur) runs.push(cur);
      cur = { sg, first: m, last: m };
    }
  }
  if (cur) runs.push(cur);

  const out: RawCorner[] = [];
  for (const r of runs) {
    let ang = 0;
    for (let m = r.first; m <= r.last; m++) ang += dh[mod(base + m, n)];
    if (Math.abs(ang) * (180 / Math.PI) < DETECT_MIN_DEG) continue;
    // picos de curvatura (máximos locais) para dividir curvas duplas
    const peaks: number[] = [];
    for (let m = r.first; m <= r.last; m++) {
      const v = Math.abs(k[mod(base + m, n)]);
      let isMax = true;
      for (let j = -3; j <= 3 && isMax; j++) {
        const mm = m + j;
        if (mm < r.first || mm > r.last || j === 0) continue;
        if (Math.abs(k[mod(base + mm, n)]) > v || (Math.abs(k[mod(base + mm, n)]) === v && j < 0)) isMax = false;
      }
      if (isMax && v > SPLIT_PEAK) peaks.push(m);
    }
    // funde picos sem vale profundo entre eles
    const kept: number[] = [];
    for (const m of peaks) {
      const prev = kept[kept.length - 1];
      if (prev === undefined) {
        kept.push(m);
        continue;
      }
      let valley = Infinity;
      for (let q = prev; q <= m; q++) valley = Math.min(valley, Math.abs(k[mod(base + q, n)]));
      const lo = Math.min(Math.abs(k[mod(base + prev, n)]), Math.abs(k[mod(base + m, n)]));
      if (m - prev >= SPLIT_MIN_SEP && valley <= SPLIT_DIP * lo) kept.push(m);
      else if (Math.abs(k[mod(base + m, n)]) > Math.abs(k[mod(base + prev, n)])) kept[kept.length - 1] = m;
    }
    if (kept.length === 0) {
      let bm = r.first;
      for (let m = r.first; m <= r.last; m++) if (Math.abs(k[mod(base + m, n)]) > Math.abs(k[mod(base + bm, n)])) bm = m;
      kept.push(bm);
    }
    // limites de cada pico: ponto de menor curvatura entre picos vizinhos
    const bounds: number[] = [r.first];
    for (let q = 1; q < kept.length; q++) {
      let bm = kept[q - 1];
      for (let m = kept[q - 1]; m <= kept[q]; m++) if (Math.abs(k[mod(base + m, n)]) < Math.abs(k[mod(base + bm, n)])) bm = m;
      bounds.push(bm);
    }
    bounds.push(r.last);
    kept.forEach((apexM, q) => {
      let a = 0;
      for (let m = bounds[q]; m <= bounds[q + 1]; m++) a += dh[mod(base + m, n)];
      out.push({
        side: r.sg > 0 ? 1 : -1,
        entry: mod(base + bounds[q], n),
        apex: mod(base + apexM, n),
        exit: mod(base + bounds[q + 1], n),
        angleDeg: Math.abs(a) * (180 / Math.PI),
        minRadius: 1 / Math.abs(k[mod(base + apexM, n)]),
      });
    });
  }
  return out;
}

function polylineLength(p: Pt[]): number {
  let L = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    L += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return L;
}

/** Escolhe a curva 1: primeiro "S" esquerda->direita depois da maior reta. */
function findSenna(corners: RawCorner[], n: number): number {
  const sorted = corners.map((c, i) => ({ c, i })).sort((a, b) => a.c.apex - b.c.apex);
  let best = -1;
  let bestGap = -1;
  sorted.forEach((cur, q) => {
    const next = sorted[(q + 1) % sorted.length];
    const prev = sorted[mod(q - 1, sorted.length)];
    if (cur.c.side !== 1 || next.c.side !== -1) return;
    const gap = mod(cur.c.entry - prev.c.exit, n);
    if (gap > bestGap) {
      bestGap = gap;
      best = cur.i;
    }
  });
  if (best < 0) throw new Error('S do Senna não encontrado na geometria');
  return best;
}

export interface GeoJson {
  points: Pt[];
  lengthMeters?: number;
}

/** Carrega o JSON OSM+SRTM, reposiciona a largada e detecta as 15 curvas. */
export function loadGeometry(json: unknown): TrackGeometry {
  const raw = (json as GeoJson).points;
  if (!Array.isArray(raw) || raw.length < 50) throw new Error('geometria inválida');
  const n = raw.length;
  const spacing = polylineLength(raw) / n;
  const corners = detectCorners(raw, spacing);
  const senna = corners[findSenna(corners, n)];
  const start = mod(senna.apex - Math.round(START_BEFORE_APEX_M / spacing), n);
  const points = Array.from({ length: n }, (_, i) => {
    const p = raw[mod(start + i, n)];
    return { x: p.x, y: p.y, z: p.z };
  });
  const lengthMeters = polylineLength(points);
  const ordered = corners
    .map((c) => ({ c, apex: mod(c.apex - start, n) }))
    .sort((a, b) => a.apex - b.apex);
  return {
    name: 'Interlagos',
    points,
    lengthMeters,
    corners: ordered.map((o, i) => ({
      turn: i + 1,
      name: TURN_NAMES[i] ?? `Curva ${i + 1}`,
      apexMeters: (o.apex * lengthMeters) / n,
    })),
  };
}

export interface CornerInfo {
  turn: number;
  name: string;
  /** 'E' = esquerda, 'D' = direita. */
  side: 'E' | 'D';
  entryIndex: number;
  apexIndex: number;
  exitIndex: number;
  entryMeters: number;
  apexMeters: number;
  exitMeters: number;
  /** Raio mínimo no ápice (m). */
  radius: number;
  angleDeg: number;
}

const cache = new WeakMap<TrackGeometry, CornerInfo[]>();

/** Detalhes das curvas (lado, raio, entrada/saída), na ordem de corrida. */
export function cornerDetails(geo: TrackGeometry): CornerInfo[] {
  const hit = cache.get(geo);
  if (hit) return hit;
  const n = geo.points.length;
  const spacing = geo.lengthMeters / n;
  const raw = detectCorners(geo.points, spacing).sort((a, b) => a.apex - b.apex);
  const info = raw.map((c, i): CornerInfo => ({
    turn: geo.corners[i]?.turn ?? i + 1,
    name: geo.corners[i]?.name ?? `Curva ${i + 1}`,
    side: c.side > 0 ? 'E' : 'D',
    entryIndex: c.entry,
    apexIndex: c.apex,
    exitIndex: c.exit,
    entryMeters: c.entry * spacing,
    apexMeters: c.apex * spacing,
    exitMeters: c.exit * spacing,
    radius: c.minRadius,
    angleDeg: c.angleDeg,
  }));
  cache.set(geo, info);
  return info;
}

/** Nome do trecho para o segmento i, dado o conjunto de curvas. */
function sectionNames(count: number, corners: CornerInfo[]): string[] {
  const names: string[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const inside = corners.find((c) => i >= c.entryIndex && i <= c.exitIndex);
    if (inside) {
      names[i] = inside.name;
      continue;
    }
    let prev = corners[corners.length - 1];
    let next = corners[0];
    for (let q = 0; q < corners.length; q++) {
      if (corners[q].exitIndex < i) prev = corners[q];
      if (corners[q].entryIndex > i) {
        next = corners[q];
        break;
      }
    }
    const dPrev = mod(i - prev.exitIndex, count);
    const dNext = mod(next.entryIndex - i, count);
    const gap = (dPrev + dNext) * SEGMENT_METERS;
    if (gap <= 80) names[i] = dPrev <= dNext ? prev.name : next.name;
    else names[i] = STRAIGHT_AFTER[prev.turn] ?? (dPrev <= dNext ? prev.name : next.name);
  }
  return names;
}

/** Expande a geometria em segmentos de SEGMENT_METERS (props ficam vazios). */
export function buildSegmentsFromGeometry(geo: TrackGeometry): { segments: Segment[]; length: number } {
  const pts = geo.points;
  const n = pts.length;
  const spacing = geo.lengthMeters / n;
  const dh = headingDeltas(pts);
  const kVis = smoothCurvature(dh, spacing, 1);
  const kRad = smoothCurvature(dh, spacing, 4);
  // altitude suavizada (SRTM tem degraus), relativa à largada
  const z0 = pts[0].z;
  const zs = pts.map((_, i) => {
    let s = 0;
    for (let j = -3; j <= 3; j++) s += pts[mod(i + j, n)].z;
    return ((s / 7 - z0) * VERTICAL_EXAGGERATION) * UNITS_PER_METER;
  });
  const names = sectionNames(n, cornerDetails(geo));
  const segments: Segment[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.abs(kRad[i]) > 1 / 3000 ? Math.max(15, 1 / Math.abs(kRad[i])) : Infinity;
    segments.push({
      index: i,
      curve: Math.max(-7.5, Math.min(7.5, -kVis[i] * CURVE_K)),
      y1: zs[i],
      y2: zs[(i + 1) % n],
      sectionName: names[i],
      props: [],
      kerb: r < KERB_RADIUS,
      meters: i * SEGMENT_METERS,
      radiusMeters: r,
    });
  }
  return { segments, length: n * SEGMENT_METERS * UNITS_PER_METER };
}
