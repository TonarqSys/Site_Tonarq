import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CAMERA_KEYS, CYLINDER_CAMERA_DISTANCE, DNA_CAMERA_DISTANCE, sampleCamera } from "./cameraPath";
import { EFFECTS, TRANSITIONS, emptySample, flowRate, ramp, sampleTimeline } from "./timeline";
import {
  cameraDistanceFromCore,
  foldRoadPoint,
  galaxyFromTube,
  roadFlowZ,
  traversalCameraZ,
  type Vec4,
} from "@/lib/particles/kinematics";
import { buildShapes } from "@/lib/particles";
import { mulberry32 } from "@/lib/particles/random";
import {
  BOUNDING_RADIUS,
  CYLINDER_OVERSHOOT,
  DNA_FILL,
  GALAXY_CENTER,
  GALAXY_REVEAL_DISTANCE,
  HYPER,
  ROAD_NEAR_Z,
  TIP_DISTANCE,
  TUNNEL_AXIS_Y,
  TUNNEL_RADIUS,
  TUNNEL_TIP_Z,
  visibleHeightAt,
} from "@/lib/particles/sceneConfig";

const [GX, GY, GZ] = GALAXY_CENTER;
const amostra = (p: number) => sampleTimeline(p, emptySample());
const webgl = (file: string) =>
  readFileSync(path.resolve(__dirname, "../../components/webgl", file), "utf8");

type V3 = [number, number, number];
const v3 = (): V3 => [0, 0, 0];
const distToCore = (pos: number[]) => Math.hypot(pos[0] - GX, pos[1] - GY, pos[2] - GZ);

describe("função pura do progresso: nada se acumula", () => {
  it("o mesmo progresso produz sempre a mesma pose e a mesma amostra, em qualquer histórico", () => {
    const pontos = [0.1, 0.42, 0.6, 0.68, 0.77, 0.83, 0.9, 1];
    const primeira = pontos.map((p) => {
      const pos = v3();
      const tgt = v3();
      sampleCamera(p, pos, tgt);
      return { pos, tgt, s: amostra(p) };
    });
    for (let sweep = 0; sweep < 3; sweep += 1) {
      for (let i = 0; i <= 200; i += 1) {
        const p = sweep % 2 === 0 ? i / 200 : 1 - i / 200;
        sampleCamera(p, v3(), v3());
        amostra(p);
      }
    }
    pontos.forEach((p, k) => {
      const pos = v3();
      const tgt = v3();
      sampleCamera(p, pos, tgt);
      expect(pos).toEqual(primeira[k].pos);
      expect(tgt).toEqual(primeira[k].tgt);
      expect(amostra(p)).toEqual(primeira[k].s);
    });
  });

  it("scroll para frente e reverso percorrem exatamente a mesma trajetória", () => {
    const frente: number[][] = [];
    const reverso: number[][] = [];
    for (let i = 0; i <= 500; i += 1) {
      const pos = v3();
      sampleCamera(i / 500, pos, v3());
      frente.push([...pos]);
    }
    for (let i = 500; i >= 0; i -= 1) {
      const pos = v3();
      sampleCamera(i / 500, pos, v3());
      reverso.unshift([...pos]);
    }
    expect(reverso).toEqual(frente);
  });

  it("nenhum componente acumula rotação, interpola a partir do estado anterior ou muda o FOV", () => {
    const cloud = webgl("ParticleCloud.tsx");
    const rig = webgl("CameraRig.tsx");
    for (const src of [cloud, rig]) {
      expect(src).not.toMatch(/rotation\.[xyz]\s*[+\-*/]?=/);
      expect(src).not.toMatch(/\.rotation\.set\(/);
      expect(src).not.toMatch(/\.rotate[XYZ]\(/);
      expect(src).not.toMatch(/\.lerp\(/);
      expect(src).not.toMatch(/\.slerp\(/);
      expect(src).not.toMatch(/\.fov\s*=/);
      expect(src).not.toMatch(/updateProjectionMatrix/);
    }
    expect(cloud).not.toMatch(/points\.(position|rotation|quaternion|scale)/);
  });

  it("nenhuma influência do mouse resta em shader, câmera, geometria ou listeners", () => {
    const files = [
      "ParticleCloud.tsx",
      "CameraRig.tsx",
      "ScrollController.tsx",
      "ParticleScene.tsx",
      path.join("shaders", "particlesVertex.ts"),
      path.join("shaders", "particlesFragment.ts"),
    ];
    for (const file of files) {
      const src = webgl(file).replace(/pointer-events|pointerEvents/g, "");
      expect(src).not.toMatch(/uMouse|uPointer|uParallax/);
      expect(src).not.toMatch(/pointermove|mousemove|touchmove/);
      expect(src).not.toMatch(/pointerX|pointerY|parallax/i);
    }
    const state = readFileSync(path.resolve(__dirname, "scrollTimeline.ts"), "utf8");
    expect(state).not.toMatch(/pointer/i);
    for (const key of CAMERA_KEYS) expect(Object.keys(key).sort()).toEqual(["p", "position", "target"]);
  });

  it("nenhuma partícula recebe nova seed: atributos são fixos e determinísticos", () => {
    const a = buildShapes(1200);
    const b = buildShapes(1200);
    expect(a.seeds).toEqual(b.seeds);
    expect(a.road).toEqual(b.road);
    expect(a.galaxyHash).toEqual(b.galaxyHash);
    const vertex = webgl(path.join("shaders", "particlesVertex.ts"));
    expect(vertex).not.toMatch(/uniform\s+float\s+uSeed/);
    expect(vertex).not.toMatch(/aSeed\s*=/);
  });
});

describe("movimento contínuo em todos os estágios: o tempo anda, o scroll só escolhe a taxa", () => {
  it("a taxa do fluxo nunca zera enquanto a estrada existe e só chega a zero na ponta", () => {
    for (let i = 471; i < Math.round(EFFECTS.traverse[1] * 1000); i += 1) expect(flowRate(i / 1000)).toBeGreaterThan(0);
    for (let p = TRANSITIONS.dnaToRoad[1]; p <= TRANSITIONS.fold[1] + 1e-9; p += 0.005) {
      expect(flowRate(p)).toBeCloseTo(1, 9);
    }
    // Estrada parcialmente formada ja corre, e cada vez mais.
    expect(flowRate(0.5)).toBeGreaterThan(0);
    expect(flowRate(0.5)).toBeLessThan(1);
    expect(flowRate(0.55)).toBeGreaterThan(flowRate(0.5));
    // Hipertunel: dispara e desacelera suavemente ate zero na ponta.
    let peak = 0;
    for (let p = EFFECTS.traverse[0]; p <= EFFECTS.traverse[1]; p += 0.0005) peak = Math.max(peak, flowRate(p));
    expect(peak).toBeGreaterThanOrEqual(HYPER.peak * 0.98);
    expect(flowRate(EFFECTS.traverse[1])).toBe(0);
    expect(flowRate(0.86)).toBe(0);
    expect(flowRate(1)).toBe(0);
    let prev = flowRate(0);
    for (let i = 1; i <= 1000; i += 1) {
      const r = flowRate(i / 1000);
      expect(Math.abs(r - prev)).toBeLessThan(1.0);
      prev = r;
    }
  });

  it("nenhuma condição de igualdade exata ou de estágio ativo habilita o movimento", () => {
    const cloud = webgl("ParticleCloud.tsx");
    const vertex = webgl(path.join("shaders", "particlesVertex.ts"));
    expect(cloud).toMatch(/flowTime\.current \+= delta \* s\.flowRate/);
    expect(cloud).toMatch(/u\.uTime\.value \+= delta/);
    for (const src of [cloud, vertex]) {
      expect(src).not.toMatch(/progress\s*===?\s*1\b/);
      expect(src).not.toMatch(/activeStage/);
      expect(src).not.toMatch(/uFold\s*===?\s*1\.0/);
    }
  });

  it("com o scroll parado, em progressos intermediários as posições mudam entre t e t+1", () => {
    const rand = mulberry32(5);
    const z0 = -12.3;
    const seed = rand();
    for (const p of [0.49, 0.52, 0.56, 0.6, 0.66, 0.7, 0.72, 0.75, 0.79, 0.81]) {
      const s = amostra(p);
      expect(s.flowRate).toBeGreaterThan(0);
      const a = roadFlowZ(z0, seed, 0, 10);
      const b = roadFlowZ(z0, seed, 0, 10 + s.flowRate);
      expect(Math.abs(b - a)).toBeGreaterThan(0.01);
    }
    // Depois da ponta o fluxo para, mas o tubo gira e a galaxia orbita.
    for (const p of [0.84, 0.88, 0.95, 1]) {
      const s = amostra(p);
      expect(s.fold).toBe(1);
      const a = foldRoadPoint(1.2, -0.55, -20, s.fold, 10);
      const b = foldRoadPoint(1.2, -0.55, -20, s.fold, 11);
      expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(0.01);
      const h: Vec4 = [0.3, 0.5, 0.9, 0.5];
      const g0 = galaxyFromTube(0.5, 0.2, h, 10).position;
      const g1 = galaxyFromTube(0.5, 0.2, h, 11).position;
      expect(Math.hypot(g0[0] - g1[0], g0[1] - g1[1], g0[2] - g1[2])).toBeGreaterThan(0.01);
    }
  });

  it("os riscos radiais existem só no hipertúnel e somem antes de a ponta virar núcleo", () => {
    for (const p of [0, 0.5, 0.6, 0.68, 0.73, 0.735]) expect(amostra(p).streak).toBe(0);
    let peak = 0;
    for (let p = EFFECTS.traverse[0]; p <= EFFECTS.traverse[1]; p += 0.001) peak = Math.max(peak, amostra(p).streak);
    expect(peak).toBeCloseTo(1, 6);
    for (let p = TRANSITIONS.galaxyFormation[0]; p <= 1; p += 0.005) expect(amostra(p).streak).toBe(0);
  });

  it("a bounding sphere cobre todas as posições animadas", () => {
    const shapes = buildShapes(3000);
    const cylStretch = (CYLINDER_OVERSHOOT * visibleHeightAt(CYLINDER_CAMERA_DISTANCE)) / shapes.helixHeight;
    const dnaStretch = (DNA_FILL * visibleHeightAt(DNA_CAMERA_DISTANCE)) / shapes.helixHeight;
    let max = 0;
    const consider = (x: number, y: number, z: number) => {
      max = Math.max(max, Math.hypot(x, y, z));
    };
    for (let i = 0; i < 3000; i += 1) {
      consider(shapes.orb[i * 3], shapes.orb[i * 3 + 1], shapes.orb[i * 3 + 2]);
      consider(shapes.cylinder[i * 3] * 1.6, shapes.cylinder[i * 3 + 1] * cylStretch, shapes.cylinder[i * 3 + 2] * 1.6);
      consider(shapes.dna[i * 3], shapes.dna[i * 3 + 1] * dnaStretch, shapes.dna[i * 3 + 2]);
      const [rx, ry, rz] = [shapes.road[i * 3], shapes.road[i * 3 + 1], shapes.road[i * 3 + 2]];
      consider(rx, ry, rz);
      const t = foldRoadPoint(rx, ry, rz, 1, 3);
      consider(t[0], t[1], t[2]);
    }
    const rand = mulberry32(9);
    for (let i = 0; i < 20000; i += 1) {
      const g = galaxyFromTube(rand(), rand(), [rand(), rand(), rand(), rand()], 40).position;
      consider(g[0], g[1], g[2]);
    }
    expect(max).toBeLessThan(BOUNDING_RADIUS);
  });
});

describe("câmera sobre a centerline: da estrada ao fim", () => {
  it("permanece na centerline, sem órbita nem deslocamento lateral, olhando para -Z", () => {
    for (let i = 0; i <= 1000; i += 1) {
      const p = TRANSITIONS.dnaToRoad[1] + ((1 - TRANSITIONS.dnaToRoad[1]) * i) / 1000;
      const pos = v3();
      const tgt = v3();
      sampleCamera(p, pos, tgt);
      const lateral = Math.hypot(pos[0], pos[1] - TUNNEL_AXIS_Y);
      expect(lateral).toBeLessThan(1e-9);
      expect(lateral).toBeLessThan(TUNNEL_RADIUS * 0.5);
      expect(Math.hypot(tgt[0], tgt[1] - TUNNEL_AXIS_Y)).toBeLessThan(1e-9);
      expect(tgt[2]).toBeLessThan(pos[2]);
    }
  });

  it("o hipertúnel tem um único ponto de fuga: a câmera olha exatamente pelo eixo do tubo", () => {
    for (let i = 0; i <= 200; i += 1) {
      const p = EFFECTS.traverse[0] + ((EFFECTS.traverse[1] - EFFECTS.traverse[0]) * i) / 200;
      const pos = v3();
      const tgt = v3();
      sampleCamera(p, pos, tgt);
      const fwd = [tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]];
      const n = Math.hypot(...fwd);
      expect(fwd[0] / n).toBeCloseTo(0, 12);
      expect(fwd[1] / n).toBeCloseTo(0, 12);
      expect(fwd[2] / n).toBeCloseTo(-1, 12);
      expect(tgt).toEqual([GX, GY, GZ]);
    }
  });

  it("atravessa o túnel avançando até a ponta ocupar o centro da tela, sem voltar", () => {
    let zAnterior = Infinity;
    for (let i = 0; i <= 1000; i += 1) {
      const p = TRANSITIONS.fold[0] + ((EFFECTS.traverse[1] - TRANSITIONS.fold[0]) * i) / 1000;
      const pos = v3();
      sampleCamera(p, pos, v3());
      expect(pos[2]).toBeLessThanOrEqual(zAnterior + 1e-9);
      zAnterior = pos[2];
    }
    const pos = v3();
    const tgt = v3();
    sampleCamera(EFFECTS.traverse[1], pos, tgt);
    expect(pos[2]).toBeCloseTo(TUNNEL_TIP_Z + TIP_DISTANCE, 9);
    expect(tgt).toEqual([GX, GY, GZ]);
    for (let i = 0; i <= 100; i += 1) {
      const q = EFFECTS.traverse[0] + ((EFFECTS.traverse[1] - EFFECTS.traverse[0]) * i) / 100;
      sampleCamera(q, pos, v3());
      expect(pos[2]).toBeCloseTo(traversalCameraZ(amostra(q).traverse), 6);
    }
  });
});

describe("galáxia: nasce da ponta, só depois do cilindro completo, num único zoom out", () => {
  it("galaxyProgress é exatamente zero antes de o cilindro estar completo e durante o hipertúnel", () => {
    for (let i = 0; i <= Math.round(TRANSITIONS.galaxyFormation[0] * 1000); i += 1) expect(amostra(i / 1000).galaxyFormation).toBe(0);
    expect(amostra(TRANSITIONS.fold[1]).fold).toBe(1);
    expect(TRANSITIONS.galaxyFormation[0]).toBeGreaterThanOrEqual(EFFECTS.traverse[1]);
    expect(amostra(TRANSITIONS.galaxyFormation[0]).traverse).toBe(1);
  });

  it("intervalos distintos: hipertúnel, ponta vira núcleo, zoom out", () => {
    expect(EFFECTS.traverse[1]).toBeLessThanOrEqual(EFFECTS.tipToCore[0]);
    expect(EFFECTS.tipToCore[1]).toBeLessThanOrEqual(EFFECTS.galaxyZoom[0]);
    expect(EFFECTS.tipToCore[0]).toBe(TRANSITIONS.galaxyFormation[0]);
    expect(EFFECTS.galaxyZoom[1]).toBe(TRANSITIONS.galaxyFormation[1]);
  });

  it("o núcleo nasce na ponta do cilindro com a câmera parada; só depois ela recua", () => {
    const pos = v3();
    const tgt = v3();
    for (let p = EFFECTS.tipToCore[0]; p <= EFFECTS.tipToCore[1] + 1e-9; p += 0.002) {
      sampleCamera(p, pos, tgt);
      expect(tgt).toEqual([0, TUNNEL_AXIS_Y, TUNNEL_TIP_Z]);
      expect(distToCore(pos)).toBeCloseTo(TIP_DISTANCE, 9);
    }
  });

  it("no zoom out a distância só cresce, alvo fixo, sem novo zoom in", () => {
    let anterior: number | null = null;
    for (let i = 0; i <= 1000; i += 1) {
      const p = TRANSITIONS.galaxyFormation[0] + ((1 - TRANSITIONS.galaxyFormation[0]) * i) / 1000;
      const pos = v3();
      const tgt = v3();
      sampleCamera(p, pos, tgt);
      const d = distToCore(pos);
      if (anterior !== null) {
        expect(d).toBeGreaterThanOrEqual(anterior - 1e-9);
        expect(d - anterior).toBeLessThan(0.1);
      }
      anterior = d;
      expect(tgt).toEqual([GX, GY, GZ]);
      const linear = Math.min(1, Math.max(0, (p - EFFECTS.galaxyZoom[0]) / (EFFECTS.galaxyZoom[1] - EFFECTS.galaxyZoom[0])));
      expect(d).toBeCloseTo(cameraDistanceFromCore(linear), 6);
    }
    expect(anterior).toBeCloseTo(GALAXY_REVEAL_DISTANCE, 9);
  });

  it("nenhum salto de opacidade, escala ou posição: toda amostra é Lipschitz no progresso", () => {
    const h = 1e-3;
    let prev = amostra(0);
    for (let i = 1; i <= 1000; i += 1) {
      const s = amostra(i * h);
      for (const k of ["orbToCylinder", "cylinderToDna", "dnaToRoad", "fold", "galaxyFormation", "galaxyZoom", "traverse", "bands", "orbFlow"] as const) {
        expect(Math.abs(s[k] - prev[k])).toBeLessThan(0.03);
      }
      for (const k of ["streak", "roadFade"] as const) {
        expect(Math.abs(s[k] - prev[k])).toBeLessThan(0.3);
      }
      prev = s;
    }
  });

  it("o fluxo só congela quando o nascimento começa (sem reciclar partícula em voo)", () => {
    for (let i = 0; i <= 1000; i += 1) {
      const s = amostra(i / 1000);
      if (s.galaxyFormation > 0) expect(s.flowRate).toBe(0);
      if (s.flowRate > 0) expect(s.galaxyFormation).toBe(0);
    }
    expect(ROAD_NEAR_Z).toBeGreaterThan(TUNNEL_TIP_Z);
  });
});

describe("transições encaixadas", () => {
  it("cada transformação começa em 0 exatamente onde a anterior terminou em 1", () => {
    const ordem = [
      TRANSITIONS.orbToCylinder,
      TRANSITIONS.cylinderToDna,
      TRANSITIONS.dnaToRoad,
      TRANSITIONS.fold,
      TRANSITIONS.galaxyFormation,
    ];
    for (let i = 1; i < ordem.length; i += 1) {
      expect(ramp(ordem[i][0], ordem[i - 1])).toBe(1);
      expect(ramp(ordem[i - 1][1], ordem[i])).toBe(0);
    }
  });

  it("primeira derivada contínua: velocidade nula nos limites de cada rampa", () => {
    const h = 1e-5;
    for (const r of Object.values(TRANSITIONS)) {
      const [a, b] = r;
      expect(Math.abs(ramp(a + h, r) - ramp(a, r)) / h).toBeLessThan(1e-3);
      expect(Math.abs(ramp(b, r) - ramp(b - h, r)) / h).toBeLessThan(1e-3);
      let prevSlope = 0;
      for (let i = 0; i <= 200; i += 1) {
        const p = a + ((b - a) * i) / 200;
        const slope = (ramp(p + h, r) - ramp(p, r)) / h;
        if (i > 0) expect(Math.abs(slope - prevSlope)).toBeLessThan(0.2 / (b - a));
        prevSlope = slope;
      }
    }
  });

  it("a câmera não salta em nenhum keyframe", () => {
    let anterior: number[] | null = null;
    for (let i = 0; i <= 1000; i += 1) {
      const pos = v3();
      sampleCamera(i / 1000, pos, v3());
      if (anterior) {
        expect(Math.hypot(pos[0] - anterior[0], pos[1] - anterior[1], pos[2] - anterior[2])).toBeLessThan(0.9);
      }
      anterior = [...pos];
    }
    for (let i = 1; i < CAMERA_KEYS.length; i += 1) expect(CAMERA_KEYS[i].p).toBeGreaterThanOrEqual(CAMERA_KEYS[i - 1].p);
  });
});
