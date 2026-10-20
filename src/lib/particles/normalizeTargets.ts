/**
 * Correspondência entre formas.
 *
 * Sem isto o morphing vira embaralhamento: cada partícula atravessa a tela até
 * um alvo aleatório. Ordenando as formas pela mesma chave espacial, o índice i
 * fica em região equivalente em cada uma, e a transformação lê como
 * reorganização, não como ruído.
 */

/** Chave angular estável: azimute primeiro, altura depois. */
function spatialKey(x: number, y: number, z: number): number {
  const azimuth = Math.atan2(z, x) + Math.PI; // 0..2PI
  return azimuth * 1000 + y;
}

/** Permutação que ordena as posições pela chave espacial. */
export function spatialOrder(positions: Float32Array): Uint32Array {
  const count = positions.length / 3;
  const order = new Uint32Array(count);
  const keys = new Float64Array(count);
  for (let i = 0; i < count; i += 1) {
    order[i] = i;
    keys[i] = spatialKey(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
  }
  return order.sort((a, b) => keys[a] - keys[b]);
}

/** Aplica a mesma permutação a um atributo de `stride` componentes. */
export function permute(
  source: Float32Array,
  order: Uint32Array,
  stride: number,
): Float32Array {
  const out = new Float32Array(source.length);
  for (let i = 0; i < order.length; i += 1) {
    const from = order[i] * stride;
    const to = i * stride;
    for (let c = 0; c < stride; c += 1) out[to + c] = source[from + c];
  }
  return out;
}

export function sortBySpatialKey(positions: Float32Array): Float32Array {
  return permute(positions, spatialOrder(positions), 3);
}

/** Escala a forma para caber num raio alvo, mantendo proporção. */
export function fitToRadius(positions: Float32Array, radius: number): Float32Array {
  let maxDistance = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const d = Math.hypot(positions[i], positions[i + 1], positions[i + 2]);
    if (d > maxDistance) maxDistance = d;
  }
  if (maxDistance === 0) return positions;
  const scale = radius / maxDistance;
  for (let i = 0; i < positions.length; i += 1) positions[i] *= scale;
  return positions;
}

export function prepareShape(positions: Float32Array, radius: number): Float32Array {
  return sortBySpatialKey(fitToRadius(positions, radius));
}
