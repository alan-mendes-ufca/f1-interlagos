import { VIEW_H, VIEW_W } from '../contracts';
import type { GlowPoint } from './road';

/** Glowmap: canvas sobreposto (mix-blend-mode: screen + blur via CSS, ver style.css). */
export class Lights {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = VIEW_W;
    this.canvas.height = VIEW_H;
    this.canvas.className = 'glowmap';
    parent.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  draw(points: GlowPoint[], extra: GlowPoint[] = []): void {
    const g = this.ctx;
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    g.globalCompositeOperation = 'lighter';
    for (const list of [points, extra]) {
      for (const p of list) {
        const r = Math.min(120, Math.max(2, p.radius));
        const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = 0.75;
        g.fillStyle = grad;
        g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
}
