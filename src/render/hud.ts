import { VIEW_H, VIEW_W, type ArtBundle } from '../contracts';
import type { Race } from '../game/race';
import { MAX_SPEED, toKmh } from '../game/physics';
import type { GlowPoint } from './road';

/** HUD provisório; um designer refina depois. Tudo do HUD fica neste arquivo. */

const FONT = "'Pixelify Sans', monospace";

export const fmtTime = (t: number | null): string => {
  if (t === null || !isFinite(t)) return '--:--.---';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
};

/** Sacudida da câmera: leve em alta velocidade, mais forte nas zebras e batidas. */
export function cameraShake(race: Race, t: number): { x: number; y: number } {
  const v = race.state.player.speed / MAX_SPEED;
  let amp = 0.25 * v * v;
  if (race.dyn.onKerb) amp += 1.4 * Math.min(1, v + 0.3);
  if (race.dyn.offroad) amp += 1.0 * v;
  if (race.dyn.crashTimer > 0) amp += 3 * race.dyn.crashTimer;
  return { x: Math.sin(t * 91) * amp * 0.6, y: Math.sin(t * 67 + 1.3) * amp };
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#eaf4ff', align: CanvasTextAlign = 'left'): void {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#02060f';
  ctx.fillText(s, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

export function drawHud(ctx: CanvasRenderingContext2D, art: ArtBundle, race: Race, muted: boolean): GlowPoint[] {
  const st = race.state;
  const glows: GlowPoint[] = [];
  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(art.cockpit, 0, 0);

  // volante
  const w = art.wheel;
  const cx = VIEW_W / 2;
  const cy = VIEW_H - w.height / 2 + 6;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(race.steer * 0.9);
  ctx.drawImage(w, -w.width / 2, -w.height / 2);
  const d = art.wheelDisplay;
  const dx = d.x - w.width / 2;
  const dy = d.y - w.height / 2;
  text(ctx, String(st.gear), dx + d.w * 0.2, dy, Math.max(8, d.h * 0.8), '#ffd24a', 'center');
  text(ctx, String(Math.round(toKmh(st.player.speed))), dx + d.w * 0.68, dy + d.h * 0.1, Math.max(7, d.h * 0.6), '#7fe8ff', 'center');
  ctx.fillStyle = st.rpm > 0.92 ? '#ff3b3b' : '#3bff9c';
  ctx.fillRect(dx, dy + d.h - 2, Math.round(d.w * st.rpm), 2);
  ctx.restore();

  // topo: posição / volta / tempo / trecho
  const lap = Math.min(st.totalLaps, Math.max(1, st.player.lap));
  text(ctx, `P${race.position}/${st.rivals.length + 1}`, 8, 6, 16, '#ffd24a');
  text(ctx, `VOLTA ${lap}/${st.totalLaps}`, 8, 24, 10);
  text(ctx, `TEMPO ${fmtTime(race.lapTime)}`, VIEW_W - 8, 6, 10, '#eaf4ff', 'right');
  text(ctx, `MELHOR ${fmtTime(st.bestLap)}`, VIEW_W - 8, 18, 10, '#7fe8ff', 'right');
  text(ctx, st.sectionName, VIEW_W / 2, VIEW_H - 14, 9, '#8fb4e0', 'center');
  if (muted) text(ctx, 'MUDO', VIEW_W - 8, 30, 8, '#8fb4e0', 'right');

  // luzes de largada
  if (st.phase === 'countdown') {
    for (let i = 0; i < 5; i++) {
      const x = VIEW_W / 2 + (i - 2) * 22;
      const on = i < race.lights;
      ctx.fillStyle = '#10141e';
      ctx.fillRect(x - 8, 38, 16, 22);
      ctx.fillStyle = on ? '#ff2a2a' : '#3a1418';
      ctx.fillRect(x - 6, 41, 12, 16);
      if (on) glows.push({ x, y: 49, radius: 26, color: '#ff2a2a' });
    }
  }
  if (st.phase === 'grid') text(ctx, 'ENTER para largar', VIEW_W / 2, 50, 14, '#ffd24a', 'center');
  if (st.phase === 'racing' && st.time < 2) text(ctx, 'LARGOU!', VIEW_W / 2, 50, 16, '#3bff9c', 'center');
  if (st.phase === 'finished') {
    text(ctx, `BANDEIRADA! P${race.position}`, VIEW_W / 2, 44, 18, '#ffd24a', 'center');
    text(ctx, `Melhor volta ${fmtTime(st.bestLap)}  -  ENTER reinicia`, VIEW_W / 2, 68, 9, '#eaf4ff', 'center');
  }
  return glows;
}
