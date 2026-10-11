/* ==========================================================================
   Autódromo José Carlos Pace (Interlagos), traçado atual: 4,309 km,
   15 curvas, anti-horário. Fonte: Wikipedia pt/en (2026-10-10).
   Comprimentos e desníveis por trecho são ESTIMADOS (≈6 m por segmento,
   relevo exagerado para dar drama). buildTrack fecha o relevo no fim.
   ========================================================================== */

import type { PropPlacement, TrackDef } from '../contracts';

const L = (kind: PropPlacement['kind'], offset: number): PropPlacement => ({ kind, offset });

const ARQUIBANCADA = [{ every: 10, place: [L('grandstand', -2.2), L('grandstand', 2.2)] }, { every: 14, place: [L('floodlight', -1.5)] }];
const MATA = [{ every: 6, place: [L('tree', -2.0), L('tree', 2.4)] }, { every: 17, place: [L('ipe', -1.8)] }];
const CURVA = [{ every: 5, place: [L('tyrewall', 1.4)] }, { every: 20, place: [L('marshal', 1.7)] }];
const PLACAS = [{ every: 12, place: [L('billboard', 1.6)] }];

export const interlagos: TrackDef = {
  name: 'Interlagos',
  startSegment: 0,
  sections: [
    { name: 'Reta dos Boxes', length: 60, curve: 0, hill: -300,
      props: [{ every: 8, place: [L('pitbuilding', -1.9)] }, ...ARQUIBANCADA.slice(0, 1).map((p) => ({ ...p, place: [L('grandstand', 2.2)] })), { every: 14, place: [L('floodlight', 1.5)] }] },
    { name: 'S do Senna', length: 20, curve: -5, hill: -250, props: [...CURVA, ...ARQUIBANCADA] },
    { name: 'S do Senna', length: 16, curve: 4, hill: -150, props: [...CURVA, { every: 10, place: [L('grandstand', -2.2)] }] },
    { name: 'Curva do Sol', length: 42, curve: -2.5, hill: -200, props: [...MATA, ...PLACAS] },
    { name: 'Reta Oposta', length: 108, curve: 0, hill: -350, props: [...MATA, ...PLACAS, { every: 30, place: [L('skyline', 3.2)] }] },
    { name: 'Descida do Lago', length: 30, curve: -4, hill: -300, props: [...CURVA, { every: 4, place: [L('lake', -2.6)] }] },
    { name: 'Descida do Lago', length: 20, curve: -3, hill: -100, props: [{ every: 4, place: [L('lake', -2.6)] }, ...MATA.slice(0, 1)] },
    { name: 'Reta do Lago', length: 33, curve: 0, hill: 250, props: MATA },
    { name: 'Ferradura', length: 42, curve: 3.5, hill: -200, props: [...CURVA, ...MATA] },
    { name: 'Laranjinha', length: 20, curve: 4.5, hill: 0, props: [...CURVA, { every: 9, place: [L('ipe', 2.0)] }] },
    { name: 'Pinheirinho', length: 25, curve: -5, hill: 50, props: [...CURVA, ...MATA] },
    { name: 'Bico de Pato', length: 15, curve: 6, hill: 0, props: [...CURVA, { every: 8, place: [L('grandstand', 2.4)] }] },
    { name: 'Mergulho', length: 33, curve: -3.5, hill: -250, props: [...CURVA, ...MATA] },
    { name: 'Junção', length: 20, curve: -5, hill: 0, props: [...CURVA, ...ARQUIBANCADA] },
    { name: 'Subida dos Boxes', length: 83, curve: -1.5, hill: 1400, props: [...ARQUIBANCADA, ...PLACAS] },
    { name: 'Arquibancadas', length: 42, curve: -1, hill: 400, props: [...ARQUIBANCADA, { every: 25, place: [L('skyline', -3.4)] }] },
    { name: 'Reta dos Boxes', length: 25, curve: 0, hill: 0, props: [{ every: 8, place: [L('pitbuilding', -1.9)] }, { every: 10, place: [L('grandstand', 2.2)] }] },
  ],
};
