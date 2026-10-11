import type { SpriteArt } from '../contracts';
import { makeCanvas, type Painter } from './canvas';
import { C } from './palette';

interface Team {
  body: string;
  dark: string;
  light: string;
}

// Escuderias fictícias, sem logos nem cores de equipes reais.
const TEAMS: Team[] = [
  { body: '#e0223a', dark: '#8a0f24', light: '#ff7a8c' }, // carmim
  { body: '#18b8e0', dark: '#0a5a8a', light: '#9ff2ff' }, // ciano
  { body: '#8be02a', dark: '#3f7a10', light: '#e8ff8a' }, // verde-limão
  { body: '#ff7a1a', dark: '#b03a08', light: '#ffd08a' }, // laranja
  { body: '#9a4dff', dark: '#4a1a9a', light: '#d8b8ff' }, // roxo
];

/** Carro visto de trás, 64x32: asa traseira, pneus traseiros largos e luz de chuva vermelha. */
function drawCar(p: Painter, t: Team): void {
  const O = C.ink;
  // Pneus traseiros (largos, pretos).
  for (const x0 of [2, 47]) {
    p.block(x0, 17, 15, 14, C.tyre, '#2e2a52', '#05040c', O);
    p.rect(x0 + 5, 22, 5, 4, '#3a3560');
  }
  // Asa traseira: plano superior e placas laterais.
  p.block(9, 2, 46, 4, t.body, t.light, t.dark, O);
  p.rect(10, 6, 44, 2, t.dark);
  p.vline(7, 2, 10, t.dark);
  p.vline(56, 2, 10, t.dark);
  p.frame(6, 2, 3, 11, O);
  p.frame(55, 2, 3, 11, O);
  // Aerofólio inferior (difusor) e escape.
  p.rect(16, 26, 32, 3, t.dark);
  p.hline(16, 26, 32, t.body);
  // Caixa de ar e capacete.
  p.block(27, 8, 10, 5, t.body, t.light, t.dark, O);
  p.rect(28, 13, 8, 5, t.light);
  p.hline(28, 16, 8, '#0a1a3a');
  p.frame(28, 13, 8, 5, O);
  // Pods laterais.
  p.block(13, 18, 12, 8, t.body, t.light, t.dark, O);
  p.block(39, 18, 12, 8, t.body, t.light, t.dark, O);
  // Motor e cobertura central.
  p.block(27, 19, 10, 7, t.body, t.light, t.dark, O);
  // Luz de chuva vermelha.
  p.rect(30, 22, 4, 2, C.signalRed);
  p.px(31, 22, '#ffb0b0');
}

/** Cinco carros rivais, uma cor de escuderia por sprite, base na última linha. */
export function buildRivalCars(): SpriteArt[] {
  return TEAMS.map((t) => {
    const { canvas, p } = makeCanvas(64, 32);
    drawCar(p, t);
    return { canvas, worldWidth: 900, glow: { color: C.signalRed, radius: 6, dy: -4 } };
  });
}
