import { mulberry32 } from "./random";
import { fitToRadius, permute, spatialOrder } from "./normalizeTargets";

export const HELIX_RADIUS = 3.2;

const HEIGHT = 5.2;
const CYL_RADIUS = 0.72;
const DNA_STRAND_RADIUS = 0.62;
const TURNS = 3.2;
const RUNGS_PER_TURN = 9;

/** Riscos helicoidais: dois principais e seis secundários. */
export const MAIN_STREAKS = 2;
export const SECONDARY_STREAKS = 6;
export const STREAK_COUNT = MAIN_STREAKS + SECONDARY_STREAKS;
const MAIN_INTENSITY = 1.0;
const SECONDARY_INTENSITY = 0.55;
/** Fração das partículas que são risco no cilindro e haste no DNA. */
const BAND_SHARE = 0.46;

export interface HelixShapes {
  cylinder: Float32Array;
  dna: Float32Array;
  /** Intensidade do risco: 1 principal, ~0.55 secundário, 0 corpo/degrau. */
  band: Float32Array;
  /** Fase 0..1 ao longo do risco, deslocada por risco. */
  phase: Float32Array;
  /** Altura da geometria antes do esticamento, para o shader calibrar. */
  height: number;
}

/**
 * Cilindro e DNA gerados juntos, da mesma parametrização.
 *
 * A partícula que é risco luminoso no cilindro é a MESMA que vira haste da
 * hélice; a que compõe o corpo vira degrau. Os riscos secundários convergem
 * nas duas hastes (risco j → haste j mod 2), então a transformação lê como
 * reorganização das correntes, não como troca de objeto.
 *
 * Uma permutação só, do cilindro, aplicada a tudo: preserva os papéis.
 */
export function createHelixShapes(count: number, seed = 2): HelixShapes {
  const rand = mulberry32(seed);
  const cylinder = new Float32Array(count * 3);
  const dna = new Float32Array(count * 3);
  const band = new Float32Array(count);
  const phase = new Float32Array(count);
  const totalRungs = Math.round(TURNS * RUNGS_PER_TURN);

  for (let i = 0; i < count; i += 1) {
    const t = rand();
    const y = (t - 0.5) * HEIGHT;
    const isBand = rand() < BAND_SHARE;

    if (isBand) {
      // Principais recebem mais particulas que cada secundario.
      const pick = rand();
      const streak = pick < 0.5
        ? Math.floor(rand() * MAIN_STREAKS)
        : MAIN_STREAKS + Math.floor(rand() * SECONDARY_STREAKS);
      const isMain = streak < MAIN_STREAKS;
      band[i] = isMain ? MAIN_INTENSITY : SECONDARY_INTENSITY;
      // Fase deslocada por risco: pulsos com tempos diferentes.
      phase[i] = t + streak * 0.137;

      // Cada risco tem enrolamento proprio no cilindro: vortex, nao faixas.
      const twist = isMain ? 0.9 : 0.6 + (streak % 3) * 0.35;
      const base = (streak / STREAK_COUNT) * Math.PI * 2;
      const cylAngle = base + t * Math.PI * 2 * twist + (rand() - 0.5) * 0.16;
      const cylR = CYL_RADIUS * (1 + (rand() - 0.5) * 0.05);
      cylinder[i * 3] = Math.cos(cylAngle) * cylR;
      cylinder[i * 3 + 1] = y;
      cylinder[i * 3 + 2] = Math.sin(cylAngle) * cylR;

      // DNA: o risco converge na haste (streak mod 2), com muito mais volta.
      const strand = streak % 2;
      const dnaAngle = strand * Math.PI + t * Math.PI * 2 * TURNS;
      const jitter = isMain ? 0.022 : 0.04;
      dna[i * 3] = Math.cos(dnaAngle) * DNA_STRAND_RADIUS + (rand() - 0.5) * jitter;
      dna[i * 3 + 1] = y + (rand() - 0.5) * jitter;
      dna[i * 3 + 2] = Math.sin(dnaAngle) * DNA_STRAND_RADIUS + (rand() - 0.5) * jitter;
      continue;
    }

    band[i] = 0;
    phase[i] = t;

    // Corpo do cilindro: superficie com um pouco de volume para dentro.
    const angle = rand() * Math.PI * 2;
    const depth = 1 - Math.pow(rand(), 2.2) * 0.35;
    cylinder[i * 3] = Math.cos(angle) * CYL_RADIUS * depth;
    cylinder[i * 3 + 1] = y;
    cylinder[i * 3 + 2] = Math.sin(angle) * CYL_RADIUS * depth;

    // Degrau do DNA: passo discreto, atravessando de uma haste a outra.
    const step = Math.floor(t * totalRungs) / totalRungs;
    const rungAngle = step * Math.PI * 2 * TURNS;
    const rungY = (step - 0.5) * HEIGHT;
    const across = rand() * 2 - 1;
    const jitter = 0.018;
    dna[i * 3] = Math.cos(rungAngle) * DNA_STRAND_RADIUS * across + (rand() - 0.5) * jitter;
    dna[i * 3 + 1] = rungY + (rand() - 0.5) * jitter;
    dna[i * 3 + 2] = Math.sin(rungAngle) * DNA_STRAND_RADIUS * across + (rand() - 0.5) * jitter;
  }

  const scale = HELIX_RADIUS / Math.hypot(HEIGHT / 2, CYL_RADIUS);
  fitToRadius(cylinder, HELIX_RADIUS);
  fitToRadius(dna, HELIX_RADIUS);

  const order = spatialOrder(cylinder);
  return {
    cylinder: permute(cylinder, order, 3),
    dna: permute(dna, order, 3),
    band: permute(band, order, 1),
    phase: permute(phase, order, 1),
    height: HEIGHT * scale,
  };
}
