import { mulberry32 } from "./random";

/**
 * A galáxia não é uma forma armazenada: o vertex shader a calcula a partir
 * da posição de cada partícula no túnel (ver kinematics.galaxyFromTube).
 * O que fica no buffer são quatro números aleatórios fixos por partícula,
 * usados para dispersão nos braços, espessura, halo e cor. Seeds fixas:
 * nenhuma partícula recebe nova seed em transformação alguma.
 */
export function createGalaxyHashes(count: number, seed = 6): Float32Array {
  const rand = mulberry32(seed);
  const hashes = new Float32Array(count * 4);
  for (let i = 0; i < hashes.length; i += 1) hashes[i] = rand();
  return hashes;
}
