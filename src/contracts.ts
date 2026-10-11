/* ==========================================================================
   F1 Interlagos: contratos compartilhados entre módulos.
   Escrito pelo agente principal. Workers NÃO alteram este arquivo; se um
   contrato precisar mudar, relatem a necessidade no retorno.

   Arquitetura: pseudo-3D (estilo Top Gear/OutRun) em Canvas 2D puro, sem
   WebGL (o Chrome do usuário não tem WebGL). Resolução interna 480x270,
   ampliada com image-rendering: pixelated. Luz/brilho em canvas sobreposto.
   ========================================================================== */

export const VIEW_W = 480;
export const VIEW_H = 270;

/** Comprimento de um segmento de pista em unidades de mundo. */
export const SEGMENT_LENGTH = 200;
/** Meia largura da pista em unidades de mundo (offset x = ±1 é a borda). */
export const ROAD_WIDTH = 1800;

// --------------------------------------------------------------------------
// Pista (src/track/*)
// --------------------------------------------------------------------------

/** Tipos de objeto de beira de pista. Cada um tem sprite em src/art/sprites.ts. */
export type PropKind =
  | 'grandstand'      // arquibancada com público e luz âmbar
  | 'floodlight'      // torre de refletor (fonte de luz)
  | 'tree'            // árvore da mata paulista (sibipiruna, ipê)
  | 'ipe'             // ipê-amarelo florido (acento de cor)
  | 'billboard'       // placa de patrocínio genérica (sem marcas reais)
  | 'marshal'         // posto de fiscal com bandeira
  | 'tyrewall'        // barreira de pneus
  | 'pitbuilding'     // prédio dos boxes
  | 'lake'            // trecho do lago (Descida do Lago)
  | 'skyline';        // prédios de São Paulo com janelas acesas

export interface PropPlacement {
  kind: PropKind;
  /** Offset lateral em múltiplos da meia largura: -1.6 = esquerda fora da pista. */
  offset: number;
}

/** Trecho de pista descrito de forma compacta; expandido em segmentos. */
export interface TrackSection {
  /** Nome do trecho, ex.: "S do Senna", "Reta Oposta". */
  name: string;
  /** Número de segmentos do trecho. */
  length: number;
  /** Curvatura: negativo = esquerda, positivo = direita. Faixa útil -6..6. */
  curve: number;
  /** Variação de altura total do trecho em unidades de mundo (+ sobe, - desce). */
  hill: number;
  /** Objetos repetidos ao longo do trecho: a cada `every` segmentos. */
  props?: { every: number; place: PropPlacement[] }[];
}

export interface TrackDef {
  name: string;
  /** Sentido real: Interlagos é anti-horário. */
  sections: TrackSection[];
  /** Índice do segmento da linha de chegada (normalmente 0). */
  startSegment: number;
}

/** Segmento expandido, usado pelo renderizador. */
export interface Segment {
  index: number;
  curve: number;
  /** Altura y no início (p1) e no fim (p2). */
  y1: number;
  y2: number;
  sectionName: string;
  props: PropPlacement[];
  /** Zebras (kerbs) nas bordas, ativas em curvas. */
  kerb: boolean;
}

// --------------------------------------------------------------------------
// Arte procedural (src/art/*)
// --------------------------------------------------------------------------

/** Todas as artes são HTMLCanvasElement desenhados por código, pixel a pixel. */
export interface SpriteArt {
  canvas: HTMLCanvasElement;
  /** Largura em unidades de mundo quando o sprite está a escala 1. */
  worldWidth: number;
  /** Se emite luz, cor e raio (px na tela a escala 1) para o glowmap. */
  glow?: { color: string; radius: number; dy: number };
}

export interface ArtBundle {
  props: Record<PropKind, SpriteArt>;
  /** Carros rivais vistos de trás: 5 equipes fictícias, 3 tamanhos cada não são necessários (escala em runtime). */
  rivalCars: SpriteArt[];
  /** Céu de fundo (largura >= 2*VIEW_W para parallax), entardecer azul/ciano/carmim. */
  sky: HTMLCanvasElement;
  /** Morros e skyline distante (parallax), mesma largura do céu. */
  hills: HTMLCanvasElement;
  /** Cockpit em 1ª pessoa, VIEW_W x VIEW_H, com transparência no centro.
   *  Halo, laterais da carenagem e pneus dianteiros. */
  cockpit: HTMLCanvasElement;
  /** Volante (desenhado separado para girar). Display central em branco:
   *  o HUD escreve marcha/velocidade por cima nas coordenadas `wheelDisplay`. */
  wheel: HTMLCanvasElement;
  wheelDisplay: { x: number; y: number; w: number; h: number };
}

// --------------------------------------------------------------------------
// Estado de corrida (src/game/*)
// --------------------------------------------------------------------------

export interface CarState {
  /** Posição longitudinal em unidades de mundo (0..trackLength). */
  z: number;
  /** Offset lateral (-1..1 é a pista). */
  x: number;
  speed: number;
  lap: number;
  /** Para rivais: índice em ArtBundle.rivalCars. -1 = jogador. */
  sprite: number;
  name: string;
  finished: boolean;
}

export interface RaceState {
  player: CarState;
  rivals: CarState[];
  totalLaps: number;
  time: number;
  lapTimes: number[];
  bestLap: number | null;
  phase: 'grid' | 'countdown' | 'racing' | 'finished';
  /** Nome do trecho atual (mostrado no HUD). */
  sectionName: string;
  gear: number;
  rpm: number; // 0..1
}
