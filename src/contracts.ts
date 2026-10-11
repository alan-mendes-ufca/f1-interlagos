/* ==========================================================================
   F1 Interlagos: contratos compartilhados entre módulos.
   Escrito pelo agente principal. Workers NÃO alteram este arquivo; se um
   contrato precisar mudar, relatem a necessidade no retorno.

   v2: câmera em 3ª pessoa atrás do carro (estilo 80's Overdrive/Horizon
   Chase), dia ensolarado, trilha synthwave chiptune.
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
  | 'skyline'         // prédios de São Paulo próximos
  | 'bush'            // arbusto arredondado baixo
  | 'fence'           // alambrado de proteção
  | 'flag'            // mastro com bandeira do Brasil tremulando
  | 'tvtower';        // torre de câmera de TV

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

/** Cores da estrada/terreno; o renderizador alterna claro/escuro por faixa de segmentos. */
export interface RoadPalette {
  asphaltLight: string; asphaltDark: string;
  grassLight: string; grassDark: string;
  /** Faixa de terreno logo após a zebra (ex.: área de escape/terra). */
  shoulderLight: string; shoulderDark: string;
  kerbA: string; kerbB: string;
  /** Linhas de pista (bordas brancas e faixas tracejadas). */
  lane: string;
  /** Neblina/atmosfera de distância (céu perto do horizonte). */
  fog: string;
}

/** Carro de F1 visto de trás em 3 poses de esterço. */
export interface CarSprites {
  left: SpriteArt;
  center: SpriteArt;
  right: SpriteArt;
}

export interface ArtBundle {
  props: Record<PropKind, SpriteArt>;
  /** Carro do jogador (carmim/ciano, maior detalhe), desenhado fixo na parte
   *  inferior central da tela; canvas ~112x56. */
  playerCar: CarSprites;
  /** 5 rivais de escuderias fictícias, mesmas 3 poses; canvas ~112x56 (escalados em runtime). */
  rivalCars: CarSprites[];
  /** Camadas de fundo, todas com largura 960 (parallax horizontal, repetem). */
  sky: HTMLCanvasElement;        // 960x270: gradiente diurno + sol com raios (opaco)
  clouds: HTMLCanvasElement;     // 960x~140: nuvens volumosas (transparente)
  mountains: HTMLCanvasElement;  // 960x~90: serra distante azulada (transparente)
  hills: HTMLCanvasElement;      // 960x~80: morros verdes + skyline de SP (transparente)
  road: RoadPalette;
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

// --------------------------------------------------------------------------
// Áudio (src/audio/*)
// --------------------------------------------------------------------------

/** Implementado em src/audio/index.ts como `createSoundtrack(): Soundtrack`.
 *  Web Audio sintetizado em runtime, sem arquivos de som. */
export interface Soundtrack {
  /** Inicia o AudioContext (precisa de gesto do usuário) e a música. Idempotente. */
  start(): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
  /** 'menu' = faixa calma; 'race' = faixa da corrida; 'finish' = vinheta curta. */
  setTrack(track: 'menu' | 'race' | 'finish'): void;
  /** Ronco do motor por frame: rpm 0..1, speed 0..1. */
  setEngine(rpm: number, speed: number): void;
  /** Efeitos curtos. */
  sfx(name: 'countdown' | 'go' | 'crash' | 'lap' | 'kerb'): void;
}
