import { describe, expect, it } from "vitest";

import { PARTICLE_BUDGET, buildShapes, resolveParticleCount } from "./index";
import { foldRoadPoint } from "./kinematics";
import { STREAK_COUNT, createHelixShapes } from "./helix";
import { createGalaxyHashes } from "./galaxy";
import { LANES, createRoad } from "./road";
import { mulberry32 } from "./random";
import { permute, sortBySpatialKey, spatialOrder } from "./normalizeTargets";
import {
  ROAD_FAR_Z,
  ROAD_HALF_WIDTH,
  TUNNEL_AXIS_Y,
  TUNNEL_RADIUS,
} from "./sceneConfig";

const COUNT = 3000;

function radialXZ(target: Float32Array, i: number): number {
  return Math.hypot(target[i], target[i + 2]);
}

/** A mesma dobra do vertex shader (espelho em kinematics.ts). */
const foldRoad = (x: number, y: number, z: number, f: number) => foldRoadPoint(x, y, z, f);

describe("formas de partículas", () => {
  it("todas as formas e atributos têm a mesma contagem", () => {
    const s = buildShapes(COUNT);
    for (const t of [s.orb, s.cylinder, s.dna, s.road]) expect(t.length).toBe(COUNT * 3);
    for (const a of [s.seeds, s.scales, s.band, s.phase, s.lane]) expect(a.length).toBe(COUNT);
    expect(s.galaxyHash.length).toBe(COUNT * 4);
  });

  it("é determinística", () => {
    const a = buildShapes(COUNT);
    const b = buildShapes(COUNT);
    expect(Array.from(a.dna.slice(0, 90))).toEqual(Array.from(b.dna.slice(0, 90)));
    expect(Array.from(a.road.slice(0, 90))).toEqual(Array.from(b.road.slice(0, 90)));
  });

  it("não produz coordenada inválida", () => {
    const s = buildShapes(COUNT);
    for (const t of [s.orb, s.cylinder, s.dna, s.road, s.galaxyHash]) {
      for (let i = 0; i < t.length; i += 1) expect(Number.isFinite(t[i])).toBe(true);
    }
  });
});

describe("orbe", () => {
  it("mantém o miolo aberto para o texto", () => {
    const orbe = buildShapes(COUNT).orb;
    const raios: number[] = [];
    for (let i = 0; i < orbe.length; i += 3) raios.push(Math.hypot(orbe[i], orbe[i + 1]));
    const maior = Math.max(...raios);
    expect(raios.filter((r) => r < maior * 0.35).length / raios.length).toBeLessThan(0.05);
  });

  it("tem volume: não é um anel plano", () => {
    const orbe = buildShapes(COUNT).orb;
    let zMax = 0;
    for (let i = 2; i < orbe.length; i += 3) zMax = Math.max(zMax, Math.abs(orbe[i]));
    expect(zMax).toBeGreaterThan(0.3);
  });
});

describe("cilindro e hélice", () => {
  it("o cilindro tem raio constante de cima a baixo", () => {
    const { cylinder, band } = createHelixShapes(COUNT);
    const faixas: number[][] = [[], [], [], [], []];
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 1; i < cylinder.length; i += 3) {
      yMin = Math.min(yMin, cylinder[i]);
      yMax = Math.max(yMax, cylinder[i]);
    }
    for (let i = 0; i < COUNT; i += 1) {
      if (band[i] === 0) continue; // riscos ficam na superficie
      const f = Math.min(4, Math.floor(((cylinder[i * 3 + 1] - yMin) / (yMax - yMin)) * 5));
      faixas[f].push(radialXZ(cylinder, i * 3));
    }
    const medias = faixas.map((xs) => xs.reduce((a, b) => a + b, 0) / xs.length);
    const ref = medias[2];
    // Cone teria raio crescendo faixa a faixa; aqui todas ficam em +-5%.
    for (const m of medias) expect(Math.abs(m - ref) / ref).toBeLessThan(0.05);
  });

  it("tem oito riscos: dois principais mais intensos e seis secundários", () => {
    expect(STREAK_COUNT).toBe(8);
    const { band } = createHelixShapes(COUNT);
    const principais = Array.from(band).filter((b) => b === 1).length;
    const secundarios = Array.from(band).filter((b) => b > 0 && b < 1).length;
    expect(principais).toBeGreaterThan(COUNT * 0.15);
    expect(secundarios).toBeGreaterThan(COUNT * 0.15);
  });

  it("todo risco vira haste do DNA, e cada secundário converge numa das duas", () => {
    const { dna, band } = createHelixShapes(COUNT);
    let maior = 0;
    for (let i = 0; i < COUNT; i += 1) maior = Math.max(maior, radialXZ(dna, i * 3));
    let riscos = 0;
    let naHaste = 0;
    for (let i = 0; i < COUNT; i += 1) {
      if (band[i] === 0) continue;
      riscos += 1;
      if (radialXZ(dna, i * 3) > maior * 0.88) naHaste += 1;
    }
    expect(naHaste / riscos).toBeGreaterThan(0.95);
  });

  it("o corpo do cilindro vira os degraus, que cruzam o eixo", () => {
    const { dna, band } = createHelixShapes(COUNT);
    let maior = 0;
    for (let i = 0; i < COUNT; i += 1) maior = Math.max(maior, radialXZ(dna, i * 3));
    let perto = 0;
    let corpo = 0;
    for (let i = 0; i < COUNT; i += 1) {
      if (band[i] !== 0) continue;
      corpo += 1;
      if (radialXZ(dna, i * 3) < maior * 0.4) perto += 1;
    }
    expect(perto / corpo).toBeGreaterThan(0.3);
  });

  it("expõe a altura da geometria para o esticamento pela câmera", () => {
    const { height } = createHelixShapes(COUNT);
    expect(height).toBeGreaterThan(5);
  });
});

describe("estrada e dobra", () => {
  it("se estende até o ponto de fuga e usa a largura inteira", () => {
    const { positions } = createRoad(COUNT);
    let menorZ = Infinity;
    let maiorX = 0;
    for (let i = 0; i < positions.length; i += 3) {
      menorZ = Math.min(menorZ, positions[i + 2]);
      maiorX = Math.max(maiorX, Math.abs(positions[i]));
    }
    expect(menorZ).toBeLessThan(ROAD_FAR_Z + 2);
    expect(maiorX).toBeGreaterThan(ROAD_HALF_WIDTH * 0.97);
  });

  it("tem faixas longitudinais e bordas mais densas", () => {
    const { positions, lane } = createRoad(COUNT);
    const emFaixa = Array.from(lane).filter((v) => v === 1).length;
    expect(emFaixa / COUNT).toBeGreaterThan(0.45);
    // As faixas caem em posicoes laterais discretas.
    const xs = new Set<number>();
    for (let i = 0; i < COUNT; i += 1) {
      if (lane[i] === 1 && Math.abs(positions[i * 3]) < ROAD_HALF_WIDTH * 0.9) {
        xs.add(Math.round((positions[i * 3] / ROAD_HALF_WIDTH) * (LANES - 1)));
      }
    }
    expect(xs.size).toBeGreaterThanOrEqual(LANES - 2);
  });

  it("tem massa no primeiro plano", () => {
    const { positions } = createRoad(COUNT);
    let perto = 0;
    for (let i = 2; i < positions.length; i += 3) if (positions[i] > -6) perto += 1;
    expect(perto / COUNT).toBeGreaterThan(0.14);
  });

  it("fold=0 devolve a posição original", () => {
    const [x, y, z] = foldRoad(2.1, -0.4, -12, 0);
    expect(x).toBeCloseTo(2.1, 2);
    expect(y).toBeCloseTo(-0.4, 2);
    expect(z).toBe(-12);
  });

  it("fold=1 leva as duas bordas ao mesmo ponto: no topo em z=0, em hélice ao longo do túnel", () => {
    for (const z of [0, -12, -30]) {
      const esq = foldRoad(-ROAD_HALF_WIDTH, -0.55, z, 1);
      const dir = foldRoad(ROAD_HALF_WIDTH, -0.55, z, 1);
      expect(esq[0]).toBeCloseTo(dir[0], 5);
      expect(esq[1]).toBeCloseTo(dir[1], 5);
    }
    const topo = foldRoad(ROAD_HALF_WIDTH, -0.55, 0, 1);
    expect(topo[1]).toBeCloseTo(TUNNEL_AXIS_Y + TUNNEL_RADIUS, 4);
  });

  it("fold=1 põe todo ponto a distância R do eixo", () => {
    for (const x of [-4.2, -2, 0, 1.3, 3.7]) {
      const [px, py] = foldRoad(x, -0.55, -20, 1);
      expect(Math.hypot(px, py - TUNNEL_AXIS_Y)).toBeCloseTo(TUNNEL_RADIUS, 4);
    }
  });

  it("a dobra é contínua", () => {
    let anterior = foldRoad(3, -0.55, -10, 0);
    for (let i = 1; i <= 100; i += 1) {
      const atual = foldRoad(3, -0.55, -10, i / 100);
      expect(Math.hypot(atual[0] - anterior[0], atual[1] - anterior[1])).toBeLessThan(0.15);
      anterior = atual;
    }
  });
});

describe("galáxia: só hashes fixos por partícula", () => {
  it("quatro aleatórios em [0, 1) por partícula, determinísticos", () => {
    const a = createGalaxyHashes(COUNT);
    const b = createGalaxyHashes(COUNT);
    expect(a.length).toBe(COUNT * 4);
    expect(a).toEqual(b);
    for (let i = 0; i < a.length; i += 1) {
      expect(a[i]).toBeGreaterThanOrEqual(0);
      expect(a[i]).toBeLessThan(1);
    }
  });
});

describe("correspondência espacial", () => {
  it("ordena por azimute", () => {
    const sorted = sortBySpatialKey(new Float32Array([1, 0, 0, -1, 0, 0, 0, 0, 1]));
    const az: number[] = [];
    for (let i = 0; i < sorted.length; i += 3) az.push(Math.atan2(sorted[i + 2], sorted[i]));
    expect(az).toEqual([...az].sort((a, b) => a - b));
  });

  it("a mesma permutação vale para atributos de outra largura", () => {
    const pos = new Float32Array([1, 0, 0, -1, 0, 0, 0, 0, 1]);
    const tag = new Float32Array([10, 20, 30]);
    const order = spatialOrder(pos);
    const sortedTag = permute(tag, order, 1);
    for (let i = 0; i < 3; i += 1) expect(sortedTag[i]).toBe(tag[order[i]]);
  });
});

describe("gerador determinístico", () => {
  it("repete a sequência para a mesma seed", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("contagem adaptativa", () => {
  it("fica na faixa do orçamento: 20k+ mobile fraco, ate 72k desktop forte", () => {
    const count = resolveParticleCount();
    expect(count).toBeGreaterThanOrEqual(PARTICLE_BUDGET.mobileWeak);
    expect(count).toBeLessThanOrEqual(PARTICLE_BUDGET.desktopStrong);
    expect(PARTICLE_BUDGET.mobileWeak).toBeGreaterThanOrEqual(16000);
  });
});
