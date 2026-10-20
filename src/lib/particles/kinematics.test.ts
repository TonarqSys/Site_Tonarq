import { describe, expect, it } from "vitest";

import { createOrb } from "./orb";
import { createRoad } from "./road";
import { createGalaxyHashes } from "./galaxy";
import { buildShapes } from "./index";
import { mulberry32 } from "./random";
import {
  HALO_RANK,
  cameraDistanceFromCore,
  coreOverlapEstimate,
  foldRoadPoint,
  galaxyFromTube,
  galaxyRank,
  galaxyRegion,
  orbFlowDisplacement,
  releaseWeight,
  roadEndFade,
  roadFlowSpeed,
  roadFlowZ,
  roadLateralOffset,
  smootherstep,
  streakLengthPx,
  traversalCameraZ,
  tubeAngle01,
  tubeDepth,
  tubeSpin,
  type Vec3,
  type Vec4,
} from "./kinematics";
import {
  FRAME,
  GALAXY,
  GALAXY_BASIS,
  GALAXY_CENTER,
  GALAXY_REVEAL_DISTANCE,
  HYPER,
  ORB_FLOW,
  ROAD_BASE_Y,
  ROAD_FAR_Z,
  ROAD_FLOW,
  ROAD_HALF_WIDTH,
  ROAD_NEAR_Z,
  TIP_DISTANCE,
  TUNNEL_AXIS_Y,
  TUNNEL_RADIUS,
  TUNNEL_TIP_Z,
  centerlinePoint,
} from "./sceneConfig";

const COUNT = 4000;
const deg = (rad: number) => (rad * 180) / Math.PI;
const dist = (a: number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function angleBetween(a: number[], b: number[]): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.min(1, Math.max(-1, dot / (Math.hypot(...a) * Math.hypot(...b)))));
}

/** Direção da linha média de uma nuvem ao longo de z: centros das fatias. */
function centerlineDirection(points: Float32Array, bins = 8): number[] {
  const sums = Array.from({ length: bins }, () => [0, 0, 0, 0]);
  for (let i = 0; i < points.length; i += 3) {
    const z = points[i + 2];
    const k = Math.min(bins - 1, Math.floor(((ROAD_NEAR_Z - z) / (ROAD_NEAR_Z - ROAD_FAR_Z)) * bins));
    sums[k][0] += points[i];
    sums[k][1] += points[i + 1];
    sums[k][2] += z;
    sums[k][3] += 1;
  }
  const first = sums[0].map((v) => v / sums[0][3]);
  const last = sums[bins - 1].map((v) => v / sums[bins - 1][3]);
  return [last[0] - first[0], last[1] - first[1], last[2] - first[2]];
}

/** Amostra de partículas galácticas com hashes aleatórios e ranks uniformes. */
function sampleGalaxy(n: number, time = 0, rankMin = 0, rankMax = 1) {
  const rand = mulberry32(11);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const rank = rankMin + rand() * (rankMax - rankMin);
    const h: Vec4 = [rand(), rand(), rand(), rand()];
    out.push(galaxyFromTube(1 - rank, rand(), h, time));
  }
  return out;
}

describe("referencial compartilhado: estrada, túnel, núcleo e câmera", () => {
  const road = createRoad(COUNT).positions;
  const tube = new Float32Array(road.length);
  for (let i = 0; i < road.length; i += 3) {
    const [x, y, z] = foldRoadPoint(road[i], road[i + 1], road[i + 2], 1);
    tube[i] = x;
    tube[i + 1] = y;
    tube[i + 2] = z;
  }

  it("o vetor da estrada e o eixo do cilindro diferem menos de 2 graus, e ambos seguem o forward", () => {
    const roadDir = centerlineDirection(road);
    const tubeDir = centerlineDirection(tube);
    expect(deg(angleBetween(roadDir, tubeDir))).toBeLessThan(2);
    expect(deg(angleBetween(roadDir, [...FRAME.forward]))).toBeLessThan(2);
    expect(deg(angleBetween(tubeDir, [...FRAME.forward]))).toBeLessThan(2);
  });

  it("estrada centrada em x = 0 e túnel com eixo em (0, TUNNEL_AXIS_Y)", () => {
    let sx = 0;
    let tx = 0;
    let ty = 0;
    for (let i = 0; i < road.length; i += 3) {
      sx += road[i];
      tx += tube[i];
      ty += tube[i + 1];
    }
    expect(Math.abs(sx / COUNT)).toBeLessThan(0.15);
    expect(Math.abs(tx / COUNT)).toBeLessThan(0.15);
    expect(Math.abs(ty / COUNT - TUNNEL_AXIS_Y)).toBeLessThan(0.15);
  });

  it("o raio do cilindro é o mesmo no início, no meio e no fim, com ou sem giro", () => {
    for (const z of [ROAD_NEAR_Z, (ROAD_NEAR_Z + ROAD_FAR_Z) / 2, ROAD_FAR_Z]) {
      for (const x of [-ROAD_HALF_WIDTH, -1.7, 0, 2.9, ROAD_HALF_WIDTH]) {
        for (const t of [0, 7.5]) {
          const [px, py] = foldRoadPoint(x, ROAD_BASE_Y, z, 1, t);
          expect(Math.hypot(px, py - TUNNEL_AXIS_Y)).toBeCloseTo(TUNNEL_RADIUS, 6);
        }
      }
    }
  });

  it("o núcleo da galáxia é a ponta final do cilindro, sobre a centerline", () => {
    expect(TUNNEL_TIP_Z).toBe(ROAD_FAR_Z);
    expect([...GALAXY_CENTER]).toEqual(centerlinePoint(TUNNEL_TIP_Z));
  });

  it("a dobra preserva a coordenada longitudinal e aplica o relevo pela normal", () => {
    for (const fold of [0, 0.3, 0.85, 1]) {
      expect(foldRoadPoint(1.2, ROAD_BASE_Y + 0.3, -17.5, fold)[2]).toBe(-17.5);
    }
    const fora = foldRoadPoint(2, ROAD_BASE_Y - 0.5, -10, 1);
    const dentro = foldRoadPoint(2, ROAD_BASE_Y + 0.3, -10, 1);
    expect(Math.hypot(fora[0], fora[1] - TUNNEL_AXIS_Y)).toBeCloseTo(TUNNEL_RADIUS + 0.5, 6);
    expect(Math.hypot(dentro[0], dentro[1] - TUNNEL_AXIS_Y)).toBeCloseTo(TUNNEL_RADIUS - 0.3, 6);
  });

  it("o halo lateral da estrada passa das bordas com densidade caindo, sem reta visível", () => {
    const bins = [0, 0, 0];
    const W = ROAD_HALF_WIDTH;
    for (let i = 0; i < road.length; i += 3) {
      const ax = Math.abs(road[i]);
      if (ax > W && ax <= 1.2 * W) bins[0] += 1;
      else if (ax > 1.2 * W && ax <= 1.4 * W) bins[1] += 1;
      else if (ax > 1.4 * W) bins[2] += 1;
    }
    expect(bins[0]).toBeGreaterThan(bins[1]);
    expect(bins[1]).toBeGreaterThan(bins[2]);
    expect(bins[2]).toBeGreaterThan(0);
    // Dobrado, o halo lateral continua o arco em vez de se amontoar na costura.
    const p = foldRoadPoint(1.3 * W, ROAD_BASE_Y - 0.3, -10, 1);
    expect(Math.hypot(p[0], p[1] - TUNNEL_AXIS_Y)).toBeCloseTo(TUNNEL_RADIUS + 0.3, 6);
    expect(Math.abs(Math.atan2(p[0], -(p[1] - TUNNEL_AXIS_Y)))).toBeLessThan(Math.PI);
  });

  it("o tubo gira devagar com o tempo, só quando fechado: nunca congela", () => {
    expect(tubeSpin(10, 0.5)).toBe(0);
    expect(tubeSpin(10, 1)).toBeGreaterThan(0);
    expect(tubeSpin(10, 1)).toBeLessThan(0.5);
    const a = foldRoadPoint(1, ROAD_BASE_Y, -10, 1, 0);
    const b = foldRoadPoint(1, ROAD_BASE_Y, -10, 1, 1);
    expect(dist(a, b)).toBeGreaterThan(0.01);
    expect(dist(a, b)).toBeLessThan(0.1);
  });
});

describe("fluxo da estrada (tempo, não scroll)", () => {
  const { positions, lane } = createRoad(COUNT);
  const { seeds } = buildShapes(COUNT);

  it("as partículas se movem com o scroll parado", () => {
    let moved = 0;
    for (let i = 0; i < COUNT; i += 1) {
      const a = roadFlowZ(positions[i * 3 + 2], seeds[i], lane[i], 1.0);
      const b = roadFlowZ(positions[i * 3 + 2], seeds[i], lane[i], 1.5);
      if (Math.abs(a - b) > 1e-6) moved += 1;
    }
    expect(moved).toBe(COUNT);
  });

  it("o movimento médio segue o eixo longitudinal (-Z), com ruído lateral ínfimo", () => {
    const dt = 0.25;
    const sum = [0, 0, 0];
    for (let i = 0; i < COUNT; i += 1) {
      const z0 = positions[i * 3 + 2];
      const zA = roadFlowZ(z0, seeds[i], lane[i], 3);
      const zB = roadFlowZ(z0, seeds[i], lane[i], 3 + dt);
      if (zB > zA) continue;
      sum[0] += roadLateralOffset(seeds[i], 3 + dt) - roadLateralOffset(seeds[i], 3);
      sum[2] += zB - zA;
    }
    expect(deg(angleBetween(sum, [...FRAME.forward]))).toBeLessThan(1);
    expect(ROAD_FLOW.lateral).toBeLessThanOrEqual(0.05);
  });

  it("velocidades ligeiramente diferentes por partícula, todas para a frente", () => {
    const v = [roadFlowSpeed(0, 0), roadFlowSpeed(1, 0), roadFlowSpeed(0.5, 1)];
    expect(new Set(v.map((x) => x.toFixed(4))).size).toBe(3);
    for (const s of v) expect(s).toBeGreaterThan(0);
    for (let i = 0; i < 200; i += 1) {
      const zA = roadFlowZ(positions[i * 3 + 2], seeds[i], lane[i], 10);
      const zB = roadFlowZ(positions[i * 3 + 2], seeds[i], lane[i], 10.01);
      if (zB > zA) continue;
      expect(zB).toBeLessThan(zA);
    }
  });

  it("recicla sem teleporte visível: alpha zero exatamente nas duas pontas", () => {
    expect(roadEndFade(ROAD_NEAR_Z)).toBe(0);
    expect(roadEndFade(ROAD_FAR_Z)).toBe(0);
    expect(roadEndFade((ROAD_NEAR_Z + ROAD_FAR_Z) / 2)).toBe(1);
    for (let i = 0; i < 300; i += 1) {
      const z0 = positions[i * 3 + 2];
      let prev = roadFlowZ(z0, seeds[i], lane[i], 0);
      for (let t = 0.05; t < 30; t += 0.05) {
        const z = roadFlowZ(z0, seeds[i], lane[i], t);
        if (z > prev) {
          expect(prev).toBeLessThan(ROAD_FAR_Z + 0.2);
          expect(z).toBeGreaterThan(ROAD_NEAR_Z - 0.2);
        }
        prev = z;
      }
    }
  });

  it("é periódico: tempo não altera permanentemente a posição base", () => {
    const period = (ROAD_NEAR_Z - ROAD_FAR_Z) / roadFlowSpeed(0.3, 0);
    expect(roadFlowZ(-5, 0.3, 0, 0)).toBeCloseTo(-5, 6);
    expect(roadFlowZ(-5, 0.3, 0, period)).toBeCloseTo(-5, 4);
  });
});

describe("hipertúnel: riscos pela velocidade projetada", () => {
  it("perto e rápido vira risco longo; longe fica ponto; nunca passa do máximo", () => {
    const speed = HYPER.peak * ROAD_FLOW.speed;
    const near = streakLengthPx(400, 2, speed);
    const far = streakLengthPx(20, 30, speed);
    expect(near).toBeGreaterThan(far * 10);
    expect(far).toBeLessThan(1);
    expect(streakLengthPx(2000, 0.6, speed)).toBe(HYPER.streakMax);
    expect(streakLengthPx(2000, 0.6, speed, 2)).toBe(HYPER.streakMax * 2);
    // No fluxo normal da estrada o risco e desprezivel.
    expect(streakLengthPx(400, 2, ROAD_FLOW.speed)).toBeLessThanOrEqual(HYPER.streakMax * 0.3);
    expect(streakLengthPx(400, 2, 0)).toBe(0);
  });
});

describe("nascimento da galáxia a partir da ponta do cilindro", () => {
  const H: Vec4 = [0.3, 0.5, 0.2, 0.5];
  const hashes = createGalaxyHashes(COUNT);
  const hashAt = (i: number): Vec4 => [hashes[i * 4], hashes[i * 4 + 1], hashes[i * 4 + 2], hashes[i * 4 + 3]];

  it("com progresso zero nada é galáxia; a ponta parte primeiro e a entrada por último", () => {
    for (const rank of [0, 0.1, 0.5, 0.9, 1]) expect(releaseWeight(rank, 0)).toBe(0);
    expect(releaseWeight(0, 0.05)).toBeGreaterThan(0);
    expect(releaseWeight(0.5, 0.05)).toBe(0);
    expect(releaseWeight(1, 0.75)).toBe(0);
    for (const rank of [0, 0.5, 1]) expect(releaseWeight(rank, 1)).toBe(1);
    for (let g = 0; g < 1; g += 0.01) {
      expect(releaseWeight(0.4, g + 0.01)).toBeGreaterThanOrEqual(releaseWeight(0.4, g));
      expect(releaseWeight(0.3, g)).toBeGreaterThanOrEqual(releaseWeight(0.6, g));
    }
  });

  it("as primeiras partículas liberadas estão na ponta do túnel e viram o centro do núcleo", () => {
    for (const z of [ROAD_FAR_Z, ROAD_FAR_Z + 0.2, ROAD_FAR_Z + 0.4]) {
      const depth = tubeDepth(z);
      expect(galaxyRank(depth)).toBeLessThan(0.011);
      const g = galaxyFromTube(depth, 0.3, H, 0);
      expect(dist(g.position, GALAXY_CENTER)).toBeLessThan(0.15);
      expect(releaseWeight(galaxyRank(depth), 0)).toBe(0);
    }
  });

  it("formação de dentro para fora: núcleo e bojo, disco e braços, por último o halo", () => {
    let prev = -1;
    for (let rank = 0; rank < HALO_RANK; rank += 0.002) {
      const g = galaxyFromTube(1 - rank, 0.3, H, 0);
      expect(g.r).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = g.r;
    }
    const order = ["bojo", "disco", "halo"];
    let regionIndex = 0;
    for (let rank = 0; rank <= 1; rank += 0.002) {
      const idx = order.indexOf(galaxyRegion(rank));
      expect(idx).toBeGreaterThanOrEqual(regionIndex);
      regionIndex = idx;
    }
    expect(galaxyRegion(0)).toBe("bojo");
    expect(galaxyRegion(GALAXY.coreShare - 1e-6)).toBe("bojo");
    expect(galaxyRegion(0.5)).toBe("disco");
    expect(galaxyRegion(HALO_RANK)).toBe("halo");
    expect(galaxyFromTube(1 - (GALAXY.coreShare - 1e-6), 0.3, H, 0).r).toBeLessThanOrEqual(GALAXY.coreFraction);
    expect(GALAXY.coreShare).toBeCloseTo(0.2, 9);
    expect(GALAXY.armShare).toBeCloseTo(0.55, 9);
    expect(GALAXY.haloShare).toBeCloseTo(0.1, 9);
  });

  it("os braços espirais são detectáveis: contraste angular alto ao remover o enrolamento", () => {
    const { u, w } = GALAXY_BASIS;
    const bins = new Array(12).fill(0);
    for (const g of sampleGalaxy(8000, 0, GALAXY.coreShare + 0.05, HALO_RANK - 0.02)) {
      const d = [g.position[0] - GALAXY_CENTER[0], g.position[1] - GALAXY_CENTER[1], g.position[2] - GALAXY_CENTER[2]];
      const x = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
      const z = d[0] * w[0] + d[1] * w[1] + d[2] * w[2];
      const az = Math.atan2(z, x);
      const period = (Math.PI * 2) / GALAXY.arms;
      let phi = (az - g.r * GALAXY.twist) % period;
      if (phi < 0) phi += period;
      bins[Math.min(11, Math.floor((phi / period) * 12))] += 1;
    }
    const max = Math.max(...bins);
    const min = Math.min(...bins);
    expect(max / Math.max(min, 1)).toBeGreaterThan(2.5);
    expect(sampleGalaxy(2000, 0, GALAXY.coreShare + 0.05, HALO_RANK - 0.02).filter((g) => g.arm === 1).length / 2000).toBeGreaterThan(0.7);
  });

  it("a densidade cai organicamente nas extremidades: cauda sem borda nem degrau", () => {
    const bins = new Array(20).fill(0);
    for (const g of sampleGalaxy(40000)) bins[Math.min(19, Math.floor(g.r * 10))] += 1;
    const peak = Math.max(...bins);
    const peakIndex = bins.indexOf(peak);
    for (let i = Math.max(peakIndex, 3); i < 19; i += 1) {
      if (bins[i] < peak * 0.01) break;
      expect(bins[i + 1]).toBeLessThanOrEqual(bins[i] * 1.15);
      expect(bins[i + 1]).toBeGreaterThanOrEqual(bins[i] * 0.15);
    }
    // Existe materia alem da borda do disco, e cada vez menos.
    expect(bins[10] + bins[11]).toBeGreaterThan(0);
    expect(bins[13]).toBeLessThan(bins[11]);
  });

  it("nasce já inclinada no plano fixo: o plano médio do disco não muda com o tempo", () => {
    const normalAt = (time: number) => {
      const c = [0, 0, 0];
      const pts: Vec3[] = [];
      for (let i = 0; i < 240; i += 1) {
        const p = galaxyFromTube(0.35, i / 240, [i / 240, 0.5, 0.9, 0.5], time).position;
        pts.push(p);
        c[0] += p[0] / 240;
        c[1] += p[1] / 240;
        c[2] += p[2] / 240;
      }
      const n = [0, 0, 0];
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i].map((v, k) => v - c[k]);
        const b = pts[(i + 1) % pts.length].map((v, k) => v - c[k]);
        n[0] += a[1] * b[2] - a[2] * b[1];
        n[1] += a[2] * b[0] - a[0] * b[2];
        n[2] += a[0] * b[1] - a[1] * b[0];
      }
      return n;
    };
    for (const t of [0, 4, 9, 33]) {
      expect(Math.abs(Math.cos(angleBetween(normalAt(t), [...GALAXY_BASIS.n])))).toBeGreaterThan(0.9999);
    }
    const tilt = Math.asin(Math.abs(GALAXY_BASIS.n[2]));
    expect(deg(tilt)).toBeGreaterThanOrEqual(25);
    expect(deg(tilt)).toBeLessThanOrEqual(35);
    expect(deg(tilt)).toBeCloseTo(deg(GALAXY.tilt), 9);
  });

  it("com scroll parado, as partículas orbitam devagar: centro e raio fixos, interior mais rápido", () => {
    const { u, w } = GALAXY_BASIS;
    const azimuth = (p: Vec3) => {
      const d = [p[0] - GALAXY_CENTER[0], p[1] - GALAXY_CENTER[1], p[2] - GALAXY_CENTER[2]];
      const x = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
      const z = d[0] * w[0] + d[1] * w[1] + d[2] * w[2];
      return { az: Math.atan2(z, x), r: Math.hypot(x, z) };
    };
    const dt = 5;
    const speeds: number[] = [];
    for (const rank of [0.3, 0.85]) {
      const p0 = galaxyFromTube(1 - rank, 0.3, [0.3, 0.5, 0.9, 0.5], 0);
      const p1 = galaxyFromTube(1 - rank, 0.3, [0.3, 0.5, 0.9, 0.5], dt);
      expect(dist(p0.position, p1.position)).toBeGreaterThan(0.01);
      const a0 = azimuth(p0.position);
      const a1 = azimuth(p1.position);
      expect(a1.r).toBeCloseTo(a0.r, 9);
      let daz = a1.az - a0.az;
      if (daz < -Math.PI) daz += Math.PI * 2;
      const omega = daz / dt;
      expect(omega).toBeGreaterThanOrEqual(GALAXY.spinOuter - 1e-9);
      expect(omega).toBeLessThanOrEqual(GALAXY.spinInner + 1e-9);
      speeds.push(omega);
    }
    expect(speeds[0]).toBeGreaterThan(speeds[1]);
    expect(GALAXY.spinInner).toBeLessThanOrEqual(0.1);
  });

  it("todas as partículas do túnel cabem na galáxia, halo incluído", () => {
    const road = createRoad(COUNT).positions;
    let maxDist = 0;
    for (let i = 0; i < COUNT; i += 1) {
      const depth = tubeDepth(road[i * 3 + 2]);
      const g = galaxyFromTube(depth, tubeAngle01(road[i * 3], road[i * 3 + 2]), hashAt(i), 3);
      maxDist = Math.max(maxDist, dist(g.position, GALAXY_CENTER));
    }
    expect(maxDist).toBeLessThanOrEqual(GALAXY.radius * GALAXY.haloMax * 1.15);
  });

  it("a distância da câmera ao núcleo só cresce durante o zoom out", () => {
    expect(cameraDistanceFromCore(0)).toBe(TIP_DISTANCE);
    expect(cameraDistanceFromCore(1)).toBeCloseTo(GALAXY_REVEAL_DISTANCE, 9);
    let prev = 0;
    for (let g = 0; g <= 1; g += 0.001) {
      const d = cameraDistanceFromCore(g);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
    expect(traversalCameraZ(1)).toBe(TUNNEL_TIP_Z + TIP_DISTANCE);
  });

  it("o centro do bojo não satura: cobertura aditiva estimada entre 0.15 e 1.0 perto e longe", () => {
    for (const d of [TIP_DISTANCE, 8, GALAXY_REVEAL_DISTANCE]) {
      const overlap = coreOverlapEstimate(72000, d, 900);
      expect(overlap).toBeGreaterThan(0.15);
      expect(overlap).toBeLessThan(1.0);
    }
  });
});

describe("orbe: fluxo lento e contido", () => {
  const orb = createOrb(COUNT);
  const { seeds } = buildShapes(COUNT);
  const N = 600;
  const STRIDE = Math.floor(COUNT / N);

  it("a velocidade máxima de uma partícula fica abaixo do limite", () => {
    const dt = 1 / 60;
    let max = 0;
    let sum = 0;
    let n = 0;
    for (const t of [0, 1.3, 4.7, 9.2, 15.5]) {
      for (let k = 0; k < N; k += 1) {
        const i = k * STRIDE;
        const p: Vec3 = [orb[i * 3], orb[i * 3 + 1], orb[i * 3 + 2]];
        const a = orbFlowDisplacement(p, seeds[i], t);
        const b = orbFlowDisplacement(p, seeds[i], t + dt);
        const v = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / dt;
        max = Math.max(max, v);
        sum += v;
        n += 1;
      }
    }
    expect(max).toBeLessThanOrEqual(ORB_FLOW.maxSpeed);
    expect(sum / n).toBeLessThan(ORB_FLOW.maxSpeed * 0.35);
  });

  it("a amplitude é limitada e a orbe não gira como corpo rígido", () => {
    const bound = ORB_FLOW.amplitude * (1 + ORB_FLOW.secondOctave) * Math.sqrt(3);
    const dt = 1 / 30;
    let alongSum = 0;
    let speedSum = 0;
    let n = 0;
    for (let t = 0; t <= 90; t += 6) {
      for (let k = 0; k < N; k += 1) {
        const i = k * STRIDE;
        const p: Vec3 = [orb[i * 3], orb[i * 3 + 1], orb[i * 3 + 2]];
        const a = orbFlowDisplacement(p, seeds[i], t);
        const b = orbFlowDisplacement(p, seeds[i], t + dt);
        expect(Math.hypot(...a)).toBeLessThanOrEqual(bound);
        const v = [(b[0] - a[0]) / dt, (b[1] - a[1]) / dt, (b[2] - a[2]) / dt];
        const uu = Math.atan2(p[1], p[0]);
        alongSum += -Math.sin(uu) * v[0] + Math.cos(uu) * v[1];
        speedSum += Math.hypot(...v);
        n += 1;
      }
    }
    expect(Math.abs(alongSum / n) / (speedSum / n)).toBeLessThan(0.1);
  });

  it("sem fluxo, a partícula está exatamente na posição base", () => {
    const p: Vec3 = [orb[0], orb[1], orb[2]];
    const d = orbFlowDisplacement(p, seeds[0], 3, { ...ORB_FLOW, amplitude: 0 });
    expect(d.map((v) => Math.abs(v))).toEqual([0, 0, 0]);
  });
});

describe("smootherstep", () => {
  it("6t^5 - 15t^4 + 10t^3, com derivadas nulas nas pontas", () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 12);
    expect(smootherstep(0.25)).toBeCloseTo(0.103515625, 12);
    const h = 1e-4;
    expect((smootherstep(h) - smootherstep(0)) / h).toBeLessThan(1e-6);
    expect((smootherstep(1) - smootherstep(1 - h)) / h).toBeLessThan(1e-6);
    expect((smootherstep(2 * h) - 2 * smootherstep(h) + smootherstep(0)) / (h * h)).toBeLessThan(1e-2);
  });
});
