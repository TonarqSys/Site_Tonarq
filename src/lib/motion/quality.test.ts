import { beforeEach, describe, expect, it } from "vitest";

import { QUALITY_TIERS, degrade, quality, recover, resetQuality } from "./quality";
import {
  CAMERA_KEYS,
  CYLINDER_CAMERA_DISTANCE,
  DNA_CAMERA_DISTANCE,
  GALAXY_DIAMETER,
  GALAXY_REVEAL_DISTANCE,
  TIP_APERTURE_DIAMETER,
  TIP_DISTANCE,
  projectedFraction,
  sampleCamera,
} from "./cameraPath";
import { EFFECTS, TRANSITIONS } from "./timeline";
import {
  CYLINDER_OVERSHOOT,
  DNA_FILL,
  GALAXY_CENTER,
  TUNNEL_AXIS_Y,
  visibleHeightAt,
} from "@/lib/particles/sceneConfig";
import { createHelixShapes } from "@/lib/particles/helix";

const [GX, GY, GZ] = GALAXY_CENTER;
const distToCenter = (p: number[]) => Math.hypot(p[0] - GX, p[1] - GY, p[2] - GZ);

describe("adaptação de qualidade", () => {
  beforeEach(() => resetQuality());

  it("cada degrau é mais leve, nunca acima de 1.25 de resolução", () => {
    for (let i = 1; i < QUALITY_TIERS.length; i += 1) {
      expect(QUALITY_TIERS[i].density).toBeLessThan(QUALITY_TIERS[i - 1].density);
      expect(QUALITY_TIERS[i].dpr).toBeLessThanOrEqual(QUALITY_TIERS[i - 1].dpr);
    }
    for (const t of QUALITY_TIERS) expect(t.dpr).toBeLessThanOrEqual(1.25);
  });

  it("degrada e recupera um degrau por vez", () => {
    expect(degrade()).toBe(true);
    expect(quality.tier).toBe(1);
    expect(recover()).toBe(true);
    expect(recover()).toBe(false);
  });
});

describe("cilindro e DNA no enquadramento", () => {
  const { height } = createHelixShapes(2000);

  it("o cilindro esticado passa da viewport nos dois lados", () => {
    const stretch = (CYLINDER_OVERSHOOT * visibleHeightAt(CYLINDER_CAMERA_DISTANCE)) / height;
    const alturaFinal = height * stretch;
    expect(alturaFinal / visibleHeightAt(CYLINDER_CAMERA_DISTANCE)).toBeCloseTo(CYLINDER_OVERSHOOT, 5);
    expect(CYLINDER_OVERSHOOT).toBeGreaterThanOrEqual(1.2);
    expect(CYLINDER_OVERSHOOT).toBeLessThanOrEqual(1.6);
  });

  it("o cilindro é visto de frente, sem tombo que revele as tampas", () => {
    const meio = (TRANSITIONS.orbToCylinder[1] + TRANSITIONS.cylinderToDna[0]) / 2;
    const pos: [number, number, number] = [0, 0, 0];
    const tgt: [number, number, number] = [0, 0, 0];
    sampleCamera(meio, pos, tgt);
    expect(pos[1]).toBeCloseTo(tgt[1], 6);
  });

  it("o DNA cabe inteiro na altura visível", () => {
    const stretch = (DNA_FILL * visibleHeightAt(DNA_CAMERA_DISTANCE)) / height;
    expect((height * stretch) / visibleHeightAt(DNA_CAMERA_DISTANCE)).toBeLessThan(1);
  });
});

describe("zoom out da galáxia", () => {
  const pos: [number, number, number] = [0, 0, 0];
  const tgt: [number, number, number] = [0, 0, 0];

  it("a câmera para a TIP_DISTANCE da ponta quando o nascimento começa", () => {
    sampleCamera(TRANSITIONS.galaxyFormation[0], pos, tgt);
    expect(distToCenter(pos)).toBeCloseTo(TIP_DISTANCE, 9);
  });

  it("no início do zoom a abertura final do túnel ocupa 50–80% da altura da tela", () => {
    sampleCamera(EFFECTS.galaxyZoom[0], pos, tgt);
    const frac = projectedFraction(TIP_APERTURE_DIAMETER, distToCenter(pos));
    expect(frac).toBeGreaterThanOrEqual(0.5);
    expect(frac).toBeLessThanOrEqual(0.8);
  });

  it("no fim a galáxia inteira ocupa 55–75% da altura da tela", () => {
    sampleCamera(1, pos, tgt);
    expect(distToCenter(pos)).toBeCloseTo(GALAXY_REVEAL_DISTANCE, 1);
    const frac = projectedFraction(GALAXY_DIAMETER, distToCenter(pos));
    expect(frac).toBeGreaterThanOrEqual(0.55);
    expect(frac).toBeLessThanOrEqual(0.75);
  });

  it("a distância cresce monotonicamente durante o zoom e o alvo é o centro", () => {
    let anterior = 0;
    for (let i = 0; i <= 50; i += 1) {
      const p = EFFECTS.galaxyZoom[0] + ((EFFECTS.galaxyZoom[1] - EFFECTS.galaxyZoom[0]) * i) / 50;
      sampleCamera(p, pos, tgt);
      const d = distToCenter(pos);
      expect(d).toBeGreaterThanOrEqual(anterior - 1e-9);
      anterior = d;
      expect(tgt[0]).toBeCloseTo(GX, 6);
      expect(tgt[1]).toBeCloseTo(GY, 6);
      expect(tgt[2]).toBeCloseTo(GZ, 6);
    }
  });

  it("a câmera olha para o centro e nunca o atravessa", () => {
    for (let i = 0; i <= 100; i += 1) {
      const p = TRANSITIONS.fold[1] + ((1 - TRANSITIONS.fold[1]) * i) / 100;
      sampleCamera(p, pos, tgt);
      // sempre do lado +Z do nucleo
      expect(pos[2]).toBeGreaterThan(GZ);
      const fwd = [tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]];
      const toC = [GX - pos[0], GY - pos[1], GZ - pos[2]];
      const nf = Math.hypot(...fwd);
      const nc = Math.hypot(...toC);
      if (nf > 1e-6 && nc > 1e-6) {
        const cos = (fwd[0] * toC[0] + fwd[1] * toC[1] + fwd[2] * toC[2]) / (nf * nc);
        expect(cos).toBeGreaterThan(0.99);
      }
    }
  });

  it("o zoom out fica dentro do nascimento, depois de a ponta virar núcleo", () => {
    expect(EFFECTS.galaxyZoom[0]).toBeGreaterThanOrEqual(TRANSITIONS.galaxyFormation[0]);
    expect(EFFECTS.galaxyZoom[1]).toBe(TRANSITIONS.galaxyFormation[1]);
    expect(EFFECTS.tipToCore).toEqual([TRANSITIONS.galaxyFormation[0], EFFECTS.galaxyZoom[0]]);
  });
});

describe("percurso geral da câmera", () => {
  const pos: [number, number, number] = [0, 0, 0];
  const tgt: [number, number, number] = [0, 0, 0];

  it("keyframes em ordem, de 0 a 1", () => {
    expect(CAMERA_KEYS[0].p).toBe(0);
    expect(CAMERA_KEYS[CAMERA_KEYS.length - 1].p).toBe(1);
    for (let i = 1; i < CAMERA_KEYS.length; i += 1) expect(CAMERA_KEYS[i].p).toBeGreaterThanOrEqual(CAMERA_KEYS[i - 1].p);
  });

  it("a estrada é vista rente ao chão, de cima da centerline, olhando para a fuga", () => {
    const p = (TRANSITIONS.dnaToRoad[1] + TRANSITIONS.fold[0]) / 2;
    sampleCamera(p, pos, tgt);
    expect(pos[0]).toBe(0);
    expect(pos[1]).toBeCloseTo(TUNNEL_AXIS_Y, 9);
    expect(pos[1]).toBeLessThan(1);
    expect(tgt[2]).toBeLessThan(-15);
  });

  it("com o túnel fechado a câmera está no eixo", () => {
    sampleCamera(TRANSITIONS.fold[1], pos, tgt);
    expect(pos[1]).toBeCloseTo(TUNNEL_AXIS_Y, 3);
  });

  it("nenhum keyframe transforma o objeto nem reage ao ponteiro: só posição e alvo", () => {
    for (const k of CAMERA_KEYS) {
      expect(Object.keys(k).sort()).toEqual(["p", "position", "target"]);
    }
  });

  it("o percurso é contínuo, sem salto de câmera", () => {
    let anterior: number[] | null = null;
    for (let i = 0; i <= 1000; i += 1) {
      sampleCamera(i / 1000, pos, tgt);
      if (anterior) {
        expect(Math.hypot(pos[0] - anterior[0], pos[1] - anterior[1], pos[2] - anterior[2])).toBeLessThan(0.9);
      }
      anterior = [...pos];
    }
  });
});
