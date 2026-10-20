"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { motionState } from "@/lib/motion/scrollTimeline";
import { STAGE_IDS } from "@/lib/motion/timeline";

interface Props {
  /** Id do container que define a altura da narrativa. */
  targetId: string;
  /** Chamado a cada mudanca de progresso (so em scroll, nao por frame). */
  onProgress?: (progress: number) => void;
}

/**
 * Modo de verificacao visual: ?progress=0.42 fixa o progresso e ?t=12 fixa
 * o tempo do shader (quadro deterministico). Fora de producao sempre; em
 * producao so num build feito com NEXT_PUBLIC_DEBUG_PROGRESS=1. O build
 * normal nao expoe o modo.
 */
function debugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEBUG_PROGRESS === "1";
}

function readDebugNumber(name: string, min: number, max: number): number | null {
  if (!debugEnabled()) return null;
  const raw = new URLSearchParams(window.location.search).get(name);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : null;
}

/**
 * Liga o scroll ao progresso do morphing.
 *
 * Nao ha scroll hijacking: o navegador rola normalmente e nos apenas lemos a
 * posicao. Por isso funciona com roda, trackpad, toque, teclado e barra, e a
 * reversao e exata: o mesmo progresso produz sempre o mesmo quadro. O
 * ponteiro nao entra aqui: particulas e camera nao reagem ao mouse.
 */
export function ScrollController({ targetId, onProgress }: Props) {
  useEffect(() => {
    const debug = readDebugNumber("progress", 0, 1);
    motionState.debugProgress = debug;
    motionState.debugTime = readDebugNumber("t", 0, 100000);
    if (debug !== null) {
      motionState.progress = debug;
      onProgress?.(debug);
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    const element = document.getElementById(targetId);
    if (!element) return;

    const trigger = ScrollTrigger.create({
      trigger: element,
      start: "top top",
      end: "bottom bottom",
      // scrub numerico suaviza sem descolar do scroll real.
      scrub: 0.5,
      onUpdate: (self) => {
        motionState.progress = self.progress;
        onProgress?.(self.progress);
      },
    });

    STAGE_IDS.forEach((id, index) => {
      element.dataset[`stage${index}`] = id;
    });

    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      trigger.kill();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [targetId, onProgress]);

  return null;
}

export default ScrollController;
