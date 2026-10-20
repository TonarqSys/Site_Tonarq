export {
  NARRATIVE_VH,
  STAGE_COUNT,
  STAGE_IDS,
  stageAt,
  stageSectionTopVh,
  stageTextOpacity,
} from "./timeline";

/**
 * Estado compartilhado entre o ScrollTrigger, a câmera e o loop de render.
 *
 * Objeto mutável de propósito: escrever progresso em `useState` a cada frame
 * dispararia re-render da árvore inteira 60 vezes por segundo. Não há
 * ponteiro aqui: partículas, formas e câmera não reagem ao mouse.
 */
export interface MotionState {
  /** 0..1 ao longo de toda a narrativa. */
  progress: number;
  /** Distância da câmera ao ponto que ela olha; escrita pelo CameraRig. */
  focusDistance: number;
  reducedMotion: boolean;
  /** Progresso fixado por query string em desenvolvimento. */
  debugProgress: number | null;
  /** Tempo do shader fixado por query string (verificação visual determinística). */
  debugTime: number | null;
}

export const motionState: MotionState = {
  progress: 0,
  focusDistance: 7.6,
  reducedMotion: false,
  debugProgress: null,
  debugTime: null,
};

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function supportsWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}
