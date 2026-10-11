import type { ArtBundle } from '../contracts';
import { buildRivalCars } from './cars';
import { cockpit, WHEEL_DISPLAY, wheel } from './cockpit';
import { buildProps } from './props';
import { hills, sky } from './sky';

/** Gera toda a arte procedural. Chamada uma vez no boot; os canvases são reutilizados. */
export function buildArt(): ArtBundle {
  return {
    props: buildProps(),
    rivalCars: buildRivalCars(),
    sky: sky(),
    hills: hills(),
    cockpit: cockpit(),
    wheel: wheel(),
    wheelDisplay: { ...WHEEL_DISPLAY },
  };
}
