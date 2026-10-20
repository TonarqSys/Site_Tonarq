"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect } from "react";

import { degrade, quality, recover, resetQuality, startAtInitialTier } from "@/lib/motion/quality";
import { motionState } from "@/lib/motion/scrollTimeline";

/**
 * Ajusta a qualidade pela taxa de quadros observada.
 *
 * Hardware declarado dá só um chute: a mesma máquina roda diferente com
 * bateria baixa, GPU integrada ou outra aba pesada. Quem decide é a medição.
 *
 * Não notifica o React: mudar de degrau re-renderizaria a árvore. O shader lê
 * a densidade direto do objeto mutável.
 */
export function QualityGovernor() {
  const setDpr = useThree((state) => state.setDpr);

  // Modo de verificacao (?t=): degrau fixo, para o quadro ser deterministico
  // mesmo em render por software.
  const frozen = motionState.debugTime !== null;

  useEffect(() => {
    if (frozen) resetQuality();
    else startAtInitialTier();
    setDpr(quality.dpr);
  }, [setDpr, frozen]);

  const onDecline = useCallback(() => {
    if (!frozen && degrade()) setDpr(quality.dpr);
  }, [setDpr, frozen]);

  const onIncline = useCallback(() => {
    if (!frozen && recover()) setDpr(quality.dpr);
  }, [setDpr, frozen]);

  return (
    <PerformanceMonitor
      // Janela larga e histerese: evita ficar oscilando de degrau à toa.
      ms={200}
      iterations={5}
      threshold={0.75}
      bounds={(refreshRate) => (refreshRate > 90 ? [55, 85] : [45, 58])}
      flipflops={3}
      onDecline={onDecline}
      onIncline={onIncline}
    />
  );
}

export default QualityGovernor;
