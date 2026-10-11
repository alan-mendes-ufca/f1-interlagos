import type { CarSprites } from '../contracts';
import { buildArt } from './index';

const SCALE = 3;
const only = new URLSearchParams(location.search).get('only');
const want = (k: string): boolean => !only || only === k;
const art = buildArt();

function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  const root = document.getElementById('grid') ?? document.body;
  root.append(h, row);
  return row;
}

function add(row: HTMLElement, label: string, canvas: HTMLCanvasElement, wide = false, scale = SCALE): void {
  const fig = document.createElement('figure');
  if (wide) fig.className = 'wide';
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
  const cap = document.createElement('figcaption');
  cap.textContent = `${label} ${canvas.width}x${canvas.height}`;
  fig.append(canvas, cap);
  row.append(fig);
}

if (want('layers')) {
  const layers = section('Camadas de fundo (sky, clouds, mountains, hills)');
  add(layers, 'sky', art.sky, true);
  add(layers, 'clouds', art.clouds, true);
  add(layers, 'mountains', art.mountains, true);
  add(layers, 'hills', art.hills, true);

  const roadRow = section('Estrada (RoadPalette)');
  const road = document.createElement('div');
  road.className = 'swatches';
  for (const [k, v] of Object.entries(art.road)) {
    const s = document.createElement('span');
    s.style.background = v;
    s.textContent = k;
    road.append(s);
  }
  roadRow.append(road);
}

if (want('cars')) {
  const carsRow = section('Carros 72x40 ampliados 4x: left / center / right (jogador + 9 rivais)');
  const all: [string, CarSprites][] = [['player', art.playerCar], ...art.rivalCars.map((c, i): [string, CarSprites] => [`rival ${i}`, c])];
  for (const [name, c] of all) {
    const g = document.createElement('div');
    g.className = 'cargroup';
    carsRow.append(g);
    for (const pose of ['left', 'center', 'right'] as const) add(g, `${name} ${pose} (${c[pose].widthMeters} m)`, c[pose].canvas, false, 4);
  }
}

if (want('props')) {
  const propsRow = section('Props (2x; largura real em metros)');
  for (const kind of Object.keys(art.props) as (keyof typeof art.props)[]) {
    const s = art.props[kind];
    add(propsRow, `${kind} (${s.widthMeters} m)`, s.canvas, false, 2);
  }
}
