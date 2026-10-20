import { createGalaxyHashes } from "./galaxy";
import { createHelixShapes } from "./helix";
import { createOrb } from "./orb";
import { createRoad } from "./road";
import { mulberry32 } from "./random";

export { STAGE_IDS, type StageId } from "@/lib/motion/timeline";

export interface ParticleShapes {
  count: number;
  orb: Float32Array;
  cylinder: Float32Array;
  dna: Float32Array;
  road: Float32Array;
  seeds: Float32Array;
  scales: Float32Array;
  /** Intensidade de risco luminoso / haste da helice. */
  band: Float32Array;
  /** Fase ao longo do risco. */
  phase: Float32Array;
  /** 1 nas faixas e bordas da estrada. */
  lane: Float32Array;
  /** Quatro aleatorios fixos por particula, para a galaxia procedural. */
  galaxyHash: Float32Array;
  /** Altura da helice em unidades de mundo antes do esticamento. */
  helixHeight: number;
}

/**
 * Quatro formas armazenadas: tunel e galaxia nao sao formas. O tunel e a
 * estrada dobrada analiticamente no vertex shader; a galaxia nasce da
 * posicao de cada particula no tunel. Nenhum dos dois gasta atributo de
 * posicao nem perde a correspondencia particula a particula.
 */
export function buildShapes(count: number): ParticleShapes {
  const helix = createHelixShapes(count);
  const road = createRoad(count);
  const shapes = {
    orb: createOrb(count),
    cylinder: helix.cylinder,
    dna: helix.dna,
    road: road.positions,
  };

  for (const [name, target] of Object.entries(shapes)) {
    if (target.length !== count * 3) {
      throw new Error(`forma ${name} com contagem diferente quebra o morphing`);
    }
  }

  const rand = mulberry32(99);
  const seeds = new Float32Array(count);
  const scales = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    seeds[i] = rand();
    // Poucas particulas grandes, muitas pequenas: profundidade sem estourar.
    scales[i] = 0.65 + Math.pow(rand(), 3) * 1.7;
  }

  return {
    count,
    ...shapes,
    seeds,
    scales,
    band: helix.band,
    phase: helix.phase,
    lane: road.lane,
    galaxyHash: createGalaxyHashes(count),
    helixHeight: helix.height,
  };
}

/**
 * Quantidade adaptativa.
 *
 * O gargalo anterior estava no compositor (backdrop-filter e fundo fixo),
 * nao na GPU: um draw call com estas contagens roda a 60 fps em GPU
 * integrada. O governador de qualidade ainda corta por cima quando a taxa de
 * quadros cai de verdade.
 */
export const PARTICLE_BUDGET = {
  mobileWeak: 20000,
  mobile: 28000,
  desktopWeak: 32000,
  desktop: 56000,
  desktopStrong: 72000,
} as const;

export function resolveParticleCount(): number {
  if (typeof window === "undefined") return PARTICLE_BUDGET.desktop;

  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency ?? 4;
  const weak = (memory !== undefined && memory <= 4) || cores <= 4;

  if (isMobile) return weak ? PARTICLE_BUDGET.mobileWeak : PARTICLE_BUDGET.mobile;
  if (weak) return PARTICLE_BUDGET.desktopWeak;
  if (cores >= 12) return PARTICLE_BUDGET.desktopStrong;
  return PARTICLE_BUDGET.desktop;
}
