/** Desenho pixel a pixel sobre um canvas 2D. Coordenadas sempre inteiras: nada de antialiasing. */
export class Painter {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly w: number,
    readonly h: number,
  ) {}

  rect(x: number, y: number, w: number, h: number, color: string): this {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }

  px(x: number, y: number, color: string): this {
    return this.rect(x, y, 1, 1, color);
  }

  hline(x: number, y: number, w: number, color: string): this {
    return this.rect(x, y, w, 1, color);
  }

  vline(x: number, y: number, h: number, color: string): this {
    return this.rect(x, y, 1, h, color);
  }

  /** Contorno de 1px por dentro do retângulo. */
  frame(x: number, y: number, w: number, h: number, color: string): this {
    return this.hline(x, y, w, color).hline(x, y + h - 1, w, color).vline(x, y, h, color).vline(x + w - 1, y, h, color);
  }

  /** Bloco com contorno, topo claro e base sombreada. */
  block(x: number, y: number, w: number, h: number, base: string, light: string, dark: string, outline: string): this {
    this.rect(x, y, w, h, base);
    this.hline(x + 1, y + 1, w - 2, light);
    this.hline(x + 1, y + h - 2, w - 2, dark);
    return this.frame(x, y, w, h, outline);
  }

  /** Pixels de ruído determinísticos (textura). */
  speckle(x: number, y: number, w: number, h: number, colors: string[], density: number, rand: () => number): this {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (rand() < density) this.px(xx, yy, colors[Math.floor(rand() * colors.length)]);
      }
    }
    return this;
  }
}

/** Cria um canvas transparente e o Painter associado. */
export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; p: Painter } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');
  return { canvas, p: new Painter(ctx, w, h) };
}

/** Gerador pseudoaleatório determinístico (mulberry32): a arte não muda entre execuções. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash determinístico de (x, y, seed) em [0, 1). */
export function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Converte #rrggbb em rgba(r,g,b,a). */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
