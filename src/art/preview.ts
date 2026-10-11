import { buildArt } from './index';

const SCALE = 3;
const art = buildArt();
const grid: HTMLElement = document.getElementById('grid') ?? document.body;

function add(label: string, canvas: HTMLCanvasElement, wide = false): void {
  const fig = document.createElement('figure');
  if (wide) fig.className = 'wide';
  canvas.style.width = `${canvas.width * SCALE}px`;
  canvas.style.height = `${canvas.height * SCALE}px`;
  const cap = document.createElement('figcaption');
  cap.textContent = `${label} ${canvas.width}x${canvas.height}`;
  fig.append(canvas, cap);
  grid.append(fig);
}

const kinds = Object.keys(art.props) as (keyof typeof art.props)[];
for (const kind of kinds) {
  const s = art.props[kind];
  add(`${kind} (wu ${s.worldWidth}${s.glow ? ', glow' : ''})`, s.canvas);
}
art.rivalCars.forEach((s, i) => add(`rivalCar ${i} (wu ${s.center.worldWidth})`, s.center.canvas));
add('playerCar', art.playerCar.center.canvas);
add('sky', art.sky, true);
add('hills', art.hills, true);
