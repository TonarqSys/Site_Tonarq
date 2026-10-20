/**
 * Medidas compartilhadas entre geradores, shader, câmera e testes.
 *
 * Referencial único da sequência estrada → túnel → galáxia (FRAME): uma
 * centerline, um forward e um up. Estrada, dobra, câmera e galáxia derivam
 * suas posições daqui; nenhuma delas tem eixo próprio.
 */

/** Meia largura da estrada. Constante: a dobra exige bordas paralelas. */
export const ROAD_HALF_WIDTH = 4.2;
/** Altura base da pista. */
export const ROAD_BASE_Y = -0.55;
/** Extensão em Z: NEAR fica atrás da câmera, FAR é a ponta final do túnel. */
export const ROAD_NEAR_Z = 6;
export const ROAD_FAR_Z = -34;
export const ROAD_LENGTH = ROAD_NEAR_Z - ROAD_FAR_Z;

/**
 * Raio do túnel quando a dobra fecha (fold = 1). Preserva o comprimento do
 * arco: a largura total (2W) vira a circunferência (2πR), logo R = W / π.
 * Constante ao longo de todo o comprimento: é um cilindro, não um cone.
 */
export const TUNNEL_RADIUS = ROAD_HALF_WIDTH / Math.PI;
/** Eixo do túnel: a pista dobra para cima, então o eixo fica a R da base. */
export const TUNNEL_AXIS_Y = ROAD_BASE_Y + TUNNEL_RADIUS;

/** Referencial compartilhado: centerline em (0, TUNNEL_AXIS_Y, z), forward -Z. */
export const FRAME = {
  forward: [0, 0, -1] as const,
  up: [0, 1, 0] as const,
  right: [1, 0, 0] as const,
  axisX: 0,
  axisY: TUNNEL_AXIS_Y,
} as const;

/** Ponto da centerline numa profundidade z. */
export function centerlinePoint(z: number): [number, number, number] {
  return [FRAME.axisX, FRAME.axisY, z];
}

/** Ponta final do cilindro: a galáxia nasce exatamente aqui. */
export const TUNNEL_TIP_Z = ROAD_FAR_Z;
export const GALAXY_CENTER: readonly [number, number, number] = centerlinePoint(TUNNEL_TIP_Z);

/**
 * Galáxia procedural, calculada no shader a partir da posição de cada
 * partícula no túnel: profundidade → raio (ponta = núcleo, entrada = halo),
 * ângulo no tubo → braço. Mesmos números no espelho em TypeScript.
 */
export const GALAXY = {
  radius: 5.2,
  /** Fração das partículas (por profundidade) que forma o bojo. */
  coreShare: 0.2,
  /** Raio normalizado do bojo. */
  coreFraction: 0.16,
  /** Expoente do perfil radial do bojo: abaixo de 1 a densidade não tem cúspide no centro. */
  coreProfile: 0.7,
  /** Fração final (por profundidade) que forma o halo, fora do plano. */
  haloShare: 0.1,
  /** Fração de todas as partículas nos braços; o resto do disco é difuso. */
  armShare: 0.55,
  arms: 3,
  /** Dispersão angular dos braços (rad): base e crescimento com o raio. */
  armScatter: 0.14,
  armScatterSlope: 0.35,
  /** Caudas exponenciais (em raio normalizado): borda do disco e halo. */
  discTail: 0.07,
  haloBase: 0.3,
  haloTail: 0.35,
  haloMax: 1.7,
  /** Radianos de enrolamento por unidade de raio normalizado. */
  twist: 5.2,
  /** Inclinação do plano galáctico em relação à linha de visão. */
  tilt: (30 * Math.PI) / 180,
  /** Rotação diferencial, rad/s: centro mais rápido que a borda. */
  spinInner: 0.08,
  spinOuter: 0.025,
  /** Variação vertical lenta, em raio normalizado. */
  breathe: 0.012,
  /** Largura (em rank radial) da faixa de partículas em voo durante o nascimento. */
  releaseBand: 0.25,
  /** Alpha base das partículas galácticas. */
  alpha: 0.85,
} as const;
export const GALAXY_RADIUS = GALAXY.radius;
export const GALAXY_CORE_FRACTION = GALAXY.coreFraction;

/**
 * Base ortonormal do plano galáctico, fixa: U = direita, W = "para o fundo"
 * no plano inclinado, N = normal. Olhando ao longo de -Z, o plano aparece
 * em perspectiva oblíqua de `tilt` graus, sem nenhuma rotação depois.
 */
export const GALAXY_BASIS = {
  u: [1, 0, 0] as const,
  w: [0, Math.sin(GALAXY.tilt), -Math.cos(GALAXY.tilt)] as const,
  n: [0, Math.cos(GALAXY.tilt), Math.sin(GALAXY.tilt)] as const,
} as const;

/** Campo de visão vertical da câmera, em graus. Único lugar que o define. */
export const CAMERA_FOV = 48;

/** Altura visível a uma distância d da câmera. */
export function visibleHeightAt(distance: number): number {
  return 2 * distance * Math.tan((CAMERA_FOV * Math.PI) / 360);
}

/**
 * Quanto o cilindro deve exceder a viewport (nenhuma tampa visível) e quanto
 * da altura o DNA deve ocupar (inteiro, sem cortar as pontas).
 */
export const CYLINDER_OVERSHOOT = 1.45;
/** Fator de largura do cilindro: fino demais le como fio, nao como volume. */
export const CYLINDER_WIDTH = 1.6;
export const DNA_FILL = 0.9;

/** Giro do cilindro e do DNA em torno do próprio eixo, em rad/s (tempo, não scroll). */
export const SPIN = { cylinder: 0.1, dna: 0.14 } as const;

/**
 * Fluxo da orbe: correntes tangenciais lentas. Velocidades em unidades de
 * ruído por segundo; amplitude em unidades de mundo.
 */
export const ORB_FLOW = {
  speedBase: 0.07,
  speedSpread: 0.05,
  amplitude: 0.24,
  secondOctave: 0.55,
  secondSpeed: 0.11,
  /** Radianos de giro da direção por unidade de ruído: pequeno = corrente lisa, sem tremor. */
  turn: 3.0,
  /** Velocidade máxima admitida para uma partícula da orbe (u/s). */
  maxSpeed: 0.6,
} as const;

/** Turbulência durante os morphs: pouca, e lenta. */
export const TURBULENCE = 0.2;

/**
 * Fluxo longitudinal da estrada, dirigido pelo tempo do shader. Velocidade
 * em unidades de mundo por segundo; cada partícula anda um pouco diferente.
 */
export const ROAD_FLOW = {
  speed: 1.5,
  seedSpread: 0.3,
  laneBoost: 0.25,
  /** Ruído lateral: amplitude em mundo e frequência em rad/s. */
  lateral: 0.03,
  lateralRate: 0.35,
  /** Comprimento das rampas de alpha nas extremidades (reciclagem invisível). */
  fadeNear: 2.5,
  fadeFar: 3.0,
} as const;

/**
 * Enrolamento helicoidal das trilhas quando a estrada vira túnel (rad por
 * unidade de z): um quarto de volta ao longo do comprimento. Mais que isso,
 * visto de dentro ao longo do eixo, a hélice projeta como redemoinho.
 */
export const TUNNEL_TWIST = Math.PI / 2 / ROAD_LENGTH;

/** Profundidade em que a câmera está quando a travessia começa (dentro do túnel). */
export const TUNNEL_ENTER_Z = 2.0;
/**
 * Distância da câmera à ponta quando a travessia termina: a abertura final
 * ocupa cerca de dois terços da altura da tela, e dali a câmera só recua.
 */
export const TIP_DISTANCE = 4.5;
/** Distância em que o disco inteiro ocupa ~75% da altura da tela: fim do zoom out. */
export const GALAXY_REVEAL_DISTANCE = 15.8;

/**
 * Compensação de luminosidade por densidade: no bojo, onde muitas partículas
 * se sobrepõem, cada uma contribui menos e é desenhada menor. O tamanho em
 * pixels cai com a distância na mesma proporção que a área projetada, então
 * a cobertura do núcleo é quase constante e a atenuação varia pouco.
 */
export const CORE_ATTENUATION = {
  near: 0.35,
  far: 0.3,
  /** Raio normalizado até onde a atenuação se aplica. */
  radius: 0.45,
  /** Fator de tamanho das partículas no centro do bojo. */
  sizeCore: 0.6,
} as const;

/**
 * Halo e neblina em torno da superfície do túnel (relevo negativo = fora).
 * O halo também se espalha além das bordas da pista, com densidade caindo,
 * para a estrada não ter uma borda reta visível.
 */
export const ROAD_RELIEF = {
  haloShare: 0.14,
  haloDepth: 0.9,
  hazeShare: 0.05,
  hazeDepth: 0.4,
  haloSpread: 0.6,
} as const;

/**
 * Hipertúnel: o fluxo do túnel acelera até `peak` vezes a velocidade da
 * estrada, no meio da travessia, e desacelera até zero na ponta. Os riscos
 * (alongamento dos pontos pela velocidade projetada) só existem acima de
 * `streakStart` e ficam plenos a partir de `streakFull`.
 */
export const HYPER = {
  peak: 10,
  rise: 0.5,
  fallStart: 0.5,
  streakStart: 1.5,
  streakFull: 6,
  /** Janela de tempo (s) que o risco representa e comprimento máximo (px). */
  streakTime: 0.04,
  streakMax: 40,
} as const;

/** Giro lento do túnel em torno do próprio eixo (rad/s): o cilindro nunca congela. */
export const TUBE_SPIN = 0.04;

/** Raio da esfera envolvente do buffer: cobre a galáxia inteira, com halo. */
export const BOUNDING_RADIUS = Math.abs(ROAD_FAR_Z) + GALAXY.radius * GALAXY.haloMax + 4;
