"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { buildShapes } from "@/lib/particles";
import { coreAttenuation } from "@/lib/particles/kinematics";
import { ORB_MAJOR_WORLD } from "@/lib/particles/orb";
import {
  BOUNDING_RADIUS,
  CYLINDER_OVERSHOOT,
  CYLINDER_WIDTH,
  DNA_FILL,
  GALAXY_CENTER,
  ROAD_BASE_Y,
  ROAD_FLOW,
  ROAD_HALF_WIDTH,
  SPIN,
  TUBE_SPIN,
  visibleHeightAt,
} from "@/lib/particles/sceneConfig";
import { motionState } from "@/lib/motion/scrollTimeline";
import { CYLINDER_CAMERA_DISTANCE, DNA_CAMERA_DISTANCE } from "@/lib/motion/cameraPath";
import { emptySample, sampleTimeline } from "@/lib/motion/timeline";
import { quality } from "@/lib/motion/quality";
import { particlesFragmentShader } from "./shaders/particlesFragment";
import { particlesVertexShader } from "./shaders/particlesVertex";

const PALETTE = {
  core: new THREE.Color("#5CF6FF"),
  mid: new THREE.Color("#3478FF"),
  edge: new THREE.Color("#8B5CF6"),
  accent: new THREE.Color("#FF4FD8"),
  white: new THREE.Color("#F7F8FC"),
};

interface Props {
  count: number;
}

/**
 * Uma unica THREE.Points, um unico BufferGeometry, um draw call.
 *
 * As quatro formas viram atributos calculados uma vez; interpolacao, giro,
 * fluxo, dobra da estrada, hipertunel e nascimento da galaxia acontecem no
 * vertex shader. O objeto nunca e transformado (matriz identidade): o scroll
 * decide a forma e a taxa do fluxo, o tempo decide o movimento interno, e
 * nada se acumula entre frames. O tempo avanca em todo frame, em qualquer
 * progresso. Nenhum uniform de ponteiro. O React so escreve uniforms,
 * lendo objetos mutaveis pre-alocados: nada de setState nem alocacao dentro
 * do useFrame.
 */
export function ParticleCloud({ count }: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const sample = useRef(emptySample());
  // Tempo do fluxo da estrada: integral da taxa do estagio (nunca zero com
  // estrada visivel; so na ponta, depois da desaceleracao).
  const flowTime = useRef(0);

  const shapes = useMemo(() => buildShapes(count), [count]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("aOrb", new THREE.BufferAttribute(shapes.orb, 3));
    geo.setAttribute("aCyl", new THREE.BufferAttribute(shapes.cylinder, 3));
    geo.setAttribute("aDna", new THREE.BufferAttribute(shapes.dna, 3));
    geo.setAttribute("aRoad", new THREE.BufferAttribute(shapes.road, 3));
    geo.setAttribute("aGal", new THREE.BufferAttribute(shapes.galaxyHash, 4));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(shapes.seeds, 1));
    geo.setAttribute("aScale", new THREE.BufferAttribute(shapes.scales, 1));
    geo.setAttribute("aBand", new THREE.BufferAttribute(shapes.band, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(shapes.phase, 1));
    geo.setAttribute("aLane", new THREE.BufferAttribute(shapes.lane, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), BOUNDING_RADIUS);
    return geo;
  }, [count, shapes]);

  // Esticamento calculado da camera (fov e distancia), nao um numero fixo:
  // o cilindro passa da viewport e o DNA cabe inteiro em qualquer tela.
  const stretch = useMemo(() => {
    const h = shapes.helixHeight;
    return {
      cyl: (CYLINDER_OVERSHOOT * visibleHeightAt(CYLINDER_CAMERA_DISTANCE)) / h,
      dna: (DNA_FILL * visibleHeightAt(DNA_CAMERA_DISTANCE)) / h,
    };
  }, [shapes.helixHeight]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFlowTime: { value: 0 },
      uFlowSpeed: { value: 0 },
      uStreak: { value: 0 },
      uRoadFade: { value: 0 },
      uTubeSpin: { value: 0 },
      uSpinCyl: { value: 0 },
      uSpinDna: { value: 0 },
      uSize: { value: 3.4 },
      uPixelRatio: { value: 1 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uDensity: { value: 1 },
      uOrbToCyl: { value: 0 },
      uCylToDna: { value: 0 },
      uDnaToRoad: { value: 0 },
      uFold: { value: 0 },
      uGalaxy: { value: 0 },
      uCoreAtten: { value: 1 },
      uOrbFlow: { value: 1 },
      uBands: { value: 0 },
      uTurbulence: { value: 0 },
      uCylStretch: { value: stretch.cyl },
      uDnaStretch: { value: stretch.dna },
      uCylWidth: { value: CYLINDER_WIDTH },
      uOrbMajor: { value: ORB_MAJOR_WORLD },
      uRoadHalfWidth: { value: ROAD_HALF_WIDTH },
      uRoadBaseY: { value: ROAD_BASE_Y },
      uGalaxyCenter: { value: new THREE.Vector3(...GALAXY_CENTER) },
      uColorCore: { value: PALETTE.core },
      uColorMid: { value: PALETTE.mid },
      uColorEdge: { value: PALETTE.edge },
      uColorAccent: { value: PALETTE.accent },
      uColorWhite: { value: PALETTE.white },
      uOpacity: { value: 1.0 },
    }),
    [stretch],
  );

  useEffect(() => {
    const material = materialRef.current;
    return () => {
      geometry.dispose();
      material?.dispose();
    };
  }, [geometry]);

  useFrame((state, delta) => {
    const material = materialRef.current;
    const points = pointsRef.current;
    if (!material || !points) return;

    const u = material.uniforms;
    const progress = motionState.progress;
    const s = sampleTimeline(progress, sample.current);

    u.uOrbToCyl.value = s.orbToCylinder;
    u.uCylToDna.value = s.cylinderToDna;
    u.uDnaToRoad.value = s.dnaToRoad;
    u.uFold.value = s.fold;
    u.uGalaxy.value = s.galaxyFormation;
    u.uBands.value = s.bands;
    u.uTurbulence.value = motionState.reducedMotion ? 0 : s.turbulence;
    u.uOrbFlow.value = motionState.reducedMotion ? 0 : s.orbFlow;
    u.uStreak.value = s.streak;
    u.uRoadFade.value = s.roadFade;
    u.uFlowSpeed.value = s.flowRate * ROAD_FLOW.speed;
    // Compensacao de densidade do bojo pela distancia real da camera ao nucleo.
    u.uCoreAtten.value = coreAttenuation(motionState.focusDistance);

    // Tempo: livre em uso normal; fixo no modo de verificacao, para o mesmo
    // (progresso, t) produzir sempre o mesmo quadro. O tempo do fluxo e a
    // integral da taxa do estagio: anda em qualquer progresso.
    if (motionState.debugTime !== null) {
      u.uTime.value = motionState.debugTime;
      flowTime.current = motionState.debugTime * Math.max(s.flowRate, 0.25);
    } else if (!motionState.reducedMotion) {
      u.uTime.value += delta;
      flowTime.current += delta * s.flowRate;
    }
    u.uFlowTime.value = flowTime.current;
    const time = u.uTime.value as number;
    u.uSpinCyl.value = time * SPIN.cylinder;
    u.uSpinDna.value = time * SPIN.dna;
    u.uTubeSpin.value = time * TUBE_SPIN;
    u.uPixelRatio.value = state.gl.getPixelRatio();
    (u.uResolution.value as THREE.Vector2).set(
      state.gl.domElement.width,
      state.gl.domElement.height,
    );

    const alvo = quality.density;
    u.uDensity.value += (alvo - (u.uDensity.value as number)) * Math.min(1, delta * 2.5);
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={particlesVertexShader}
        fragmentShader={particlesFragmentShader}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
