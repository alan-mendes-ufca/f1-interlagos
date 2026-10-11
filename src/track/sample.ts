import type { PropPlacement, TrackDef } from '../contracts';

const L = (kind: PropPlacement['kind'], o = -1.7): PropPlacement => ({ kind, offset: o });
const R = (kind: PropPlacement['kind'], o = 1.7): PropPlacement => ({ kind, offset: o });
const trees = [{ every: 3, place: [L('tree', -2.2), R('tree', 2.4)] }, { every: 11, place: [R('ipe', 1.9)] }];

/** Traçado provisório (~600 segmentos) para testes; o real vem de interlagos.ts. */
export const sampleTrack: TrackDef = {
  name: 'Circuito de Testes',
  startSegment: 0,
  sections: [
    { name: 'Reta dos Boxes', length: 80, curve: 0, hill: 0, props: [{ every: 8, place: [L('grandstand', -2.0), R('pitbuilding', 2.4)] }, { every: 20, place: [R('floodlight', 1.4)] }] },
    { name: 'Curva 1', length: 40, curve: 4, hill: -1500, props: [{ every: 6, place: [L('tyrewall', -1.4), R('billboard', 2.2)] }] },
    { name: 'Descida', length: 60, curve: -2, hill: -2500, props: trees },
    { name: 'Lago', length: 50, curve: 0, hill: 0, props: [{ every: 10, place: [L('lake', -2.6), R('marshal', 1.5)] }, ...trees] },
    { name: 'Esse', length: 70, curve: -5, hill: 1500, props: [{ every: 5, place: [R('tyrewall', 1.4), L('billboard', -2.2)] }] },
    { name: 'Esse 2', length: 50, curve: 4, hill: 1500, props: trees },
    { name: 'Subida', length: 70, curve: 0, hill: 4500, props: [{ every: 12, place: [L('floodlight', -1.4), R('skyline', 3.5)] }, ...trees] },
    { name: 'Laranjinha', length: 40, curve: 3, hill: -1500, props: [{ every: 4, place: [L('tyrewall', -1.4)] }] },
    { name: 'Descida Final', length: 70, curve: -1, hill: -3500, props: trees },
    { name: 'Junção', length: 70, curve: 5, hill: -1000, props: [{ every: 5, place: [R('tyrewall', 1.4), L('marshal', -1.5)] }] },
  ],
};
