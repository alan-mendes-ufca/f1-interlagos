import { VIEW_H, VIEW_W, type ArtBundle } from '../contracts';
import type { Race } from '../game/race';
import { toKmh } from '../game/physics';
import { drawMinimap, paintColor } from './minimap';
import type { GlowPoint } from './road';

/** HUD em pixel art: painéis azul-marinho translúcidos, borda clara e números brancos grandes. */

const FONT = "'Pixelify Sans', monospace";
const PANEL = 'rgba(11,26,74,0.8)';
const BORDER = '#9db8ff';
const WHITE = '#ffffff';
const SOFT = '#cfe0ff';
export const TRACK_NAME = 'Interlagos Drive';

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, '0');

/** Tempo de volta: m:ss.mmm. */
export const fmtTime = (t: number | null): string => {
  if (t === null || !isFinite(t)) return '-:--.---';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
};

/** Relógio de corrida: HH:MM:SS,cc. */
export const fmtClock = (t: number | null): string => {
  if (t === null || !isFinite(t)) return '--:--:--,--';
  const cs = Math.floor(t * 100);
  return `${pad(cs / 360000)}:${pad((cs / 6000) % 60)}:${pad((cs / 100) % 60)},${pad(cs % 100)}`;
};

/** Sacudida só em batidas: o quique em zebra/grama fica no carro. */
export function cameraShake(race: Race, t: number): { x: number; y: number } {
  const amp = 3 * race.dyn.crashTimer;
  return { x: Math.sin(t * 91) * amp * 0.6, y: Math.sin(t * 67 + 1.3) * amp };
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = WHITE, align: CanvasTextAlign = 'left', weight = 600): void {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#020a24';
  ctx.fillText(s, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 5): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = BORDER;
  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.stroke();
  ctx.restore();
}

function flag(ctx: CanvasRenderingContext2D, x: number, y: number, checkered: boolean): void {
  ctx.fillStyle = WHITE;
  ctx.fillRect(x, y, 1, 9);
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = checkered ? ((i + j) % 2 === 0 ? WHITE : '#10142a') : '#35e06a';
      ctx.fillRect(x + 1 + i, y + j * 2, 1, 2);
    }
  }
}

function stopwatch(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = WHITE;
  ctx.fillRect(x + 3, y, 4, 1);
  ctx.fillRect(x + 4, y + 1, 2, 1);
  ctx.beginPath();
  ctx.arc(x + 5, y + 6, 4.5, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = WHITE;
  ctx.stroke();
  ctx.fillRect(x + 5, y + 3, 1, 3);
  ctx.fillRect(x + 5, y + 6, 2, 1);
}

function note(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x + 3, y, 6, 2);
  ctx.fillRect(x + 8, y, 2, 8);
  ctx.fillRect(x + 3, y, 2, 8);
  ctx.fillRect(x, y + 7, 4, 3);
  ctx.fillRect(x + 5, y + 7, 4, 3);
}

/** Cor do arco do velocímetro: verde -> amarelo -> vermelho. */
function rpmColor(f: number): string {
  if (f < 0.6) return '#38e060';
  if (f < 0.82) return '#ffd630';
  return '#ff3b3b';
}

function speedo(ctx: CanvasRenderingContext2D, cx: number, cy: number, rpm: number, kmh: number, gear: number): void {
  const R = 36;
  const SEGS = 24;
  const a0 = Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  ctx.lineWidth = 5;
  ctx.lineCap = 'butt';
  for (let i = 0; i < SEGS; i++) {
    const f = i / SEGS;
    const s = a0 + sweep * f;
    const e = a0 + sweep * ((i + 0.8) / SEGS);
    ctx.beginPath();
    ctx.arc(cx, cy, R, s, e);
    ctx.strokeStyle = f < rpm ? rpmColor(f) : 'rgba(157,184,255,0.25)';
    ctx.stroke();
  }
  text(ctx, String(Math.round(kmh)), cx, cy - 15, 26, WHITE, 'center', 700);
  text(ctx, 'km/h', cx, cy + 8, 10, SOFT, 'center');
  text(ctx, `MARCHA ${gear}`, cx, cy + 22, 10, '#ffe27a', 'center');
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number): void {
  ctx.fillStyle = 'rgba(157,184,255,0.3)';
  ctx.fillRect(x, y, w, 5);
  ctx.fillStyle = '#35e06a';
  ctx.fillRect(x, y, Math.round(w * frac), 5);
  ctx.fillStyle = WHITE;
  ctx.fillRect(x + Math.round(w * frac) - 1, y - 2, 3, 9);
}

export interface HudOpts {
  art?: ArtBundle;
  /** Indicador "FREIE!" ligado (tecla B desliga). */
  brakeHint?: boolean;
}

const RIVAL_FALLBACK = ['#ff8a2a', '#2ad0ff', '#f5e03a', '#7dff5a', '#c05aff', '#ff5ab4', '#ffffff', '#3a7bff', '#ffb36b'];

function rivalColors(race: Race, art?: ArtBundle): string[] {
  return race.state.rivals.map((r, i) => paintColor(art?.rivalCars[r.sprite % (art.rivalCars.length || 1)]?.center.canvas, RIVAL_FALLBACK[i % RIVAL_FALLBACK.length]));
}

/** Aviso discreto de frenagem: curva à frente abaixo da velocidade atual e já na distância de frenagem. */
function drawBrakeHint(ctx: CanvasRenderingContext2D, race: Race, clock: number): void {
  const a = race.advice;
  if (!a || !a.brake) return;
  const cx = VIEW_W / 2;
  const blink = Math.floor(clock * 6) % 2 === 0;
  panel(ctx, cx - 70, 38, 140, 30, 5);
  text(ctx, 'FREIE!', cx, 39, 17, blink ? '#ff5a4a' : '#ffd630', 'center', 700);
  text(ctx, `curva a ${Math.round(a.distance / 10) * 10} m · ${Math.round(a.limitKmh / 5) * 5} km/h`, cx, 57, 9, SOFT, 'center');
}

export function drawHud(ctx: CanvasRenderingContext2D, race: Race, muted: boolean, clock = 0, opts: HudOpts = {}): GlowPoint[] {
  const st = race.state;
  const glows: GlowPoint[] = [];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const cx = VIEW_W / 2;

  if (st.phase === 'grid') {
    drawTitle(ctx, clock);
    ctx.restore();
    return glows;
  }

  // superior esquerdo: progresso da volta e posição
  panel(ctx, 6, 6, 124, 50);
  flag(ctx, 12, 12, false);
  flag(ctx, 116, 12, true);
  const frac = Math.max(0, Math.min(1, st.player.z / race.track.length));
  bar(ctx, 22, 16, 92, frac);
  text(ctx, `P${race.position}/${st.rivals.length + 1}`, 68, 26, 24, WHITE, 'center', 700);

  // topo centro: volta
  const lap = Math.min(st.totalLaps, Math.max(1, st.player.lap));
  panel(ctx, cx - 56, 6, 112, 28);
  text(ctx, `VOLTA ${lap}/${st.totalLaps}`, cx, 9, 20, WHITE, 'center', 700);

  // superior direito: cronômetro e melhor volta
  panel(ctx, VIEW_W - 136, 6, 130, 50);
  stopwatch(ctx, VIEW_W - 130, 13);
  text(ctx, fmtClock(st.time), VIEW_W - 12, 10, 17, WHITE, 'right', 700);
  text(ctx, 'MELHOR', VIEW_W - 130, 36, 11, SOFT);
  text(ctx, st.bestLap === null ? '-:--.---' : fmtTime(st.bestLap), VIEW_W - 12, 34, 14, '#ffe27a', 'right', 700);

  // minimapa abaixo do cronômetro
  if (race.track.geo) {
    const colors = rivalColors(race, opts.art);
    drawMinimap(ctx, VIEW_W - 136, 60, {
      geo: race.track.geo,
      trackLength: race.track.length,
      player: st.player,
      rivals: st.rivals.map((r, i) => ({ z: r.z, color: colors[i] })),
      sectionName: st.sectionName,
      clock,
      panel: (c, x, y, w, h) => panel(c, x, y, w, h),
      label: (c, str, x, y) => text(c, str, x, y, 10, SOFT, 'center'),
    });
  }
  if (opts.brakeHint !== false && st.phase === 'racing') drawBrakeHint(ctx, race, clock);

  // inferior direito: velocímetro
  panel(ctx, VIEW_W - 100, VIEW_H - 92, 94, 86);
  speedo(ctx, VIEW_W - 53, VIEW_H - 46, st.rpm, toKmh(st.player.speed), st.gear);

  // inferior esquerdo: faixa e trecho
  panel(ctx, 6, VIEW_H - 40, 150, 34);
  note(ctx, 13, VIEW_H - 33, muted ? '#ff6a6a' : WHITE);
  text(ctx, muted ? `${TRACK_NAME} (mudo)` : TRACK_NAME, 30, VIEW_H - 37, 13, WHITE, 'left', 600);
  text(ctx, st.sectionName, 30, VIEW_H - 21, 11, SOFT);

  // largada
  if (st.phase === 'countdown') {
    panel(ctx, cx - 80, 40, 160, 40);
    for (let i = 0; i < 5; i++) {
      const x = cx + (i - 2) * 30;
      const on = i < race.lights;
      ctx.beginPath();
      ctx.arc(x, 60, 11, 0, Math.PI * 2);
      ctx.fillStyle = on ? '#ff2a2a' : '#3a1020';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = on ? '#ffb0b0' : '#6a3a50';
      ctx.stroke();
      if (on) glows.push({ x, y: 60, radius: 30, color: '#ff2a2a' });
    }
  } else if (st.phase === 'racing' && st.time < 1.4) {
    panel(ctx, cx - 60, 40, 120, 40);
    text(ctx, 'VAI!', cx, 44, 32, '#52ff86', 'center', 700);
  }

  if (st.phase === 'finished') drawResult(ctx, race);
  ctx.restore();
  return glows;
}

function drawTitle(ctx: CanvasRenderingContext2D, clock: number): void {
  const cx = VIEW_W / 2;
  ctx.fillStyle = 'rgba(2,8,30,0.35)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, cx - 140, 56, 280, 130, 8);
  text(ctx, 'F1 INTERLAGOS', cx, 70, 38, WHITE, 'center', 700);
  text(ctx, 'Autodromo José Carlos Pace', cx, 112, 12, SOFT, 'center');
  if (Math.floor(clock * 2) % 2 === 0) text(ctx, 'ENTER para correr', cx, 134, 20, '#ffe27a', 'center', 700);
  text(ctx, 'Setas/WASD dirigem  -  Espaço: freio de mão  -  M: mudo  -  B: aviso de frenagem', cx, 166, 9, SOFT, 'center');
}

function drawResult(ctx: CanvasRenderingContext2D, race: Race): void {
  const st = race.state;
  const cx = VIEW_W / 2;
  ctx.fillStyle = 'rgba(2,8,30,0.4)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, cx - 120, 34, 240, 190, 8);
  text(ctx, 'BANDEIRADA!', cx, 42, 20, '#ffe27a', 'center', 700);
  text(ctx, `P${race.position}/${st.rivals.length + 1}`, cx, 66, 44, WHITE, 'center', 700);
  text(ctx, 'POSIÇÃO FINAL', cx, 114, 11, SOFT, 'center');
  const best = st.bestLap;
  st.lapTimes.forEach((t, i) => {
    const isBest = best !== null && t === best;
    const y = 132 + i * 16;
    text(ctx, `VOLTA ${i + 1}`, cx - 90, y, 13, SOFT);
    text(ctx, fmtTime(t), cx + 90, y, 14, isBest ? '#52ff86' : WHITE, 'right', 700);
  });
  text(ctx, `TOTAL ${fmtClock(st.time)}`, cx, 184, 12, WHITE, 'center');
  text(ctx, 'ENTER para reiniciar', cx, 203, 12, '#ffe27a', 'center', 700);
}
