/* ==========================================================================
   Autódromo José Carlos Pace (Interlagos): cenário em metros sobre a
   geometria real. A geometria vem de geometry.ts; aqui ficam as zonas de
   cenário, as placas de frenagem automáticas e a montagem final da pista.
   Lado: offset negativo = esquerda (no sentido anti-horário, o miolo do
   circuito), positivo = direita (lado de fora na maior parte do traçado).
   ========================================================================== */

import { ROAD_HALF_WIDTH_METERS, type PropKind, type PropPlacement, type SceneryZone, type Segment, type TrackGeometry } from '../contracts';
import { cornerLimit } from '../game/physics';
import geoJson from './data/interlagos-geo.json';
import { buildSegmentsFromGeometry, cornerDetails, loadGeometry, type CornerInfo } from './geometry';

const P = (kind: PropKind, offset: number): PropPlacement => ({ kind, offset });
type Rule = SceneryZone['props'][number];
const rule = (everyMeters: number, ...place: PropPlacement[]): Rule => ({ everyMeters, place });

/** Velocidade (km/h) abaixo da qual a curva ganha placas de frenagem. */
export const BRAKE_BOARD_KMH = 200;
/** Curvas lentas ganham brita na saída; rápidas ganham alambrado. */
const SLOW_KMH = 150;

/** Largura real (m) de cada sprite (a mesma de ArtBundle.props[k].widthMeters). */
export const PROP_WIDTH_M: Record<PropKind, number> = {
  grandstand: 40, floodlight: 2, tree: 8, ipe: 7, billboard: 12, marshal: 3, tyrewall: 6, pitbuilding: 60, lake: 40,
  skyline: 80, bush: 2.5, fence: 10, flag: 2.5, tvtower: 4, brake300: 1.6, brake200: 1.6, brake100: 1.6, gravel: 20,
  crowd: 15, building: 15, pond: 30,
};

/**
 * Nas zonas, `offset` é a distância da BORDA do objeto mais próxima do eixo da pista (em meias larguras);
 * o motor desenha o centro, então soma meia largura do sprite.
 */
export const centerOffset = (kind: PropKind, edge: number): number => edge + Math.sign(edge) * (PROP_WIDTH_M[kind] / 2 / ROAD_HALF_WIDTH_METERS);

const limitKmh = (c: CornerInfo) => cornerLimit(c.radius) * 3.6;

/** Lado de fora da curva: +1 direita, -1 esquerda. */
const outsideOf = (c: CornerInfo) => (c.side === 'E' ? 1 : -1);

/** Zonas fixas de cenário + zonas automáticas por curva (brita, alambrado). */
export function buildSceneryZones(geo: TrackGeometry): SceneryZone[] {
  const cs = cornerDetails(geo);
  const L = geo.lengthMeters;
  const c = (n: number) => cs[n - 1];
  const zones: SceneryZone[] = [];
  const add = (from: number, to: number, ...props: Rule[]) => zones.push({ fromMeters: from, toMeters: to, props });

  // base: mata, arbustos e alambrado ao longo de toda a volta (menos nas áreas urbanizadas)
  add(c(1).entryMeters, c(15).exitMeters,
    rule(14, P('tree', -2.2), P('tree', 2.5)),
    rule(9, P('bush', -1.55), P('bush', 1.6)),
    rule(120, P('ipe', -1.9), P('ipe', 2.1)),
    rule(90, P('billboard', 1.7)),
    rule(160, P('floodlight', -1.55)),
  );

  // Reta dos Boxes: boxes à esquerda, arquibancadas à direita (duas zonas por causa da linha de chegada)
  const pits = [
    rule(60, P('pitbuilding', -2.3)),
    rule(48, P('grandstand', 2.7)),
    rule(70, P('floodlight', 1.5)),
    rule(16, P('crowd', 1.42)),
    rule(110, P('flag', -1.8)),
    rule(240, P('tvtower', 1.95)),
    rule(100, P('marshal', 1.6)),
    rule(10, P('fence', -1.3), P('fence', 1.3)),
  ];
  add(c(15).exitMeters, L, ...pits);
  add(0, c(1).entryMeters - 20, ...pits);

  // Arquibancadas (curva 15) e Subida dos Boxes
  add(c(14).exitMeters, c(15).exitMeters,
    rule(40, P('grandstand', 2.7), P('grandstand', -2.7)),
    rule(14, P('crowd', 1.42), P('crowd', -1.42)),
    rule(70, P('flag', 2.0)),
  );
  add(c(13).exitMeters, c(14).exitMeters,
    rule(18, P('crowd', -2.4)),
    rule(80, P('floodlight', 1.5)),
  );

  // S do Senna: arquibancadas dos dois lados
  add(c(1).entryMeters - 40, c(2).exitMeters + 30,
    rule(40, P('grandstand', 2.8), P('grandstand', -2.8)),
    rule(13, P('crowd', 1.42), P('crowd', -1.42)),
    rule(15, P('tyrewall', 1.38), P('tyrewall', -1.38)),
    rule(60, P('marshal', 1.6)),
  );

  // Curva do Sol: mata fechada e ipês
  add(c(3).entryMeters, c(3).exitMeters,
    rule(9, P('tree', -2.3), P('tree', 2.6)),
    rule(40, P('ipe', 2.0)),
  );

  // Reta Oposta: casas e skyline do lado de fora (direita), mata e morros com público no miolo
  add(c(3).exitMeters, c(4).entryMeters,
    rule(32, P('building', 3.6)),
    rule(47, P('building', 4.6)),
    rule(85, P('skyline', 6.2)),
    rule(20, P('crowd', -2.3)),
    rule(26, P('tree', -3.0), P('tree', 2.4)),
    rule(75, P('billboard', 1.7), P('billboard', -1.7)),
    rule(55, P('tvtower', 2.0)),
  );

  // Descida do Lago: represa à esquerda
  add(c(4).entryMeters - 40, c(5).exitMeters + 40,
    rule(28, P('lake', -3.0)),
    rule(17, P('pond', -2.1)),
    rule(12, P('tree', 2.5)),
    rule(16, P('tyrewall', 1.38)),
  );

  // Reta do Lago até a Ferradura: mata
  add(c(5).exitMeters, c(6).entryMeters,
    rule(8, P('tree', -2.2), P('tree', 2.4)),
    rule(35, P('ipe', 2.2)),
    rule(30, P('pond', -2.4)),
  );

  // Ferradura, Laranjinha, Pinheirinho: pneus e fiscais
  add(c(6).entryMeters, c(9).exitMeters,
    rule(15, P('tyrewall', 1.38), P('tyrewall', -1.38)),
    rule(70, P('marshal', 1.6), P('marshal', -1.6)),
    rule(22, P('crowd', -2.4)),
  );

  // Bico de Pato: arquibancada do lado de fora (esquerda)
  add(c(10).entryMeters - 30, c(10).exitMeters + 40,
    rule(40, P('grandstand', -2.7)),
    rule(13, P('crowd', -1.42)),
    rule(14, P('tyrewall', 1.38)),
  );

  // Mergulho (descida) e Café
  add(c(11).entryMeters, c(11).exitMeters + 60,
    rule(9, P('tree', -2.3), P('tree', 2.6)),
    rule(25, P('crowd', 1.5)),
  );

  // Junção: arquibancadas
  add(c(12).entryMeters - 40, c(12).exitMeters + 40,
    rule(40, P('grandstand', 2.8), P('grandstand', -2.8)),
    rule(13, P('crowd', 1.42), P('crowd', -1.42)),
    rule(15, P('tyrewall', 1.38), P('tyrewall', -1.38)),
  );

  // automáticas por curva: brita na saída das lentas, alambrado nas rápidas
  for (const k of cs) {
    const out = outsideOf(k);
    if (limitKmh(k) < SLOW_KMH) {
      add(k.apexMeters, k.exitMeters + 50, rule(20, P('gravel', out * 1.15)), rule(26, P('tyrewall', out * 1.9)));
    } else {
      add(k.entryMeters - 20, k.exitMeters + 20, rule(8, P('fence', out * 1.22)));
    }
  }
  return zones;
}

/** Hash determinístico em [0,1). */
function rnd(a: number, b: number, c: number): number {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0xc2b2ae35, 0x27d4eb2f) ^ Math.imul(c + 0x165667b1, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 100000) / 100000;
}

/** Tipos que ganham pequena variação lateral para a mata não parecer em fila. */
const JITTER = new Set<PropKind>(['tree', 'bush', 'ipe', 'crowd', 'building', 'pond']);

/** Espalha os props das zonas nos segmentos (mutação). */
export function applyScenery(segments: Segment[], zones: SceneryZone[], lengthMeters: number): void {
  const n = segments.length;
  const segM = lengthMeters / n;
  zones.forEach((z, zi) => {
    z.props.forEach((r, ri) => {
      r.place.forEach((pl, pi) => {
        const phase = (pi * r.everyMeters) / r.place.length;
        const first = Math.ceil((z.fromMeters - phase) / r.everyMeters);
        for (let k = first; ; k++) {
          const m = k * r.everyMeters + phase;
          if (m >= z.toMeters) break;
          const idx = Math.floor((((m % lengthMeters) + lengthMeters) % lengthMeters) / segM) % n;
          const jit = JITTER.has(pl.kind) ? (rnd(zi * 31 + ri, pi, k) - 0.5) * 0.5 : 0;
          // alguns pontos da mata ficam vazios
          if (JITTER.has(pl.kind) && rnd(zi, ri * 7 + pi, k) < 0.12) continue;
          segments[idx].props.push({ kind: pl.kind, offset: centerOffset(pl.kind, pl.offset + jit) });
        }
      });
    });
  });
}

const BOARDS: [number, PropKind][] = [[300, 'brake300'], [200, 'brake200'], [100, 'brake100']];

/**
 * Placas 300/200/100 m antes da entrada de cada curva com limite < 200 km/h,
 * no lado de fora; só onde ainda há reta (não dentro da curva anterior).
 */
export function placeBrakeBoards(segments: Segment[], geo: TrackGeometry): number {
  const cs = cornerDetails(geo);
  const n = segments.length;
  const L = geo.lengthMeters;
  let count = 0;
  cs.forEach((k, i) => {
    if (limitKmh(k) >= BRAKE_BOARD_KMH) return;
    const prev = cs[(i + cs.length - 1) % cs.length];
    const prevExit = i === 0 ? prev.exitMeters - L : prev.exitMeters;
    for (const [d, kind] of BOARDS) {
      const m = k.entryMeters - d;
      if (m < prevExit + 10) continue;
      const idx = Math.floor((((m % L) + L) % L) / (L / n)) % n;
      segments[idx].props.push({ kind, offset: centerOffset(kind, outsideOf(k) * 1.5) });
      count++;
    }
  });
  return count;
}

export interface Interlagos {
  geo: TrackGeometry;
  segments: Segment[];
  /** Comprimento em unidades de mundo. */
  length: number;
  zones: SceneryZone[];
}

/** Monta a pista completa: geometria, segmentos, cenário e placas. */
export function buildInterlagos(): Interlagos {
  const geo = loadGeometry(geoJson);
  const { segments, length } = buildSegmentsFromGeometry(geo);
  const zones = buildSceneryZones(geo);
  applyScenery(segments, zones, geo.lengthMeters);
  placeBrakeBoards(segments, geo);
  return { geo, segments, length, zones };
}
