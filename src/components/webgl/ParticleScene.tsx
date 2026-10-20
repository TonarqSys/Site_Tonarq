"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useState, useSyncExternalStore } from "react";

import CameraRig from "./CameraRig";
import QualityGovernor from "./QualityGovernor";
import WebGLFallback from "./WebGLFallback";
import { ParticleCloud } from "./ParticleCloud";
import { resolveParticleCount } from "@/lib/particles";
import { CAMERA_FOV } from "@/lib/particles/sceneConfig";
import {
  motionState,
  prefersReducedMotion,
  supportsWebGL,
} from "@/lib/motion/scrollTimeline";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Este componente so existe no cliente (dynamic com ssr: false), entao pode
 * medir capacidade de forma sincrona na inicializacao do estado — sem setState
 * em efeito e sem snapshot de servidor.
 *
 * Sem EffectComposer: o brilho vem do blending aditivo com queda suave no
 * fragment shader.
 */
export function ParticleScene() {
  const [capable] = useState(() => supportsWebGL());
  const [count] = useState(() => resolveParticleCount());
  const [visible, setVisible] = useState(true);
  // So no cliente: o snapshot de servidor nunca e usado aqui.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    prefersReducedMotion,
    prefersReducedMotion,
  );

  useEffect(() => {
    motionState.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  // Aba escondida nao precisa renderizar: economiza bateria e evita calor.
  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (!capable || reducedMotion) return <WebGLFallback />;

  return (
    <Canvas
      frameloop={visible ? "always" : "never"}
      camera={{ position: [0, 0, 7.6], fov: CAMERA_FOV, near: 0.1, far: 120 }}
      gl={{
        antialias: false,
        powerPreference: "high-performance",
        alpha: true,
        depth: false,
        stencil: false,
      }}
      style={{ pointerEvents: "none" }}
    >
      <QualityGovernor />
      <CameraRig />
      <ParticleCloud count={count} />
    </Canvas>
  );
}

export default ParticleScene;
