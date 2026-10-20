/**
 * Espelhos em TypeScript das fórmulas do vertex shader.
 *
 * O shader continua sendo quem executa; estas funções existem para os testes
 * medirem o mesmo movimento (fluxo da estrada, dobra, hipertúnel, nascimento
 * da galáxia, fluxo da orbe) sem GPU. Constantes vêm de sceneConfig, que o
 * shader também lê: um valor só.
 */
import { flowField } from "./noise";
import { ORB_MAJOR_WORLD } from "./orb";
import {
  CORE_ATTENUATION,
  GALAXY,
  GALAXY_BASIS,
  GALAXY_CENTER,
  GALAXY_REVEAL_DISTANCE,
  HYPER,
  ORB_FLOW,
  ROAD_BASE_Y,
  ROAD_FAR_Z,
  ROAD_FLOW,
  ROAD_HALF_WIDTH,
  ROAD_LENGTH,
  ROAD_NEAR_Z,
  TIP_DISTANCE,
  TUBE_SPIN,
  TUNNEL_ENTER_Z,
  TUNNEL_TIP_Z,
  TUNNEL_TWIST,
  visibleHeightAt,
} from "./sceneConfig";

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 6t^5 - 15t^4 + 10t^3: velocidade e aceleração nulas nas pontas. */
export function smootherstep(t: number): number {
  const c = clamp01(t);
  return c * c * c * (c * (c * 6 - 15) + 10);
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

const fract = (v: number) => v - Math.floor(v);
const TWO_PI = Math.PI * 2;

/** Velocidade longitudinal de uma partícula (u/s) com taxa 1: varia por seed e por faixa. */
export function roadFlowSpeed(seed: number, lane: number): number {
  return (
    ROAD_FLOW.speed *
    (1 - ROAD_FLOW.seedSpread / 2 + ROAD_FLOW.seedSpread * seed) *
    (1 + lane * ROAD_FLOW.laneBoost)
  );
}

/**
 * Posição longitudinal com fluxo e reciclagem: anda para -Z e volta ao
 * início. `flowTime` é o tempo integrado pela taxa do estágio.
 */
export function roadFlowZ(z0: number, seed: number, lane: number, flowTime: number): number {
  const d0 = (ROAD_NEAR_Z - z0) / ROAD_LENGTH;
  const d = fract(d0 + (flowTime * roadFlowSpeed(seed, lane)) / ROAD_LENGTH);
  return ROAD_NEAR_Z - d * ROAD_LENGTH;
}

/** Ruído lateral discreto: oscilação lenta, sem componente longitudinal. */
export function roadLateralOffset(seed: number, time: number): number {
  return ROAD_FLOW.lateral * Math.sin(time * ROAD_FLOW.lateralRate + seed * 6.2831853);
}

/** Alpha nas extremidades: zero exatamente onde a partícula é reciclada. */
export function roadEndFade(z: number): number {
  return (
    smoothstep(0, ROAD_FLOW.fadeNear, ROAD_NEAR_Z - z) *
    smoothstep(0, ROAD_FLOW.fadeFar, z - ROAD_FAR_Z)
  );
}

/** Enrolamento das trilhas: só aparece com o tubo quase fechado. */
export function tunnelTwist(fold: number): number {
  return TUNNEL_TWIST * smoothstep(0.7, 1.0, fold);
}

/** Giro lento do tubo pelo tempo, com o mesmo peso do enrolamento. */
export function tubeSpin(time: number, fold: number): number {
  return time * TUBE_SPIN * smoothstep(0.7, 1.0, fold);
}

/**
 * Dobra da estrada em túnel, preservando o comprimento do arco. O relevo
 * (y - base) é aplicado ao longo da normal: positivo para dentro do tubo,
 * negativo para fora (halo). A coordenada longitudinal z não muda. Pontos
 * além das bordas (halo lateral) continuam o arco em vez de serem cortados.
 */
export function foldRoadPoint(x: number, y: number, z: number, fold: number, time = 0): Vec3 {
  const nx = x / (2 * ROAD_HALF_WIDTH);
  const ff = Math.max(fold, 0.002);
  const angle = nx * TWO_PI * ff + z * tunnelTwist(fold) + tubeSpin(time, fold);
  const R = ROAD_HALF_WIDTH / (Math.PI * ff);
  const r = R - (y - ROAD_BASE_Y);
  return [r * Math.sin(angle), ROAD_BASE_Y + R - r * Math.cos(angle), z];
}

/** Profundidade no túnel: 0 na entrada, 1 na ponta final. */
export function tubeDepth(z: number): number {
  return (ROAD_NEAR_Z - z) / ROAD_LENGTH;
}

/** Ângulo no tubo fechado, normalizado 0..1 (enrolamento incluído, giro não). */
export function tubeAngle01(x: number, z: number): number {
  const nx = x / (2 * ROAD_HALF_WIDTH);
  return fract(nx + (z * TUNNEL_TWIST) / TWO_PI);
}

/** Profundidade da câmera ao longo da travessia (τ = 0 entrada, 1 ponta). */
export function traversalCameraZ(tau: number): number {
  const end = TUNNEL_TIP_Z + TIP_DISTANCE;
  return TUNNEL_ENTER_Z + (end - TUNNEL_ENTER_Z) * tau;
}

/** Distância câmera → núcleo durante o zoom out (g linear 0..1): só cresce. */
export function cameraDistanceFromCore(g: number): number {
  return TIP_DISTANCE + (GALAXY_REVEAL_DISTANCE - TIP_DISTANCE) * smootherstep(g);
}

/**
 * Comprimento do risco (px) de uma partícula do hipertúnel: velocidade
 * projetada na tela vezes a janela de tempo. Um ponto a `screenPx` do ponto
 * de fuga, a `depth` da câmera, andando a `speed` u/s pelo eixo, desliza
 * na tela a screenPx * speed / depth px/s.
 */
export function streakLengthPx(screenPx: number, depth: number, speed: number, pixelRatio = 1): number {
  const px = (screenPx * speed) / Math.max(depth, 0.5) * HYPER.streakTime;
  return Math.min(px, HYPER.streakMax * pixelRatio);
}

/**
 * Rank radial de uma partícula: 0 na ponta do túnel (vira o centro do
 * núcleo), 1 na entrada (vira o halo). Liberar por rank é liberar de dentro
 * para fora: núcleo, bojo, disco/braços e por último o halo.
 */
export function galaxyRank(depth: number): number {
  return clamp01(1 - depth);
}

/** Peso 0..1 de uma partícula no nascimento, dado o progresso g da galáxia. */
export function releaseWeight(rank: number, g: number): number {
  const band = GALAXY.releaseBand;
  return smootherstep((g * (1 + band) - rank) / band);
}

/** Rank em que o halo começa: as últimas partículas a nascer. */
export const HALO_RANK = 1 - GALAXY.haloShare;
/** Fração das partículas do disco que fica nos braços. */
export const ARM_FRACTION = GALAXY.armShare / (HALO_RANK - GALAXY.coreShare);

export type GalaxyRegion = "bojo" | "disco" | "halo";

export function galaxyRegion(rank: number): GalaxyRegion {
  if (rank < GALAXY.coreShare) return "bojo";
  if (rank < HALO_RANK) return "disco";
  return "halo";
}

export interface GalaxyPoint {
  position: Vec3;
  /** Raio normalizado no plano (o halo e a cauda do disco passam de 1). */
  r: number;
  region: GalaxyRegion;
  /** 1 nos braços, 0 no disco difuso, bojo e halo. */
  arm: number;
}

/** Cauda exponencial: -ln(1 - u) com u em [0, cap). */
function expTail(u: number, cap: number): number {
  return -Math.log(1 - Math.min(u, cap));
}

/**
 * Posição galáctica de uma partícula a partir da sua posição no túnel:
 * profundidade → raio, ângulo no tubo → braço, hashes fixos → dispersão.
 * Bojo elipsoidal, braços apertados, disco difuso com cauda exponencial na
 * borda e halo esparso acima e abaixo do plano, também com cauda: a
 * densidade cai organicamente, sem borda. Nasce no plano inclinado fixo
 * (GALAXY_BASIS); o tempo só gira em torno da normal (rotação diferencial)
 * e respira levemente na vertical.
 */
export function galaxyFromTube(depth: number, angle01: number, h: Vec4, time: number): GalaxyPoint {
  const rank = galaxyRank(depth);
  const region = galaxyRegion(rank);
  const [h1, h2, h3, h4] = h;
  const h5 = fract((h1 + h4) * 4.7);
  let r: number;
  let height: number;
  let az: number;
  let arm = 0;

  if (region === "bojo") {
    const s = rank / GALAXY.coreShare;
    const rr = GALAXY.coreFraction * Math.pow(s, GALAXY.coreProfile);
    const theta = h1 * TWO_PI;
    const phi = Math.acos(h2 * 2 - 1);
    const x = Math.sin(phi) * Math.cos(theta) * rr;
    const z = Math.sin(phi) * Math.sin(theta) * rr;
    height = Math.cos(phi) * rr * 0.7;
    az = Math.atan2(z, x);
    r = Math.hypot(x, z);
  } else if (region === "disco") {
    const s = (rank - GALAXY.coreShare) / (HALO_RANK - GALAXY.coreShare);
    r = GALAXY.coreFraction + Math.pow(s, 1.4) * (1 - GALAXY.coreFraction);
    const thickness = 0.09 * Math.exp(-r * 3.2) + 0.008;
    if (h3 < ARM_FRACTION) {
      const which = Math.floor(angle01 * GALAXY.arms);
      az =
        (which / GALAXY.arms) * TWO_PI +
        r * GALAXY.twist +
        (h1 + h2 - 1) * 1.5 * (GALAXY.armScatter + r * GALAXY.armScatterSlope);
      arm = 1;
    } else {
      az = h1 * TWO_PI;
    }
    height = (h4 * 2 - 1) * thickness * 1.5;
    r += (h4 - 0.5) * 0.03 + expTail(h5, 0.995) * GALAXY.discTail * (1 - 0.4 * arm);
  } else {
    r = Math.min(GALAXY.haloBase + expTail(h1, 0.985) * GALAXY.haloTail, GALAXY.haloMax);
    az = h3 * TWO_PI;
    height = (h2 * 2 - 1) * 0.45 * r;
  }

  az += time * (GALAXY.spinOuter + (GALAXY.spinInner - GALAXY.spinOuter) * (1 - clamp01(r)));
  height += GALAXY.breathe * Math.sin(time * 0.2 + h2 * 6.2831853) * (0.2 + r);

  const R = GALAXY.radius;
  const lx = Math.cos(az) * r * R;
  const lz = Math.sin(az) * r * R;
  const ly = height * R;
  const { u, w, n } = GALAXY_BASIS;
  const [cx, cy, cz] = GALAXY_CENTER;
  return {
    position: [
      cx + lx * u[0] + lz * w[0] + ly * n[0],
      cy + lx * u[1] + lz * w[1] + ly * n[1],
      cz + lx * u[2] + lz * w[2] + ly * n[2],
    ],
    r,
    region,
    arm,
  };
}

/** Atenuação individual no bojo, pela distância da câmera ao núcleo. */
export function coreAttenuation(distance: number): number {
  const t = smoothstep(TIP_DISTANCE, GALAXY_REVEAL_DISTANCE, distance);
  return CORE_ATTENUATION.near + (CORE_ATTENUATION.far - CORE_ATTENUATION.near) * t;
}

/** Fator de alpha de uma partícula galáctica pelo raio (1 fora do bojo). */
export function galaxyAlphaFactor(r: number, distance: number): number {
  const t = smoothstep(0, CORE_ATTENUATION.radius, r);
  return coreAttenuation(distance) + (1 - coreAttenuation(distance)) * t;
}

/** Fator de tamanho de uma partícula galáctica pelo raio. */
export function galaxySizeFactor(r: number): number {
  const t = smoothstep(0, 0.3, r);
  return CORE_ATTENUATION.sizeCore + (1 - CORE_ATTENUATION.sizeCore) * t;
}

/**
 * Estimativa da cobertura aditiva (soma de alpha por pixel) no centro do
 * bojo: metade interna das partículas do bojo, com o tamanho e o alpha que
 * o shader usa. Acima de ~1 o centro satura em branco sólido.
 */
export function coreOverlapEstimate(
  count: number,
  distance: number,
  screenHeightPx: number,
  pointSizeBase = 3.4,
): number {
  const inner = count * GALAXY.coreShare * 0.5;
  const innerRadiusWorld = GALAXY.coreFraction * Math.pow(0.5, GALAXY.coreProfile) * GALAXY.radius;
  const pxPerUnit = screenHeightPx / visibleHeightAt(distance);
  const areaPx = Math.PI * Math.pow(innerRadiusWorld * pxPerUnit, 2);
  const meanScale = 0.65 + 0.25 * 1.7;
  const sizePx = Math.min(
    6.5,
    Math.max(0.9, (pointSizeBase * meanScale * galaxySizeFactor(0.05) * 7) / distance),
  );
  const meanFalloff = 0.45;
  const alpha = GALAXY.alpha * galaxyAlphaFactor(0.03, distance) * meanFalloff;
  return (inner * sizePx * sizePx * alpha) / areaPx;
}

export interface OrbFlowConfig {
  speedBase: number;
  speedSpread: number;
  amplitude: number;
  secondOctave: number;
  secondSpeed: number;
  turn: number;
}

/** Deslocamento tangencial de uma partícula da orbe: igual ao shader. */
export function orbFlowDisplacement(
  orb: Vec3,
  seed: number,
  time: number,
  cfg: OrbFlowConfig = ORB_FLOW,
): Vec3 {
  const rx = orb[0] + 1e-4;
  const ry = orb[1];
  const rl = Math.hypot(rx, ry);
  const ringPoint: Vec3 = [(rx / rl) * ORB_MAJOR_WORLD, (ry / rl) * ORB_MAJOR_WORLD, 0];
  const nv: Vec3 = [orb[0] - ringPoint[0], orb[1] - ringPoint[1], orb[2] - ringPoint[2] + 1e-4];
  const nl = Math.hypot(...nv);
  const n: Vec3 = [nv[0] / nl, nv[1] / nl, nv[2] / nl];

  const speed = cfg.speedBase + seed * cfg.speedSpread;
  const f1 = flowField(
    [orb[0] * 0.5 + time * speed, orb[1] * 0.5 + seed * 5, orb[2] * 0.5 - time * speed * 0.7],
    cfg.turn,
  );
  const f2 = flowField(
    [
      orb[0] * 1.7 - time * cfg.secondSpeed + seed * 9,
      orb[1] * 1.7 + seed * 9,
      orb[2] * 1.7 - time * cfg.secondSpeed * 0.7 + seed * 9,
    ],
    cfg.turn,
  );
  const flow: Vec3 = [
    f1[0] + cfg.secondOctave * f2[0],
    f1[1] + cfg.secondOctave * f2[1],
    f1[2] + cfg.secondOctave * f2[2],
  ];
  const along = flow[0] * n[0] + flow[1] * n[1] + flow[2] * n[2];
  return [
    (flow[0] - n[0] * along) * cfg.amplitude,
    (flow[1] - n[1] * along) * cfg.amplitude,
    (flow[2] - n[2] * along) * cfg.amplitude,
  ];
}
