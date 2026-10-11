import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './style.css';
import { VIEW_H, VIEW_W, type ArtBundle, type Soundtrack, type TrackDef } from './contracts';
import { MAX_SPEED } from './game/physics';
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
const audioMods = import.meta.glob('./audio/index.ts');

const noopSoundtrack = (): Soundtrack => ({
  start() {},
  setMuted() {},
  muted: false,
  setTrack() {},
  setEngine() {},
  sfx() {},
});

async function loadSoundtrack(): Promise<Soundtrack> {
  try {
    const load = audioMods['./audio/index.ts'];
    if (load) {
      const mod = (await load()) as { createSoundtrack?: () => Soundtrack };
      if (mod.createSoundtrack) return mod.createSoundtrack();
    }
  } catch (e) {
    console.warn('Trilha sonora indisponível, sem áudio', e);
  }
  return noopSoundtrack();
}

async function loadArt(): Promise<ArtBundle> {
  try {
    const load = artMods['./art/index.ts'];
    if (load) {
      const mod = (await load()) as { buildArt?: () => ArtBundle };
      if (mod.buildArt) return mod.buildArt();
    }
  } catch (e) {
    console.error('Falha ao montar a arte', e);
    throw e;
  }
  throw new Error('src/art/index.ts ausente');
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
  const [art, def, sound] = await Promise.all([loadArt(), loadTrack(), loadSoundtrack()]);
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

  const trackOf = (phase: string): 'menu' | 'race' | 'finish' => (phase === 'grid' ? 'menu' : phase === 'finished' ? 'finish' : 'race');
  let started = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && !started) {
      started = true;
      sound.start();
      sound.setTrack(trackOf(race.state.phase));
    }
  });

  let prevPhase = race.state.phase;
  let prevLights = 0;
  let prevLap = race.state.player.lap;
  let prevKerb = false;
  const events = () => {
    const st = race.state;
    if (st.phase !== prevPhase) {
      if (st.phase === 'racing') sound.sfx('go');
      if (trackOf(st.phase) !== trackOf(prevPhase)) sound.setTrack(trackOf(st.phase));
      prevPhase = st.phase;
      prevLap = st.player.lap;
    }
    if (race.lights > prevLights) sound.sfx('countdown');
    prevLights = race.lights;
    if (race.crashed) sound.sfx('crash');
    if (st.player.lap > prevLap && st.phase === 'racing') sound.sfx('lap');
    prevLap = st.player.lap;
    if (race.dyn.onKerb && !prevKerb) sound.sfx('kerb');
    prevKerb = race.dyn.onKerb;
  };

  const STEP = 1 / 60;
  let acc = 0;
  let last = performance.now();
  let clock = 0;
  const frame = (now: number) => {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      if (input.s.mutePressed) sound.setMuted(input.s.muted);
      race.update(STEP, input.s);
      input.consume();
      events();
      acc -= STEP;
      clock += STEP;
    }
    sound.setEngine(race.state.rpm, race.state.player.speed / MAX_SPEED);
    const shake = cameraShake(race, clock);
    const glows = road.render(ctx, race.state, {
      time: clock,
      shakeX: shake.x,
      shakeY: shake.y,
      steer: race.steer,
      onKerb: race.dyn.onKerb,
      offroad: race.dyn.offroad,
    });
    const hudGlows = drawHud(ctx, race, input.s.muted, clock);
    lights.draw(race.state.phase === 'grid' ? [] : glows, hudGlows);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void main();
