/**
 * Timeline da narrativa.
 *
 * Um único lugar decide, para cada progresso de scroll (0..1), quanto cada
 * transformação avançou. Shader, câmera e texto leem daqui. Tudo é função
 * pura do progresso: o mesmo valor produz sempre a mesma amostra, em
 * qualquer sentido de rolagem.
 *
 * Toda rampa usa smootherstep: velocidade e aceleração nulas nas pontas,
 * então uma transformação começa exatamente onde a anterior parou, sem
 * mudança brusca de velocidade.
 */
import { smootherstep, smoothstep } from "@/lib/particles/kinematics";
import { HYPER } from "@/lib/particles/sceneConfig";

export const STAGE_IDS = [
  "orbe",
  "cilindro",
  "dna",
  "estrada",
  "tunel",
  "galaxia",
] as const;

export type StageId = (typeof STAGE_IDS)[number];
export const STAGE_COUNT = STAGE_IDS.length;

/** Intervalos das transformações. */
export const TRANSITIONS = {
  orbToCylinder: [0.07, 0.19],
  cylinderToDna: [0.26, 0.38],
  dnaToRoad: [0.47, 0.57],
  fold: [0.63, 0.73],
  /**
   * Nascimento da galáxia: começa só depois de o cilindro estar completo e
   * de a câmera ter atravessado até a ponta. A ponta vira o núcleo e as
   * partículas saem do túnel de dentro para fora, durante o único zoom out.
   */
  galaxyFormation: [0.83, 0.95],
} as const;

/** Efeitos que acompanham a narrativa. */
export const EFFECTS = {
  orbFlow: { fadeOut: [0.07, 0.19] },
  bands: { fadeIn: [0.09, 0.2], fadeOut: [0.47, 0.55] },
  /** Hipertúnel: travessia axial pela centerline, galáxia ainda inexistente. */
  traverse: [0.73, 0.83],
  /** A ponta vira núcleo com a câmera parada; só depois o afastamento. */
  tipToCore: [0.83, 0.86],
  /** Único zoom out: apenas afastamento, alvo fixo no núcleo. */
  galaxyZoom: [0.86, 0.95],
  galaxyHold: [0.95, 1.0],
} as const;

/**
 * Janela de visibilidade do texto de cada estágio:
 * [começa a entrar, totalmente visível, começa a sair, sumiu].
 * Entra quando a forma termina de se formar; sai quando o próximo morph
 * começa de verdade.
 */
export const TEXT_WINDOWS: readonly (readonly [number, number, number, number])[] = [
  [-1, 0, 0.07, 0.13],
  [0.15, 0.2, 0.26, 0.31],
  [0.34, 0.39, 0.47, 0.52],
  [0.54, 0.58, 0.63, 0.68],
  [0.7, 0.735, 0.76, 0.8],
  [0.95, 0.975, 2, 3],
];

/**
 * Progresso em que o bloco de texto de cada estágio deve estar centrado na
 * tela: o meio da retenção. A seção é posicionada no container a partir
 * disto, então texto e forma estável coincidem por construção.
 */
export const TEXT_CENTERS: readonly number[] = [0, 0.225, 0.425, 0.6, 0.745, 0.98];

/** Altura total da narrativa, em vh. */
export const NARRATIVE_VH = 640;

/**
 * Onde (em vh, dentro do container) o topo da seção de um estágio fica para
 * que seu centro cruze o meio da viewport no progresso desejado.
 * scrollY = p * (altura - 100vh); a seção tem 100vh e o texto no centro.
 */
export function stageSectionTopVh(index: number): number {
  return TEXT_CENTERS[index] * (NARRATIVE_VH - 100);
}

/** 0 antes de `a`, 1 depois de `b`, smootherstep entre os dois. */
export function ramp(p: number, [a, b]: readonly [number, number]): number {
  if (b <= a) return p >= b ? 1 : 0;
  return smootherstep((p - a) / (b - a));
}

function plateau(
  p: number,
  fadeIn: readonly [number, number],
  fadeOut: readonly [number, number],
): number {
  return ramp(p, fadeIn) * (1 - ramp(p, fadeOut));
}

export interface TimelineSample {
  orbToCylinder: number;
  cylinderToDna: number;
  dnaToRoad: number;
  fold: number;
  /** Progresso do nascimento da galáxia: 0 até o cilindro completo e atravessado. */
  galaxyFormation: number;
  /** Igual a galaxyFormation: zoom out e nascimento são um só movimento. */
  galaxyZoom: number;
  /** Travessia do túnel: 0 entrada, 1 ponta. */
  traverse: number;
  orbFlow: number;
  bands: number;
  /**
   * Taxa do fluxo longitudinal, em múltiplos da velocidade da estrada. Nunca
   * é zero enquanto a estrada existe: sobe com a formação, vale 1 na estrada
   * e na dobra, dispara no hipertúnel e só chega a zero na ponta.
   */
  flowRate: number;
  /** Alongamento dos pontos em riscos: só no hipertúnel. */
  streak: number;
  /** Peso do fade das pontas da estrada: existe só enquanto há reciclagem. */
  roadFade: number;
  /** Turbulência: só durante os morphs de forma, nula nos dois extremos. */
  turbulence: number;
}

/** Escreve no objeto recebido: nada é alocado por frame. */
export function sampleTimeline(p: number, out: TimelineSample): TimelineSample {
  out.orbToCylinder = ramp(p, TRANSITIONS.orbToCylinder);
  out.cylinderToDna = ramp(p, TRANSITIONS.cylinderToDna);
  out.dnaToRoad = ramp(p, TRANSITIONS.dnaToRoad);
  out.fold = ramp(p, TRANSITIONS.fold);
  out.galaxyFormation = releaseProgress(p);
  out.galaxyZoom = ramp(p, EFFECTS.galaxyZoom);
  out.traverse = ramp(p, EFFECTS.traverse);

  out.orbFlow = 1 - ramp(p, EFFECTS.orbFlow.fadeOut);
  out.bands = plateau(p, EFFECTS.bands.fadeIn, EFFECTS.bands.fadeOut);
  out.flowRate = flowRate(p);
  out.streak = streakFactor(out.flowRate);
  out.roadFade = smootherstep(2 * out.dnaToRoad) * smoothstep(0, 1.0, out.flowRate);

  // sin(pi*t) é zero nos dois extremos de cada morph.
  let turbulence = 0;
  for (const m of [out.orbToCylinder, out.cylinderToDna, out.dnaToRoad]) {
    turbulence += Math.sin(m * Math.PI);
  }
  out.turbulence = Math.min(1, turbulence);
  return out;
}

export function emptySample(): TimelineSample {
  return {
    orbToCylinder: 0,
    cylinderToDna: 0,
    dnaToRoad: 0,
    fold: 0,
    galaxyFormation: 0,
    galaxyZoom: 0,
    traverse: 0,
    orbFlow: 1,
    bands: 0,
    flowRate: 0,
    streak: 0,
    roadFade: 0,
    turbulence: 0,
  };
}

/** Fração da liberação (bojo inteiro) concluída quando a câmera começa a recuar. */
export const TIP_TO_CORE_RELEASE = 0.36;

/**
 * Progresso do nascimento da galáxia: a ponta vira núcleo e bojo com a
 * câmera parada (tipToCore), e o resto nasce durante o zoom out. Duas
 * rampas smootherstep encadeadas: velocidade nula na junção.
 */
export function releaseProgress(p: number): number {
  const core = ramp(p, EFFECTS.tipToCore) * TIP_TO_CORE_RELEASE;
  const rest = ramp(p, EFFECTS.galaxyZoom) * (1 - TIP_TO_CORE_RELEASE);
  return core + rest;
}

/**
 * Taxa do fluxo longitudinal (múltiplos da velocidade da estrada), função
 * pura do progresso. O tempo é quem anda; o progresso só escolhe a taxa.
 */
export function flowRate(p: number): number {
  const forming = ramp(p, TRANSITIONS.dnaToRoad);
  if (p <= TRANSITIONS.dnaToRoad[1]) return forming;
  const tau = ramp(p, EFFECTS.traverse);
  if (tau <= 0) return 1;
  const rise = smootherstep(tau / HYPER.rise);
  const fall = 1 - smootherstep((tau - HYPER.fallStart) / (1 - HYPER.fallStart));
  return (1 + (HYPER.peak - 1) * rise) * fall;
}

/** Fator dos riscos radiais: zero no fluxo normal, pleno em velocidade extrema. */
export function streakFactor(rate: number): number {
  return smoothstep(HYPER.streakStart, HYPER.streakFull, rate);
}

/** Estágio dominante no progresso: o último cuja janela de texto já abriu. */
export function stageAt(p: number): number {
  let stage = 0;
  for (let i = 1; i < TEXT_WINDOWS.length; i += 1) {
    if (p >= TEXT_WINDOWS[i][0]) stage = i;
  }
  return stage;
}

export function stageTextOpacity(index: number, p: number): number {
  const [inStart, inEnd, outStart, outEnd] = TEXT_WINDOWS[index];
  return plateau(p, [inStart, inEnd], [outStart, outEnd]);
}
