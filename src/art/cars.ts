import type { CarSprites, SpriteArt } from '../contracts';
import { makeCanvas, type Painter } from './canvas';
import { finish, render, Scene, type CamCfg, type Frame, type Tones, type V3 } from './render3d';
import { lerpHex } from './util';

/** v3: canvas 72x40, desenhado 1:1 (2,0 m de largura). */
export const CAR_W = 72;
export const CAR_H = 40;
const OUT = '#1a1038';

/** Escala de 4 tons de uma cor: luz, base, sombra, sombra profunda. */
function scale(base: string): Tones {
  return [lerpHex(base, '#ffffff', 0.45), base, lerpHex(base, '#2a0a60', 0.38), lerpHex(base, '#1a1038', 0.66)];
}

export interface Livery {
  name: string;
  number: number;
  body: Tones;
  accent: Tones;
  helmet: [string, string];
  /** Cor da faixa de composto no pneu. */
  band: string;
  numberColor: string;
}

function liv(name: string, number: number, body: string, accent: string, helmet: [string, string], band: string): Livery {
  const lum = (c: string): number => {
    const n = parseInt(c.slice(1), 16);
    return (0.3 * ((n >> 16) & 255) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
  };
  return { name, number, body: scale(body), accent: scale(accent), helmet, band, numberColor: lum(body) > 0.62 ? '#1a1038' : '#ffffff' };
}

/** 10 pinturas fictícias: jogador (carmim e ciano) + 9 rivais, todas de cores vivas e distintas. */
export const LIVERIES: Livery[] = [
  liv('Carmim', 7, '#ff2a4a', '#2fd6ff', ['#2fd6ff', '#ffffff'], '#ffd23a'),
  liv('Cobalto', 3, '#2a52ff', '#ffd23a', ['#ffd23a', '#ffffff'], '#ff2a3a'),
  liv('Limão', 9, '#8fe82a', '#1a1450', ['#1a1450', '#ffffff'], '#ffffff'),
  liv('Tangerina', 12, '#ff8a1a', '#1f6aff', ['#1f6aff', '#ffffff'], '#ffd23a'),
  liv('Prata', 18, '#dfe6ff', '#1fd0b8', ['#1fd0b8', '#1a1038'], '#ff2a3a'),
  liv('Violeta', 21, '#9a3ae0', '#ff5aa8', ['#ff5aa8', '#ffffff'], '#ffd23a'),
  liv('Solar', 27, '#ffd814', '#14307a', ['#14307a', '#ffffff'], '#ffffff'),
  liv('Esmeralda', 36, '#12b86a', '#ffffff', ['#ffffff', '#12b86a'], '#ff2a3a'),
  liv('Turquesa', 48, '#14c8d8', '#ff5a1a', ['#ff5a1a', '#ffffff'], '#ffd23a'),
  liv('Bordô', 77, '#c01850', '#ffc83a', ['#ffc83a', '#1a1038'], '#ffffff'),
];

export const PLAYER_LIVERY = LIVERIES[0];
export const RIVAL_LIVERIES = LIVERIES.slice(1);

// --------------------------------------------------------------------------
// Materiais
// --------------------------------------------------------------------------

const CARBON: Tones = ['#6a6ab0', '#3c3c78', '#272558', '#15112e'];
const CARBON_DARK: Tones = ['#4a4a88', '#2a2a5a', '#1c1a44', '#0c0820'];
const RUBBER: Tones = ['#5a5696', '#2e2a58', '#1c1840', '#0e0a24'];
const SIDEWALL: Tones = ['#46427a', '#26224a', '#18143a', '#0c0820'];

// Ids de peça (linhas escuras de separação aparecem entre ids diferentes).
const P = {
  tyreL: 1, tyreR: 2, ftyreL: 3, ftyreR: 4, wing: 5, flap: 6, epL: 7, epR: 8, pillar: 9, gearbox: 10, diffuser: 11,
  spine: 12, airbox: 13, fin: 14, podL: 15, podR: 16, floor: 17, cockpit: 18, helmet: 19, halo: 20, nose: 21, fwing: 22,
  fepL: 23, fepR: 24, arms: 25, rain: 26,
} as const;

// --------------------------------------------------------------------------
// Modelo (metros; x = direita, y = cima, z = para frente; atrás do carro é z negativo)
// --------------------------------------------------------------------------

const RT = { cx: 0.8, w: 0.52, r: 0.37, z: -1.05 };
const FT = { cx: 0.8, w: 0.38, r: 0.32, z: 1.85 };
const WING_Z0 = -1.64;
const WING_Z1 = -1.4;

function buildModel(L: Livery): { scene: Scene; wingFace: V3; rainFace: V3 } {
  const s = new Scene();
  const { body, accent } = L;

  // Pneus traseiros: enormes, expostos, com faixa colorida e brilho.
  const capTex = (outer: boolean) => (u: number, v: number): string | number | null => {
    const t = Math.hypot(u, v);
    if (t > 0.94) return 3;
    if (t > 0.66 && t < 0.82) return outer ? L.band : lerpHex(L.band, '#1a1038', 0.2);
    if (t < 0.34) return t < 0.14 ? '#d8dcff' : '#8c98dc';
    if (t < 0.46) return 2;
    return null;
  };
  const treadTex = (u: number, v: number): string | number | null => {
    // Sulcos longitudinais na banda de rodagem.
    if (Math.abs(u - 0.33) < 0.035 || Math.abs(u - 0.67) < 0.035) return 3;
    void v;
    return null;
  };
  for (const sd of [-1, 1] as const) {
    s.wheel({ cx: sd * RT.cx, cy: RT.r, cz: RT.z, r: RT.r, w: RT.w, n: 16 }, RUBBER, SIDEWALL, sd < 0 ? P.tyreL : P.tyreR, capTex(true), treadTex);
    s.wheel({ cx: sd * FT.cx, cy: FT.r, cz: FT.z, r: FT.r, w: FT.w, n: 14 }, RUBBER, SIDEWALL, sd < 0 ? P.ftyreL : P.ftyreR, capTex(true), treadTex);
  }

  // Piso e difusor (escuros), entre os pneus.
  s.box({ x0: -0.68, x1: 0.68, y0: 0.03, y1: 0.09, z0: -0.7, z1: 1.9 }, CARBON_DARK, P.floor);
  const fins = (u: number, v: number): string | number | null => {
    const k = Math.floor((u + 0.5) / 0.115);
    if (v > 0.26) return null;
    return (k & 1) === 0 ? '#5a5ca8' : '#0a0620';
  };
  s.loft(
    [
      { z: -1.58, xl: -0.46, xr: 0.46, y0: 0.05, y1: 0.3 },
      { z: -0.7, xl: -0.46, xr: 0.46, y0: 0.05, y1: 0.12 },
    ],
    CARBON_DARK,
    P.diffuser,
    null,
    { rear: fins },
  );
  // Linha de acento no piso.
  s.box({ x0: 0.5, x1: 0.68, y0: 0.09, y1: 0.1, z0: -0.2, z1: 1.9 }, accent, P.floor);
  s.box({ x0: -0.68, x1: -0.5, y0: 0.09, y1: 0.1, z0: -0.2, z1: 1.9 }, accent, P.floor);

  // Caixa de câmbio / estrutura traseira e luz de chuva.
  s.box({ x0: -0.14, x1: 0.14, y0: 0.2, y1: 0.58, z0: -1.52, z1: -0.9 }, CARBON, P.gearbox);
  // Rain light (retângulo central logo abaixo da asa).
  s.box({ x0: -0.1, x1: 0.1, y0: 0.27, y1: 0.38, z0: -1.55, z1: -1.52 }, ['#ffe0e0', '#ff4a56', '#ff2a3a', '#a0102a'], P.rain, { rear: () => '#ff2a3a' });

  // Coke bottle: espinha afunilada.
  s.loft(
    [
      { z: -1.0, xl: -0.15, xr: 0.15, y0: 0.14, y1: 0.55 },
      { z: -0.45, xl: -0.22, xr: 0.22, y0: 0.1, y1: 0.64 },
      { z: 0.15, xl: -0.3, xr: 0.3, y0: 0.1, y1: 0.74 },
    ],
    body,
    P.spine,
    null,
  );
  // Cockpit: rebaixado, com bordas na cor de acento e interior escuro.
  s.box({ x0: -0.28, x1: 0.28, y0: 0.1, y1: 0.46, z0: 0.15, z1: 0.9 }, CARBON_DARK, P.cockpit);
  s.box({ x0: -0.3, x1: -0.2, y0: 0.1, y1: 0.62, z0: 0.15, z1: 0.9 }, accent, P.cockpit);
  s.box({ x0: 0.2, x1: 0.3, y0: 0.1, y1: 0.62, z0: 0.15, z1: 0.9 }, accent, P.cockpit);
  // Nariz até a asa dianteira.
  s.loft(
    [
      { z: 0.9, xl: -0.27, xr: 0.27, y0: 0.1, y1: 0.55 },
      { z: 1.7, xl: -0.2, xr: 0.2, y0: 0.1, y1: 0.4 },
      { z: 2.5, xl: -0.07, xr: 0.07, y0: 0.08, y1: 0.24 },
    ],
    body,
    P.nose,
    null,
  );

  // Airbox acima da cabeça do piloto, com barbatana.
  s.loft(
    [
      { z: -0.5, xl: -0.1, xr: 0.1, y0: 0.6, y1: 0.68 },
      { z: 0.15, xl: -0.18, xr: 0.18, y0: 0.6, y1: 0.9 },
    ],
    body,
    P.airbox,
    null,
  );
  s.extrudeX([[-1.5, 0.48], [-1.5, 0.54], [0.1, 0.88], [0.1, 0.6]], -0.03, 0.03, accent, P.fin);

  // Sidepods escavados (cunha que afina rumo ao coke bottle).
  for (const sd of [-1, 1] as const) {
    const sec = (z: number, xi: number, xo: number, y1: number): { z: number; xl: number; xr: number; y0: number; y1: number } =>
      sd > 0 ? { z, xl: xi, xr: xo, y0: 0.1, y1 } : { z, xl: -xo, xr: -xi, y0: 0.1, y1 };
    const undercut = (u: number, v: number): string | number | null => {
      // u = |x| aprox, v = z: escavação escura junto à espinha na parte de trás.
      void v;
      return Math.abs(u) < 0.0 ? 3 : null;
    };
    s.loft(
      [sec(-0.95, 0.15, 0.22, 0.3), sec(-0.35, 0.2, 0.37, 0.45), sec(0.25, 0.26, 0.54, 0.6), sec(0.95, 0.27, 0.5, 0.52)],
      body,
      sd < 0 ? P.podL : P.podR,
      null,
      { top: undercut, side: (z, y) => (y > 0.18 && y < 0.3 && z > -0.2 && z < 0.7 ? accent[1] : null) },
    );
    // Entrada de ar escura na frente do sidepod e bargeboard.
    s.box({ x0: sd * 0.3, x1: sd * 0.5, y0: 0.14, y1: 0.46, z0: 0.95, z1: 1.0 }, CARBON_DARK, sd < 0 ? P.podL : P.podR);
  }

  // Piloto: capacete colorido + halo em Y.
  const hz = 0.58;
  s.ellipsoid([0, 0.72, hz], [0.135, 0.145, 0.15], scale(L.helmet[0]), P.helmet, (u, v) => {
    // Faixa na cor secundária sobre o topo, de trás para frente.
    if (Math.abs(u - 0.5) < 0.06 && v > 0.3) return L.helmet[1];
    if (u > 0.2 && u < 0.8 && v < 0.35) return null;
    return null;
  }, 12, 8);
  s.box({ x0: -0.17, x1: 0.17, y0: 0.5, y1: 0.7, z0: 0.18, z1: 0.36 }, CARBON, P.cockpit);
  const hal: Tones = ['#ffffff', '#e0e6ff', '#9aa4e8', '#6a72b8'];
  void hal;
  // Halo: duas hastes traseiras que sobem e se encontram na haste frontal central.
  const hf: V3 = [0, 0.93, 0.98];
  s.tube([0, 0.5, 1.02], hf, '#d8e0ff', P.halo);
  s.tube([-0.3, 0.6, 0.3], [-0.04, 0.92, 0.9], '#e8ecff', P.halo);
  s.tube([0.3, 0.6, 0.3], [0.04, 0.92, 0.9], '#a8b2f0', P.halo);
  s.tube([-0.28, 0.62, 0.34], [-0.28, 0.76, 0.42], '#c0c8f8', P.halo);
  s.tube([0.28, 0.62, 0.34], [0.28, 0.76, 0.42], '#8e98e0', P.halo);
  s.tube([-0.28, 0.76, 0.42], [0, 0.93, 0.96], '#e8ecff', P.halo);
  s.tube([0.28, 0.76, 0.42], [0, 0.93, 0.96], '#a8b2f0', P.halo);

  // Asa traseira alta e larga: plano principal com número, flap e endplates.
  const wz0 = WING_Z0;
  s.box({ x0: -0.56, x1: 0.56, y0: 0.6, y1: 0.78, z0: wz0 + 0.02, z1: WING_Z1 }, body, P.wing);
  s.box({ x0: -0.55, x1: 0.55, y0: 0.82, y1: 0.97, z0: wz0 + 0.1, z1: wz0 + 0.3 }, ['#ffffff', accent[0], accent[1], accent[2]], P.flap);
  // Pilar central (swan neck) e viga inferior.
  s.box({ x0: -0.04, x1: 0.04, y0: 0.38, y1: 0.62, z0: -1.52, z1: -1.46 }, CARBON, P.pillar);
  s.box({ x0: -0.4, x1: 0.4, y0: 0.45, y1: 0.5, z0: -1.55, z1: -1.38 }, CARBON, P.pillar);
  // Endplates verticais altos nas pontas.
  for (const sd of [-1, 1] as const) {
    const xa = sd * 0.56;
    const xb = sd * 0.6;
    s.extrudeX([[-1.7, 1.02], [-1.34, 0.98], [-1.2, 0.74], [-1.22, 0.4], [-1.55, 0.36], [-1.7, 0.4]], Math.min(xa, xb), Math.max(xa, xb), accent, sd < 0 ? P.epL : P.epR);
  }

  // Asa dianteira, com a ponta aparecendo além dos pneus.
  s.box({ x0: -0.97, x1: 0.97, y0: 0.07, y1: 0.12, z0: 2.4, z1: 2.8 }, CARBON, P.fwing);
  s.box({ x0: -0.9, x1: 0.9, y0: 0.13, y1: 0.16, z0: 2.5, z1: 2.74 }, body, P.fwing);
  for (const sd of [-1, 1] as const) {
    s.box({ x0: sd > 0 ? 0.95 : -1.01, x1: sd > 0 ? 1.01 : -0.95, y0: 0.05, y1: 0.3, z0: 2.36, z1: 2.84 }, accent, sd < 0 ? P.fepL : P.fepR);
  }

  // Braços de suspensão (finos, cinza-azulado).
  for (const sd of [-1, 1] as const) {
    s.tube([sd * 0.16, 0.44, -1.0], [sd * (RT.cx - RT.w / 2), 0.5, -1.0], '#9aa4e8', P.arms);
    s.tube([sd * 0.16, 0.2, -1.12], [sd * (RT.cx - RT.w / 2), 0.28, -1.12], '#6a72b8', P.arms);
    s.tube([sd * 0.2, 0.34, 1.65], [sd * (FT.cx - FT.w / 2), 0.38, 1.8], '#9aa4e8', P.arms);
    s.tube([sd * 0.2, 0.18, 1.9], [sd * (FT.cx - FT.w / 2), 0.26, 1.9], '#6a72b8', P.arms);
    s.tube([sd * 0.22, 0.5, 1.4], [sd * (FT.cx - FT.w / 2), 0.4, 1.8], '#c0c8f8', P.arms);
  }

  return { scene: s, wingFace: [0, 0.7, wz0 + 0.02], rainFace: [0, 0.325, -1.55] };
}


// --------------------------------------------------------------------------
// Número e decalques de pixel
// --------------------------------------------------------------------------

const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
};

function drawNumber(f: Frame, p: Painter, L: Livery, at: { x: number; y: number }): void {
  const s = String(L.number);
  const total = s.length * 4 - 1;
  const x0 = Math.round(at.x - total / 2);
  const y0 = Math.round(at.y - 2.5);
  for (const [i, ch] of [...s].entries()) {
    const g = DIGITS[ch];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (g[r][c] !== '1') continue;
        const x = x0 + i * 4 + c;
        const y = y0 + r;
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        if (f.part[y * f.w + x] !== P.wing) continue;
        p.px(x, y, L.numberColor);
      }
    }
  }
}

function drawShadow(f: Frame, p: Painter): void {
  // Sombra no chão sob o carro: elipse penumbra + núcleo sob pneus e piso.
  const rings: [number, number, number, number, string][] = [
    [0.14, 1.18, 2.15, 0.2, 'rgba(26,16,56,0.30)'],
    [0.1, 1.05, 1.75, 0.15, 'rgba(26,16,56,0.42)'],
  ];
  for (const [dx, hx, hz, cz, col] of rings) {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      pts.push(f.project([dx + Math.cos(a) * hx, 0, cz + 0.3 + Math.sin(a) * hz]));
    }
    fillPoly(f, p, pts, col);
  }
}

function fillPoly(f: Frame, p: Painter, pts: { x: number; y: number }[], col: string): void {
  const ys = pts.map((q) => q.y);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(f.h - 1, Math.ceil(Math.max(...ys))); y++) {
    const py = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if ((a.y <= py && b.y > py) || (b.y <= py && a.y > py)) xs.push(a.x + ((py - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.max(0, Math.round(xs[i])); x < Math.min(f.w, Math.round(xs[i + 1])); x++) p.px(x, y, col);
    }
  }
}

// --------------------------------------------------------------------------
// Poses
// --------------------------------------------------------------------------

const YAW = (15 * Math.PI) / 180;

const CAM_BASE: Omit<CamCfg, 'yaw'> = {
  pivotZ: -1.0,
  pitch: (24 * Math.PI) / 180,
  dist: 8,
  focal: 225,
  cx: CAR_W / 2,
  groundY: 36,
  groundRef: [0, 0, RT.z],
};

function makePose(L: Livery, yaw: number): SpriteArt {
  const { canvas, p } = makeCanvas(CAR_W, CAR_H);
  const { scene, wingFace, rainFace } = buildModel(L);
  const cam: CamCfg = { ...CAM_BASE, yaw };
  const f = render(scene, CAR_W, CAR_H, cam);
  drawShadow(f, p);
  finish(f, p, OUT, new Set([`${P.tyreL}:${P.arms}`]));
  drawNumber(f, p, L, f.project(wingFace));
  // Brilho da luz de chuva.
  const r = f.project(rainFace);
  const rx = Math.round(r.x);
  const ry = Math.round(r.y);
  p.hline(rx - 5, ry - 2, 10, 'rgba(255,42,58,0.35)');
  p.hline(rx - 5, ry + 2, 10, 'rgba(255,42,58,0.35)');
  p.hline(rx - 3, ry, 6, '#ffd0d0');
  return { canvas, widthMeters: 2.0, glow: { color: '#ff2a3a', radius: 10, dy: ry - CAR_H / 2 } };
}

function carSprites(L: Livery): CarSprites {
  return { left: makePose(L, -YAW), center: makePose(L, 0), right: makePose(L, YAW) };
}

export function buildPlayerCar(): CarSprites {
  return carSprites(PLAYER_LIVERY);
}

export function buildRivalCars(): CarSprites[] {
  return RIVAL_LIVERIES.map(carSprites);
}

/** Todas as 10 pinturas, para pré-visualização. */
export function buildAllCarSprites(): CarSprites[] {
  return LIVERIES.map(carSprites);
}
