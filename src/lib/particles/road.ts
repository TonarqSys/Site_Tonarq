import { mulberry32 } from "./random";
import { permute, spatialOrder } from "./normalizeTargets";
import {
  ROAD_BASE_Y,
  ROAD_FAR_Z,
  ROAD_HALF_WIDTH,
  ROAD_NEAR_Z,
  ROAD_RELIEF,
} from "./sceneConfig";

/** Faixas longitudinais: as linhas que o olho segue ate a fuga. */
export const LANES = 11;
const LANE_SHARE = 0.42;
const EDGE_SHARE = 0.12;

export interface RoadShape {
  positions: Float32Array;
  /** 1 nas faixas e bordas (mais brilhantes), 0 no preenchimento. */
  lane: Float32Array;
}

/**
 * Estrada, centrada na centerline (x = 0), reta em profundidade.
 *
 * Largura constante: a dobra em tunel, feita no shader, exige bordas
 * paralelas para as laterais se encontrarem sem salto. Medidas absolutas,
 * porque shader e camera dependem delas.
 *
 * Populacoes laterais: faixas, bordas densas e preenchimento. No relevo
 * (y - base), o preenchimento inclui um halo abaixo da pista (fora do tubo
 * depois da dobra) e uma neblina rasa acima (dentro). Distribuicao uniforme
 * em z: o fluxo do shader recicla as particulas e homogeneiza qualquer vies.
 */
export function createRoad(count: number, seed = 4): RoadShape {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const lane = new Float32Array(count);
  const length = ROAD_NEAR_Z - ROAD_FAR_Z;

  for (let i = 0; i < count; i += 1) {
    const z = ROAD_NEAR_Z - rand() * length;
    const roll = rand();
    let across: number;
    let relief: number | null = null;

    if (roll < LANE_SHARE) {
      const k = Math.floor(rand() * LANES);
      across = -1 + (k / (LANES - 1)) * 2 + (rand() - 0.5) * 0.035;
      lane[i] = 1;
    } else if (roll < LANE_SHARE + EDGE_SHARE) {
      across = (rand() < 0.5 ? -1 : 1) * (0.94 + rand() * 0.06);
      lane[i] = 1;
    } else {
      across = rand() * 2 - 1;
      lane[i] = 0;
      const kind = rand();
      if (kind < ROAD_RELIEF.haloShare) {
        relief = -(0.12 + Math.pow(rand(), 1.8) * ROAD_RELIEF.haloDepth);
        // Alem das bordas, cada vez mais raro: a pista nao termina numa reta.
        across *= 1 + Math.pow(rand(), 2) * ROAD_RELIEF.haloSpread;
      } else if (kind < ROAD_RELIEF.haloShare + ROAD_RELIEF.hazeShare) {
        relief = 0.08 + rand() * ROAD_RELIEF.hazeDepth;
      }
    }
    const x = across * ROAD_HALF_WIDTH;

    if (relief === null) {
      const wave = Math.sin(x * 0.55 + z * 0.14) * 0.14 + Math.sin(z * 0.28 - x * 0.2) * 0.09;
      const groove = -Math.exp(-(across * across) * 6) * 0.12;
      const curb = Math.pow(Math.abs(across), 6) * 0.2;
      relief = wave + groove + curb;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = ROAD_BASE_Y + relief;
    positions[i * 3 + 2] = z;
  }

  const order = spatialOrder(positions);
  return { positions: permute(positions, order, 3), lane: permute(lane, order, 1) };
}
