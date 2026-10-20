"use client";

import dynamic from "next/dynamic";

import ScrollController from "./ScrollController";
import WebGLFallback from "./WebGLFallback";

/**
 * Canvas so no cliente. Enquanto o chunk nao chega (e no HTML do servidor), o
 * fallback estatico ocupa o lugar. A decisao WebGL/movimento reduzido vive
 * dentro do ParticleScene, que so roda no cliente — sem depender de
 * useSyncExternalStore trocar snapshot de servidor por cliente apos hidratar,
 * o que na pratica deixava o fallback montado para sempre.
 */
const ParticleScene = dynamic(() => import("./ParticleScene"), {
  ssr: false,
  loading: () => <WebGLFallback />,
});

interface Props {
  narrativeId: string;
  onProgress?: (progress: number) => void;
}

export function ParticleExperience({ narrativeId, onProgress }: Props) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      data-testid="particle-experience"
    >
      <ParticleScene />
      <ScrollController targetId={narrativeId} onProgress={onProgress} />
    </div>
  );
}

export default ParticleExperience;
