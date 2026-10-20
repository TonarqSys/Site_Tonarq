import { smootherstep } from "@/lib/particles/kinematics";
import {
  GALAXY_CENTER,
  GALAXY_CORE_FRACTION,
  GALAXY_RADIUS,
  GALAXY_REVEAL_DISTANCE,
  TIP_DISTANCE,
  TUNNEL_ENTER_Z,
  TUNNEL_RADIUS,
  TUNNEL_TIP_Z,
  centerlinePoint,
  visibleHeightAt,
} from "@/lib/particles/sceneConfig";

export { GALAXY_REVEAL_DISTANCE, TIP_DISTANCE };

export interface CameraKey {
  /** Progresso global em que este enquadramento vale. */
  p: number;
  position: [number, number, number];
  target: [number, number, number];
}

const CENTER: [number, number, number] = [GALAXY_CENTER[0], GALAXY_CENTER[1], GALAXY_CENTER[2]];

/** Distância da câmera do cilindro/DNA à origem, usada para esticar a forma. */
export const CYLINDER_CAMERA_DISTANCE = 6.9;
export const DNA_CAMERA_DISTANCE = 7.2;

/**
 * Câmera como parte da narrativa. Os keyframes casam com timeline.ts:
 * retenção = dois keyframes iguais. Nenhum keyframe gira o objeto: as formas
 * que giram (cilindro, DNA, galáxia) giram no shader, em função do tempo.
 *
 * Da estrada ao fim a câmera vive sobre a centerline (x = 0,
 * y = TUNNEL_AXIS_Y) olhando para -Z: mesma base da estrada, do túnel e da
 * galáxia. Entra no túnel enquanto ele fecha, atravessa pelo eixo até ficar a
 * TIP_DISTANCE da ponta (a abertura no centro da tela) e, dali, só recua:
 * alvo fixo na ponta (o núcleo), distância monotonicamente crescente, sem
 * órbita, sem deslocamento lateral, sem mudança de FOV.
 */
export const CAMERA_KEYS: readonly CameraKey[] = [
  { p: 0.0, position: [0, 0, 7.6], target: [0, 0, 0] },
  { p: 0.07, position: [0, 0, 7.6], target: [0, 0, 0] },
  { p: 0.19, position: [0, 0, CYLINDER_CAMERA_DISTANCE], target: [0, 0, 0] },
  { p: 0.26, position: [0, 0, CYLINDER_CAMERA_DISTANCE], target: [0, 0, 0] },
  { p: 0.38, position: [0, 0, DNA_CAMERA_DISTANCE], target: [0, 0, 0] },
  { p: 0.47, position: [0, 0, DNA_CAMERA_DISTANCE], target: [0, 0, 0] },
  // Estrada: sobre a centerline, olhando reto para a fuga.
  { p: 0.57, position: centerlinePoint(4.6), target: centerlinePoint(-30) },
  { p: 0.63, position: centerlinePoint(4.6), target: centerlinePoint(-30) },
  // Dobra: as laterais fecham em volta da camera, que segue no eixo.
  { p: 0.73, position: centerlinePoint(TUNNEL_ENTER_Z), target: CENTER },
  // Hipertunel pelo eixo ate a abertura final ocupar o centro da tela.
  { p: 0.83, position: centerlinePoint(TUNNEL_TIP_Z + TIP_DISTANCE), target: CENTER },
  // Camera parada enquanto a ponta vira nucleo.
  { p: 0.86, position: centerlinePoint(TUNNEL_TIP_Z + TIP_DISTANCE), target: CENTER },
  // Unico zoom out: so afastamento, alvo fixo no nucleo.
  { p: 0.95, position: centerlinePoint(TUNNEL_TIP_Z + GALAXY_REVEAL_DISTANCE), target: CENTER },
  { p: 1.0, position: centerlinePoint(TUNNEL_TIP_Z + GALAXY_REVEAL_DISTANCE), target: CENTER },
];

function findSegment(p: number): [CameraKey, CameraKey, number] {
  const keys = CAMERA_KEYS;
  if (p <= keys[0].p) return [keys[0], keys[0], 0];
  for (let i = 1; i < keys.length; i += 1) {
    if (p <= keys[i].p) {
      const a = keys[i - 1];
      const b = keys[i];
      const span = b.p - a.p;
      return [a, b, span > 0 ? smootherstep((p - a.p) / span) : 1];
    }
  }
  const last = keys[keys.length - 1];
  return [last, last, 1];
}

/** Escreve nos vetores recebidos: nada é alocado durante o loop de render. */
export function sampleCamera(
  progress: number,
  position: [number, number, number],
  target: [number, number, number],
): void {
  const [a, b, t] = findSegment(progress);
  for (let i = 0; i < 3; i += 1) {
    position[i] = a.position[i] + (b.position[i] - a.position[i]) * t;
    target[i] = a.target[i] + (b.target[i] - a.target[i]) * t;
  }
}

/** Fração da altura da tela ocupada por um diâmetro a uma dada distância. */
export function projectedFraction(diameter: number, distance: number): number {
  return diameter / visibleHeightAt(distance);
}

export const CORE_DIAMETER = 2 * GALAXY_RADIUS * GALAXY_CORE_FRACTION;
export const GALAXY_DIAMETER = 2 * GALAXY_RADIUS;
export const TIP_APERTURE_DIAMETER = 2 * TUNNEL_RADIUS;
