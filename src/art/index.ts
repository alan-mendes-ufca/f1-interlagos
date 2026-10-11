import type { ArtBundle } from '../contracts';
import { buildPlayerCar, buildRivalCars } from './cars';
import { buildProps } from './props';
import { clouds, hills, mountains, ROAD, sky } from './sky';

/** Gera toda a arte procedural diurna. Chamada uma vez no boot; os canvases são reutilizados. */
export function buildArt(): ArtBundle {
  return {
    props: buildProps(),
    playerCar: buildPlayerCar(),
    rivalCars: buildRivalCars(),
    sky: sky(),
    clouds: clouds(),
    mountains: mountains(),
    hills: hills(),
    road: { ...ROAD },
  };
}
