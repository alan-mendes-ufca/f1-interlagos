import type { CarSprites, SpriteArt } from '../contracts';
import { makeCanvas, type Painter } from './canvas';
import { C } from './palette';
import { lerpHex } from './util';

const W = 112;
const H = 56;
const OUT = '#1a1038';

/** Escala de 4 tons de uma cor de livrée: luz, base, sombra, sombra profunda. */
export interface Livery {
  body: [string, string, string, string];
  accent: [string, string, string, string];
  helmet: [string, string, string];
  rainGlow: string;
  detail: 'player' | 'rival';
}

function scale(base: string): [string, string, string, string] {
  return [lerpHex(base, '#ffffff', 0.45), base, lerpHex(base, '#2a0a60', 0.35), lerpHex(base, '#1a1038', 0.62)];
}

function liv(body: string, accent: string, helmet: [string, string, string], detail: 'player' | 'rival' = 'rival'): Livery {
  return { body: scale(body), accent: scale(accent), helmet, rainGlow: '#ff2a3a', detail };
}

export const PLAYER_LIVERY = liv('#ff2a4a', '#2fd6ff', ['#2fd6ff', '#ff2a4a', '#ffffff'], 'player');
export const RIVAL_LIVERIES: Livery[] = [
  liv('#2a52ff', '#ffd23a', ['#ffd23a', '#2a52ff', '#ffffff']),
  liv('#9ae82a', '#1a1038', ['#ffffff', '#9ae82a', '#1a1038']),
  liv('#ff8a1a', '#2a6aff', ['#2a6aff', '#ff8a1a', '#ffffff']),
  liv('#d8e0f8', '#1fd0b8', ['#1fd0b8', '#d8e0f8', '#ffffff']),
  liv('#9a3ae0', '#ff5aa8', ['#ff5aa8', '#9a3ae0', '#ffffff']),
];

/** Caixa com 4 tons: luz no topo e à esquerda, sombra embaixo e à direita, contorno escuro. */
function box(p: Painter, x: number, y: number, w: number, h: number, t: [string, string, string, string]): void {
  if (w < 2 || h < 2) return;
  p.rect(x, y, w, h, t[1]);
  p.hline(x, y, w, t[0]);
  p.vline(x, y, h, t[0]);
  p.hline(x, y + h - 1, w, t[2]);
  p.vline(x + w - 1, y, h, t[2]);
  if (h > 3) p.hline(x + 1, y + h - 2, w - 2, t[3]);
  p.frame(x - 1, y - 1, w + 2, h + 2, OUT);
}

/** Pneu traseiro largo visto de trás e de cima: banda de rodagem com sulcos, brilho e (se visível) flanco. */
function tyre(p: Painter, x: number, y: number, w: number, h: number, side: -1 | 0 | 1, sideW: number): void {
  // Forma com cantos cortados.
  p.rect(x + 1, y - 1, w - 2, h + 2, OUT);
  p.rect(x - 1, y + 1, w + 2, h - 2, OUT);
  p.rect(x, y, w, h, C.tyre);
  // Sulcos horizontais de banda de rodagem.
  for (let yy = y + 3; yy < y + h - 2; yy += 4) {
    p.hline(x + 1, yy, w - 2, '#0a0820');
    p.hline(x + 1, yy + 1, w - 2, '#2a2650');
  }
  // Brilho de borracha em cima-esquerda e topo.
  p.hline(x + 2, y, w - 4, '#6a66a8');
  p.hline(x + 1, y + 1, w - 2, C.tyreLight);
  p.vline(x, y + 2, h - 4, '#3c3a6a');
  p.rect(x + 2, y + 2, 3, 2, '#8a86c8');
  p.px(x + 2, y + 2, '#c0bcf0');
  // Coluna de sombra no lado oposto à luz.
  p.vline(x + w - 1, y + 1, h - 2, '#0a0820');
  // Flanco visível (lado da frente do carro girado) com aro e marcação colorida.
  if (side !== 0 && sideW > 0) {
    const sx = side > 0 ? x + w : x - sideW;
    p.rect(sx, y + 1, sideW, h - 2, '#26224a');
    p.vline(side > 0 ? sx + sideW - 1 : sx, y + 2, h - 4, OUT);
    p.hline(sx, y + 1, sideW, '#4a4680');
    p.rect(sx + (side > 0 ? 0 : 1), y + 4, sideW - 1, 2, '#ffd23a');
    p.rect(sx, y + h - 4, sideW - 1, 2, '#0a0820');
    p.frame(sx - (side < 0 ? 0 : 0), y, sideW, h, OUT);
    p.rect(sx, y, sideW, 1, OUT);
  }
}

interface Pose {
  /** -1 = esterço à esquerda, 0 = reto, 1 = direita. */
  yaw: -1 | 0 | 1;
}

function drawCar(p: Painter, L: Livery, pose: Pose): void {
  const yaw = pose.yaw;
  // Deslocamento por profundidade: partes mais à frente (longe) vão para o lado do esterço,
  // partes traseiras (perto) vão para o lado oposto. Dá o cisalhamento de perspectiva.
  const off = (depth: number): number => Math.round(yaw * depth * 5);
  const cx = 56;
  const wingOff = off(-0.9);
  const tyreOff = off(-0.8);
  const bodyOff = off(0.1);
  const frontOff = off(1);
  const b = L.body;
  const a = L.accent;

  // Largura dos pneus: o lado voltado ao espectador fica mais largo e mostra flanco.
  const lw = 25 - yaw * 4; // yaw>0 (direita): esquerdo mais largo
  const rw = 25 + yaw * 4;
  const lx = 6 + tyreOff + (yaw > 0 ? -2 : 3);
  const rx = 112 - 6 - rw + tyreOff + (yaw < 0 ? 2 : -3);
  const tyreTop = 25;
  const tyreH = 26;

  // Sombra de contato sob o carro (opaca, azul-noite).
  p.rect(10 + tyreOff, 52, 92, 3, 'rgba(26,16,56,0.45)');

  // Braços de suspensão atrás dos pneus.
  const arm = (x0: number, x1: number, y: number): void => {
    p.hline(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, OUT);
    p.hline(Math.min(x0, x1), y + 1, Math.abs(x1 - x0) + 1, '#5a5a9a');
  };
  arm(lx + lw - 1, cx - 12 + bodyOff, 32);
  arm(cx + 12 + bodyOff, rx, 32);
  arm(lx + lw - 1, cx - 14 + bodyOff, 42);
  arm(cx + 14 + bodyOff, rx, 42);

  // Pneus (atrás da carroceria): lado de dentro encoberto pelo corpo.
  tyre(p, lx, tyreTop, lw, tyreH, yaw > 0 ? -1 : 0, yaw > 0 ? 4 : 0);
  tyre(p, rx, tyreTop, rw, tyreH, yaw < 0 ? 1 : 0, yaw < 0 ? 4 : 0);

  // Entrada de ar e laterais (sidepods) em cunha.
  for (let y = 18; y < 40; y++) {
    const t = (y - 18) / 22;
    const o = Math.round(bodyOff + (off(-0.4) - bodyOff) * t);
    const hw = Math.round(15 + t * 6);
    p.hline(cx - hw + o - 1, y, 1, OUT);
    p.hline(cx + hw + o, y, 1, OUT);
    p.hline(cx - hw + o, y, hw * 2, y < 20 ? b[0] : t < 0.6 ? b[1] : b[2]);
    p.px(cx - hw + o, y, b[0]);
    p.px(cx + hw + o - 1, y, b[3]);
  }
  p.hline(cx - 15 + bodyOff, 17, 31, OUT);
  p.hline(cx - 22 + off(-0.4), 40, 44, OUT);
  // Faixa de acento nos sidepods.
  box(p, cx - 20 + off(-0.3), 31, 7, 5, a);
  box(p, cx + 14 + off(-0.3), 31, 7, 5, a);

  // Cobertura do motor (engine cover) afunilando para o capacete, cisalhada.
  for (let y = 6; y <= 38; y++) {
    const t = (y - 6) / 32;
    const o = Math.round(frontOff + (bodyOff - frontOff) * t);
    const hw = Math.round(4 + t * 9);
    p.rect(cx - hw + o - 1, y, 1, 1, OUT);
    p.rect(cx + hw + o, y, 1, 1, OUT);
    p.rect(cx - hw + o, y, hw * 2, 1, b[1]);
    p.rect(cx - hw + o, y, Math.max(2, Math.floor(hw * 0.55)), 1, b[0]);
    p.rect(cx + hw + o - Math.max(2, Math.floor(hw * 0.4)), y, Math.max(2, Math.floor(hw * 0.4)), 1, b[2]);
    p.px(cx + hw + o - 1, y, b[3]);
  }
  p.hline(cx - 5 + frontOff, 5, 10, OUT);
  // Faixa central de acento (listra) e entrada de ar do motor (airbox).
  for (let y = 8; y < 34; y++) {
    const t = (y - 8) / 26;
    const o = Math.round(frontOff + (bodyOff - frontOff) * ((y - 6) / 32));
    p.rect(cx - 1 + o, y, 3, 1, t < 0.1 ? a[0] : a[1]);
    p.px(cx - 1 + o, y, a[0]);
    p.px(cx + 1 + o, y, a[2]);
  }
  box(p, cx - 4 + off(0.5) * 0 + Math.round(frontOff * 0.75), 14, 8, 6, ['#3a3a6a', '#1a1038', '#120a2a', '#0a0620']);
  p.rect(cx - 3 + Math.round(frontOff * 0.75), 15, 6, 1, '#6a66b8');

  // Halo (arco titânio) e capacete do piloto, sobre a cobertura do motor.
  const hx = cx + Math.round(frontOff * 0.9);
  // Capacete (calota e viseira apontada para frente, longe da câmera, por isso só a nuca e o topo).
  p.rect(hx - 4, 3, 9, 8, OUT);
  p.rect(hx - 3, 2, 7, 9, OUT);
  p.rect(hx - 3, 3, 7, 7, L.helmet[0]);
  p.rect(hx - 2, 2, 5, 1, L.helmet[0]);
  p.rect(hx - 3, 6, 7, 2, L.helmet[1]);
  p.rect(hx + 1, 3, 3, 7, lerpHex(L.helmet[0], '#2a0a60', 0.35));
  p.rect(hx - 2, 3, 2, 2, '#ffffff');
  p.px(hx - 3, 3, '#ffffff');
  p.hline(hx - 2, 9, 5, L.helmet[2]);
  // Halo: duas hastes laterais e arco sobre o capacete.
  const ha = '#d8e0ff';
  const hd = '#6a74b8';
  p.rect(hx - 8, 6, 2, 12, OUT);
  p.rect(hx + 7, 6, 2, 12, OUT);
  p.vline(hx - 7, 5, 12, ha);
  p.vline(hx + 7, 5, 12, hd);
  p.rect(hx - 7, 4, 15, 2, OUT);
  p.hline(hx - 7, 4, 14, ha);
  p.hline(hx - 6, 5, 13, hd);
  p.rect(hx - 1, 4, 3, 2, '#ffffff');

  // Piso e difusor (parte baixa), com aletas.
  const df = off(-1);
  box(p, 25 + df, 43, 62, 4, ['#4a4a8a', '#2a2a5a', '#1a1a3a', '#120e30']);
  p.hline(26 + df, 43, 60, '#8a8ad0');
  p.hline(28 + df, 47, 56, OUT);
  // Difusor: bloco escuro com aletas verticais claras.
  p.rect(33 + df, 47, 46, 6, OUT);
  p.rect(34 + df, 47, 44, 5, '#14102c');
  for (let i = 0; i < 9; i++) {
    const fx = 36 + df + i * 5;
    p.vline(fx, 47, 5, '#5a5aa0');
    p.px(fx, 47, '#a8a8f0');
    p.vline(fx + 1, 48, 4, '#0a0620');
  }
  p.hline(34 + df, 52, 44, '#2a2660');
  // Luz de chuva vermelha central com glow pequeno.
  const rx0 = cx + df - 1;
  p.rect(rx0 - 3, 46, 7, 1, 'rgba(255,42,58,0.35)');
  p.rect(rx0 - 3, 47, 1, 3, 'rgba(255,42,58,0.35)');
  p.rect(rx0 + 3, 47, 1, 3, 'rgba(255,42,58,0.35)');
  p.rect(rx0 - 3, 50, 7, 1, 'rgba(255,42,58,0.35)');
  p.rect(rx0 - 2, 47, 5, 3, '#ff2a3a');
  p.rect(rx0 - 1, 48, 3, 1, '#ffd0d0');
  p.px(rx0 - 2, 47, '#ff8a8a');

  // Asa traseira: plano principal, flap superior, endplates com livrée e beam wing.
  const wx = wingOff;
  // Beam wing abaixo, entre pneus.
  box(p, 30 + wx, 22, 52, 3, ['#9aa4ee', '#6a74c8', '#3a4090', '#262a68']);
  // Pilar central da asa.
  box(p, cx - 2 + wx, 14, 4, 9, a);
  // Plano principal.
  box(p, 26 + wx, 15, 60, 6, b);
  p.hline(27 + wx, 16, 58, b[0]);
  // Flap superior com abertura (DRS) mais clara.
  box(p, 28 + wx, 9, 56, 4, ['#ffffff', a[0], a[2], a[3]]);
  p.hline(29 + wx, 10, 54, '#ffffff');
  p.hline(28 + wx, 13, 56, OUT);
  // Textura: listras de patrocínio genéricas.
  for (let x = 33 + wx; x < 80 + wx; x += 7) p.rect(x, 17, 3, 2, a[1]);
  // Endplates altas nas pontas.
  box(p, 24 + wx, 6, 4, 17, b);
  box(p, 84 + wx, 6, 4, 17, ['#e0d0ff', b[2], b[3], b[3]]);
  p.rect(25 + wx, 8, 2, 3, a[0]);
  p.rect(85 + wx, 8, 2, 3, a[2]);
  p.hline(24 + wx, 6, 4, '#ffffff');
  // Luz de chuva na asa (leds) e brilho final.
  p.hline(28 + wx, 20, 56, b[2]);
  if (L.detail === 'player') {
    // Detalhes extras do jogador: numero 7 pixelado na cobertura e faixas finas ciano.
    const nx = cx - 3 + Math.round(frontOff * 0.4);
    p.rect(nx, 24, 7, 1, '#ffffff');
    p.rect(nx + 4, 25, 2, 1, '#ffffff');
    p.rect(nx + 3, 26, 2, 1, '#ffffff');
    p.rect(nx + 2, 27, 2, 3, '#ffffff');
    p.hline(30 + wx, 19, 52, a[0]);
  }
}

function makePose(L: Livery, yaw: -1 | 0 | 1): SpriteArt {
  const { canvas, p } = makeCanvas(W, H);
  drawCar(p, L, { yaw });
  // dy: deslocamento vertical do glow em relação ao centro do sprite (luz de chuva em y~48 de 56).
  return { canvas, worldWidth: 1000, glow: { color: L.rainGlow, radius: 10, dy: 48 - H / 2 } };
}

function carSprites(L: Livery): CarSprites {
  return { left: makePose(L, -1), center: makePose(L, 0), right: makePose(L, 1) };
}

export function buildPlayerCar(): CarSprites {
  return carSprites(PLAYER_LIVERY);
}

export function buildRivalCars(): CarSprites[] {
  return RIVAL_LIVERIES.slice(0, 5).map(carSprites);
}

/** Todas as 6 livrées, para pré-visualização. */
export function buildAllCarSprites(): CarSprites[] {
  return [PLAYER_LIVERY, ...RIVAL_LIVERIES].map(carSprites);
}
