import { mulberry32 } from "./random";
import { prepareShape } from "./normalizeTargets";

export const ORB_RADIUS = 3.1;
/** Raio maior e menor do toro, antes da escala. */
const MAJOR = 1;
const MINOR = 0.3;
/** Raio maior em unidades de mundo, para o shader achar a normal do tubo. */
export const ORB_MAJOR_WORLD = (ORB_RADIUS / (MAJOR + MINOR)) * MAJOR;

/**
 * Orbe de energia: um toro difuso.
 *
 * De frente lê como anel com o miolo aberto, onde o título é lido. Tem volume
 * real, então o fluxo tangencial do shader circula "por dentro" do tubo, não
 * só na borda — é o que dá a sensação de matéria viva sem eixo global.
 *
 * O movimento não está aqui: as posições são a forma em repouso. Quem move é
 * o campo de fluxo no vertex shader, projetado no plano tangente.
 */
export function createOrb(count: number, seed = 1): Float32Array {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const u = rand() * Math.PI * 2; // ao redor do anel
    const v = rand() * Math.PI * 2; // ao redor do tubo
    // Tubo com miolo mais denso que a borda: casca difusa, não linha dura.
    const gauss = (rand() + rand() + rand() - 1.5) / 1.5;
    const tube = MINOR * (0.55 + Math.abs(gauss) * 0.7);

    // Ondulação no anel: evita circunferência perfeita, que lê como gráfico.
    const wobble = 1 + Math.sin(u * 5) * 0.03 + Math.sin(u * 11 + 1.3) * 0.015;
    const ring = MAJOR * wobble + Math.cos(v) * tube;

    positions[i * 3] = Math.cos(u) * ring;
    positions[i * 3 + 1] = Math.sin(u) * ring;
    positions[i * 3 + 2] = Math.sin(v) * tube * 0.9;
  }
  return prepareShape(positions, ORB_RADIUS);
}
