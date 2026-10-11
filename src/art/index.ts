import type { ArtBundle, CarSprites, PropKind, SpriteArt } from '../contracts';
import { buildRivalCars } from './cars';
import { makeCanvas } from './canvas';
import { buildProps } from './props';
import { hills, sky } from './sky';

// ADAPTAÇÃO MÍNIMA (v1 -> contrato v2); será sobrescrita pelo PR feat/cenario-dia.
const pose = (s: SpriteArt): CarSprites => ({ left: s, center: s, right: s });
const empty = (w: number, h: number) => makeCanvas(w, h).canvas;
function simple(w: number, h: number, color: string, worldWidth: number): SpriteArt {
  const { canvas, p } = makeCanvas(w, h);
  p.rect(0, 0, w, h, color);
  return { canvas, worldWidth };
}

/** Gera toda a arte procedural. Chamada uma vez no boot; os canvases são reutilizados. */
export function buildArt(): ArtBundle {
  const rivals = buildRivalCars();
  const extra = {
    bush: simple(20, 10, '#3f9a4a', 260),
    fence: simple(40, 12, '#8a97a8', 700),
    flag: simple(6, 40, '#2fae4a', 160),
    tvtower: simple(10, 48, '#c8d2e0', 200),
  };
  const props: Record<PropKind, SpriteArt> = { ...buildProps(), ...extra };
  return {
    props,
    playerCar: pose(rivals[0]),
    rivalCars: rivals.map(pose),
    sky: sky(),
    clouds: empty(960, 140),
    mountains: empty(960, 90),
    hills: hills(),
    road: {
      asphaltLight: '#6b7280', asphaltDark: '#616775',
      grassLight: '#3fa34d', grassDark: '#379345',
      shoulderLight: '#c9b27a', shoulderDark: '#bda46c',
      kerbA: '#d92b2b', kerbB: '#f4f4f4',
      lane: '#f4f4f4',
      fog: '#bfe3f5',
    },
  };
}
