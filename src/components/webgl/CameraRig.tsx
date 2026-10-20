"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { motionState } from "@/lib/motion/scrollTimeline";
import { sampleCamera } from "@/lib/motion/cameraPath";

/**
 * Move a camera junto com a narrativa.
 *
 * A pose e funcao pura do progresso: nenhum lerp a partir do estado anterior
 * e nenhuma influencia do mouse, entao o mesmo progresso da sempre o mesmo
 * enquadramento, rolando para baixo ou para cima. A suavizacao do scroll ja
 * vem do scrub do ScrollTrigger. O FOV nunca muda.
 *
 * Tambem publica a distancia de foco (camera -> alvo), que no nascimento da
 * galaxia e a distancia ao nucleo, usada pela atenuacao do bojo.
 */
export function CameraRig() {
  const { camera } = useThree();

  const position = useRef<[number, number, number]>([0, 0, 7.6]);
  const target = useRef<[number, number, number]>([0, 0, 0]);
  const lookAt = useRef(new THREE.Vector3());

  useFrame(() => {
    sampleCamera(motionState.progress, position.current, target.current);
    camera.position.set(...position.current);
    lookAt.current.set(...target.current);
    camera.lookAt(lookAt.current);
    motionState.focusDistance = camera.position.distanceTo(lookAt.current);
  });

  return null;
}

export default CameraRig;
