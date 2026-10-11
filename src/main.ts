import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './style.css';
import { VIEW_H, VIEW_W, type ArtBundle, type TrackDef } from './contracts';
import { buildPlaceholderArt } from './game/placeholderArt';
import { Input } from './game/input';
import { Race } from './game/race';
import { buildTrack } from './track/build';
import { sampleTrack } from './track/sample';
import { drawHud, cameraShake } from './render/hud';
import { Lights } from './render/lights';
import { RoadRenderer } from './render/road';

// Módulos opcionais: import.meta.glob não quebra o build quando o arquivo ainda não existe.
const artMods = import.meta.glob('./art/index.ts');
const trackMods = import.meta.glob('./track/interlagos.ts');

async function loadArt(): Promise<ArtBundle> {
  try {
    const load = artMods['./art/index.ts'];
    if (load) {
      const mod = (await load()) as { buildArt?: () => ArtBundle };
      if (mod.buildArt) return mod.buildArt();
    }
  } catch (e) {
    console.warn('Arte real indisponível, usando placeholder', e);
  }
  return buildPlaceholderArt();
}

async function loadTrack(): Promise<TrackDef> {
  try {
    const load = trackMods['./track/interlagos.ts'];
    if (load) {
      const mod = (await load()) as Record<string, unknown>;
      for (const v of [mod.default, ...Object.values(mod)]) {
        if (v && typeof v === 'object' && Array.isArray((v as TrackDef).sections)) return v as TrackDef;
      }
    }
  } catch (e) {
    console.warn('Traçado real indisponível, usando amostra', e);
  }
  return sampleTrack;
}

async function main(): Promise<void> {
  await document.fonts?.load("16px 'Pixelify Sans'").catch(() => undefined);
  const [art, def] = await Promise.all([loadArt(), loadTrack()]);
  const track = buildTrack(def);

  const host = document.getElementById('game')!;
  const stage = document.createElement('div');
  stage.className = 'stage';
  host.appendChild(stage);
  const canvas = document.createElement('canvas');
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const lights = new Lights(stage);

  const layout = () => {
    const k = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    stage.style.width = `${Math.floor(VIEW_W * k)}px`;
    stage.style.height = `${Math.floor(VIEW_H * k)}px`;
  };
  window.addEventListener('resize', layout);
  layout();

  const input = new Input();
  const race = new Race(track);
  const road = new RoadRenderer(track.segments, track.length, art);

  const STEP = 1 / 60;
  let acc = 0;
  let last = performance.now();
  let clock = 0;
  const frame = (now: number) => {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      race.update(STEP, input.s);
      input.consume();
      acc -= STEP;
      clock += STEP;
    }
    const shake = cameraShake(race, clock);
    const glows = road.render(ctx, race.state, { shakeX: shake.x, shakeY: shake.y });
    const hudGlows = drawHud(ctx, art, race, input.s.muted);
    lights.draw(glows, hudGlows);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void main();
