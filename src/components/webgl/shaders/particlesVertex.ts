// Fonte GLSL como modulo TypeScript: sem loader, identico em Turbopack,
// webpack e Vitest. ATENCAO: nenhuma crase dentro do GLSL.
//
// Constantes de movimento vem de sceneConfig e sao gravadas como literais:
// o mesmo numero que os testes usam nos espelhos em TypeScript.
import {
  CORE_ATTENUATION,
  GALAXY,
  GALAXY_BASIS,
  HYPER,
  ORB_FLOW,
  ROAD_FAR_Z,
  ROAD_FLOW,
  ROAD_LENGTH,
  ROAD_NEAR_Z,
  TUNNEL_TWIST,
  TURBULENCE,
} from "@/lib/particles/sceneConfig";

/** Literal float GLSL (sempre com ponto decimal). */
const f = (v: number) => v.toFixed(6);
const v3 = (v: readonly [number, number, number]) => `vec3(${f(v[0])}, ${f(v[1])}, ${f(v[2])})`;
const HALO_RANK = 1 - GALAXY.haloShare;
const ARM_FRACTION = GALAXY.armShare / (HALO_RANK - GALAXY.coreShare);

export const particlesVertexShader = /* glsl */ `
// Morphing entre quatro formas, mais a dobra analitica da estrada em tunel,
// o hipertunel e o nascimento procedural da galaxia a partir da ponta do
// tunel. Toda interpolacao acontece aqui: o React so atualiza uniforms. O
// scroll decide a forma e a taxa; o tempo decide o movimento interno (fluxo
// da orbe, giro, fluxo da estrada, giro do tubo, rotacao da galaxia). Nada
// se acumula. Nenhum ponteiro.

attribute vec3 aOrb;
attribute vec3 aCyl;
attribute vec3 aDna;
attribute vec3 aRoad;
attribute vec4 aGal;           // quatro aleatorios fixos: dispersao, espessura, braco, cor
attribute float aSeed;
attribute float aScale;
attribute float aBand;         // intensidade de risco / haste da helice
attribute float aPhase;        // fase ao longo do risco
attribute float aLane;         // 1 nas faixas e bordas da estrada

uniform float uTime;
uniform float uFlowTime;       // tempo do fluxo da estrada, integrado pela taxa
uniform float uFlowSpeed;      // velocidade axial atual (u/s), para os riscos
uniform float uStreak;         // fator dos riscos: so no hipertunel
uniform float uRoadFade;       // peso do fade das pontas: so enquanto ha reciclagem
uniform float uTubeSpin;       // giro lento do tubo (rad)
uniform float uSpinCyl;        // angulo de giro do cilindro (rad)
uniform float uSpinDna;        // angulo de giro do DNA (rad)
uniform float uSize;
uniform float uPixelRatio;
uniform vec2 uResolution;      // buffer de desenho, em pixels
uniform float uDensity;

// Timeline: cada transformacao avanca de 0 a 1 no seu intervalo de scroll.
uniform float uOrbToCyl;
uniform float uCylToDna;
uniform float uDnaToRoad;
uniform float uFold;
uniform float uGalaxy;         // nascimento da galaxia: 0 ate o cilindro completo
uniform float uCoreAtten;      // alpha individual no bojo (compensacao de densidade)
uniform float uOrbFlow;
uniform float uBands;
uniform float uTurbulence;

// Esticamento vertical calculado da camera: o cilindro excede a viewport, o
// DNA cabe inteiro. Mesmas particulas, escala em Y diferente.
uniform float uCylStretch;
uniform float uDnaStretch;
uniform float uCylWidth;      // alarga o cilindro em X/Z, raio continua constante

uniform float uOrbMajor;       // raio maior do toro, em unidades de mundo
uniform float uRoadHalfWidth;
uniform float uRoadBaseY;
uniform vec3 uGalaxyCenter;    // ponta final do tunel

varying float vSeed;
varying float vScale;
varying float vDepth;
varying float vBand;
varying float vLane;
varying float vGalaxy;
varying float vGalaxyRadius;
varying float vGalaxyTone;
varying float vArm;
varying float vRoad;
varying float vTrail;
varying float vFar;
varying float vFade;
varying float vEnergy;
varying float vOrb;
varying vec2 vStreakAxis;      // direcao do risco no espaco do sprite
varying float vBaseFrac;       // fracao do sprite ocupada pelo ponto redondo

const float PI = 3.14159265;
const float TAU = 6.2831853;
const float ROAD_NEAR = ${f(ROAD_NEAR_Z)};
const float ROAD_FAR = ${f(ROAD_FAR_Z)};
const float ROAD_LEN = ${f(ROAD_LENGTH)};
const float FLOW_SPEED = ${f(ROAD_FLOW.speed)};
const float FLOW_SPREAD = ${f(ROAD_FLOW.seedSpread)};
const float FLOW_LANE_BOOST = ${f(ROAD_FLOW.laneBoost)};
const float FLOW_LATERAL = ${f(ROAD_FLOW.lateral)};
const float FLOW_LATERAL_RATE = ${f(ROAD_FLOW.lateralRate)};
const float FADE_NEAR = ${f(ROAD_FLOW.fadeNear)};
const float FADE_FAR = ${f(ROAD_FLOW.fadeFar)};
const float TWIST = ${f(TUNNEL_TWIST)};
const float STREAK_TIME = ${f(HYPER.streakTime)};
const float STREAK_MAX = ${f(HYPER.streakMax)};
const float ORB_SPEED_BASE = ${f(ORB_FLOW.speedBase)};
const float ORB_SPEED_SPREAD = ${f(ORB_FLOW.speedSpread)};
const float ORB_AMP = ${f(ORB_FLOW.amplitude)};
const float ORB_SECOND = ${f(ORB_FLOW.secondOctave)};
const float ORB_SECOND_SPEED = ${f(ORB_FLOW.secondSpeed)};
const float ORB_TURN = ${f(ORB_FLOW.turn)};
const float TURB_AMP = ${f(TURBULENCE)};
// Galaxia procedural: mesmos numeros de sceneConfig.GALAXY.
const float GAL_RADIUS = ${f(GALAXY.radius)};
const float GAL_CORE_SHARE = ${f(GALAXY.coreShare)};
const float GAL_CORE_FRACTION = ${f(GALAXY.coreFraction)};
const float GAL_CORE_PROFILE = ${f(GALAXY.coreProfile)};
const float GAL_HALO_RANK = ${f(HALO_RANK)};
const float GAL_ARM_FRACTION = ${f(ARM_FRACTION)};
const float GAL_ARMS = ${f(GALAXY.arms)};
const float GAL_TWIST = ${f(GALAXY.twist)};
const float GAL_SCATTER = ${f(GALAXY.armScatter)};
const float GAL_SCATTER_SLOPE = ${f(GALAXY.armScatterSlope)};
const float GAL_DISC_TAIL = ${f(GALAXY.discTail)};
const float GAL_HALO_BASE = ${f(GALAXY.haloBase)};
const float GAL_HALO_TAIL = ${f(GALAXY.haloTail)};
const float GAL_HALO_MAX = ${f(GALAXY.haloMax)};
const float GAL_SPIN_INNER = ${f(GALAXY.spinInner)};
const float GAL_SPIN_OUTER = ${f(GALAXY.spinOuter)};
const float GAL_BREATHE = ${f(GALAXY.breathe)};
const float GAL_BAND = ${f(GALAXY.releaseBand)};
const vec3 GAL_U = ${v3(GALAXY_BASIS.u)};
const vec3 GAL_W = ${v3(GALAXY_BASIS.w)};
const vec3 GAL_N = ${v3(GALAXY_BASIS.n)};
const float CORE_SIZE = ${f(CORE_ATTENUATION.sizeCore)};

float smootherstep(float t) {
  float c = clamp(t, 0.0, 1.0);
  return c * c * c * (c * (c * 6.0 - 15.0) + 10.0);
}

// Cauda exponencial: -ln(1 - u), u em [0, cap).
float expTail(float u, float cap) {
  return -log(1.0 - min(u, cap));
}

// Simplex noise 3D (Ashima Arts / Stefan Gustavson, MIT).
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
      i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
      i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Campo vetorial a partir de uma amostra de ruido. O giro da direcao por
// unidade de ruido e pequeno de proposito: giro grande vira tremor.
vec3 flowField(vec3 p) {
  float n = snoise(p);
  float a = n * ORB_TURN;
  return vec3(cos(a), sin(a * 1.37), sin(a)) * n;
}

// Giro em torno do eixo Y (eixo do cilindro e do DNA), em funcao do tempo.
vec3 rotY(vec3 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

// Dobra da estrada em tunel, preservando o comprimento do arco. Em fold->0
// converge para a posicao original; em fold=1 as duas bordas se encontram
// sobre o eixo. O relevo (y - base) vai ao longo da normal: positivo para
// dentro, negativo para fora (halo). z nao muda. Pontos alem das bordas
// (halo lateral) continuam o arco. Perto de fechar, as trilhas enrolam em
// helice e o tubo gira devagar com o tempo: nunca congela.
vec3 foldRoad(vec3 road, float fold) {
  float nx = road.x / (2.0 * uRoadHalfWidth);
  float ff = max(fold, 0.002);
  float closing = smoothstep(0.7, 1.0, fold);
  float angle = nx * TAU * ff + (road.z * TWIST + uTubeSpin) * closing;
  float R = uRoadHalfWidth / (PI * ff);
  float r = R - (road.y - uRoadBaseY);
  return vec3(r * sin(angle), uRoadBaseY + R - r * cos(angle), road.z);
}

// Posicao galactica a partir da posicao no tunel: profundidade -> raio (a
// ponta vira o centro do nucleo, a entrada vira o halo), setor angular do
// tubo -> braco. Bojo elipsoidal, bracos apertados, disco difuso com cauda
// exponencial na borda, halo esparso fora do plano tambem com cauda: a
// densidade cai sem borda. Nasce no plano inclinado fixo; o tempo so gira em
// torno da normal e respira levemente. Devolve raio em w e braco em vArm.
vec4 galaxyFromTube(float depth, float angle01, vec4 h, out float arm) {
  float rank = clamp(1.0 - depth, 0.0, 1.0);
  float h5 = fract((h.x + h.w) * 4.7);
  float r;
  float height;
  float az;
  arm = 0.0;
  if (rank < GAL_CORE_SHARE) {
    float s = rank / GAL_CORE_SHARE;
    float rr = GAL_CORE_FRACTION * pow(s, GAL_CORE_PROFILE);
    float theta = h.x * TAU;
    float phi = acos(h.y * 2.0 - 1.0);
    float x = sin(phi) * cos(theta) * rr;
    float z = sin(phi) * sin(theta) * rr;
    height = cos(phi) * rr * 0.7;
    az = atan(z, x);
    r = length(vec2(x, z));
  } else if (rank < GAL_HALO_RANK) {
    float s = (rank - GAL_CORE_SHARE) / (GAL_HALO_RANK - GAL_CORE_SHARE);
    r = GAL_CORE_FRACTION + pow(s, 1.4) * (1.0 - GAL_CORE_FRACTION);
    float thickness = 0.09 * exp(-r * 3.2) + 0.008;
    if (h.z < GAL_ARM_FRACTION) {
      float which = floor(angle01 * GAL_ARMS);
      az = (which / GAL_ARMS) * TAU + r * GAL_TWIST + (h.x + h.y - 1.0) * 1.5 * (GAL_SCATTER + r * GAL_SCATTER_SLOPE);
      arm = 1.0;
    } else {
      az = h.x * TAU;
    }
    height = (h.w * 2.0 - 1.0) * thickness * 1.5;
    r += (h.w - 0.5) * 0.03 + expTail(h5, 0.995) * GAL_DISC_TAIL * (1.0 - 0.4 * arm);
  } else {
    r = min(GAL_HALO_BASE + expTail(h.x, 0.985) * GAL_HALO_TAIL, GAL_HALO_MAX);
    az = h.z * TAU;
    height = (h.y * 2.0 - 1.0) * 0.45 * r;
  }
  az += uTime * (GAL_SPIN_OUTER + (GAL_SPIN_INNER - GAL_SPIN_OUTER) * (1.0 - clamp(r, 0.0, 1.0)));
  height += GAL_BREATHE * sin(uTime * 0.2 + h.y * TAU) * (0.2 + r);
  float lx = cos(az) * r * GAL_RADIUS;
  float lz = sin(az) * r * GAL_RADIUS;
  float ly = height * GAL_RADIUS;
  return vec4(uGalaxyCenter + lx * GAL_U + lz * GAL_W + ly * GAL_N, r);
}

void main() {
  if (aSeed > uDensity) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  // --- Orbe: correntes tangenciais lentas, sem eixo global -----------------
  vec3 orb = aOrb;
  if (uOrbFlow > 0.001) {
    vec2 ringDir = normalize(orb.xy + vec2(1e-4, 0.0));
    vec3 ringPoint = vec3(ringDir * uOrbMajor, 0.0);
    vec3 n = normalize(orb - ringPoint + vec3(0.0, 0.0, 1e-4));
    float speed = ORB_SPEED_BASE + aSeed * ORB_SPEED_SPREAD;
    vec3 flow = flowField(orb * 0.5 + vec3(uTime * speed, aSeed * 5.0, -uTime * speed * 0.7))
              + ORB_SECOND * flowField(orb * 1.7 - vec3(uTime * ORB_SECOND_SPEED, 0.0, uTime * ORB_SECOND_SPEED * 0.7) + aSeed * 9.0);
    vec3 tangential = flow - n * dot(flow, n);
    orb += tangential * ORB_AMP * uOrbFlow;
  }

  // Esticamento vertical por camera e giro lento em torno do proprio eixo.
  vec3 cyl = rotY(vec3(aCyl.x * uCylWidth, aCyl.y * uCylStretch, aCyl.z * uCylWidth), uSpinCyl);
  vec3 dna = rotY(vec3(aDna.x, aDna.y * uDnaStretch, aDna.z), uSpinDna);

  vec3 p = mix(orb, cyl, uOrbToCyl);
  p = mix(p, dna, uCylToDna);

  // --- Estrada com fluxo longitudinal (tempo, nao scroll) ------------------
  // uFlowTime avanca em todo frame na taxa do estagio: a estrada em formacao
  // ja corre, a dobra corre, o hipertunel dispara. Cada particula anda para
  // -Z na sua velocidade e recicla no fim; o alpha e zero nas duas pontas
  // enquanto ha reciclagem.
  vec3 road = aRoad;
  float d0 = (ROAD_NEAR - aRoad.z) / ROAD_LEN;
  float flowSpeed = FLOW_SPEED * (1.0 - FLOW_SPREAD * 0.5 + FLOW_SPREAD * aSeed) * (1.0 + aLane * FLOW_LANE_BOOST);
  float d = fract(d0 + uFlowTime * flowSpeed / ROAD_LEN);
  road.z = ROAD_NEAR - d * ROAD_LEN;
  road.x += FLOW_LATERAL * sin(uTime * FLOW_LATERAL_RATE + aSeed * TAU);
  float endFade = smoothstep(0.0, FADE_NEAR, ROAD_NEAR - road.z) * smoothstep(0.0, FADE_FAR, road.z - ROAD_FAR);
  vec3 tube = uFold > 0.0005 ? foldRoad(road, uFold) : road;

  // --- Galaxia: nasce da ponta do tunel, de dentro para fora ---------------
  // Nada e galaxia enquanto uGalaxy = 0 (cilindro incompleto ou hipertunel).
  float depth = (ROAD_NEAR - road.z) / ROAD_LEN;
  float rank = clamp(1.0 - depth, 0.0, 1.0);
  float gal = smootherstep((uGalaxy * (1.0 + GAL_BAND) - rank) / GAL_BAND);
  float galaxyRadius = 0.0;
  float arm = 0.0;
  vec3 late = tube;
  if (gal > 0.0) {
    float nx = road.x / (2.0 * uRoadHalfWidth);
    float angle01 = fract(nx + road.z * TWIST / TAU);
    vec4 g = galaxyFromTube(depth, angle01, aGal, arm);
    late = mix(tube, g.xyz, gal);
    galaxyRadius = g.w;
  }
  p = mix(p, late, uDnaToRoad);

  if (uTurbulence > 0.004) {
    vec3 flow = flowField(p * 0.35 + vec3(aSeed * 6.0, uTime * 0.05, 0.0));
    p += flow * uTurbulence * TURB_AMP;
  }

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vDepth = -mvPosition.z;

  // --- Riscos luminosos: pulsos lentos percorrendo o cilindro --------------
  float pulse = 0.5 + 0.5 * sin(aPhase * 26.0 - uTime * 1.1 + aSeed * 6.2831);
  vBand = aBand * uBands * (0.45 + 0.55 * pulse);

  vSeed = aSeed;
  vScale = aScale;
  vLane = aLane;
  vGalaxyRadius = galaxyRadius;
  vGalaxyTone = aGal.w;
  vArm = arm * gal;
  vRoad = uDnaToRoad * (1.0 - gal);
  vGalaxy = uDnaToRoad * gal;
  vFade = mix(1.0, endFade, uRoadFade * (1.0 - gal));
  // Trilhas: segmentos claros correndo pelas faixas, mais fortes no fundo.
  float trailPulse = 0.5 + 0.5 * sin(road.z * 0.6 + uFlowTime * 2.0 + aSeed * 3.0);
  vTrail = aLane * vRoad * (0.35 + 0.65 * trailPulse);
  vFar = vRoad * smoothstep(ROAD_NEAR, ROAD_FAR, road.z);
  vEnergy = uTurbulence;
  vOrb = uOrbFlow;

  float boost = 1.0
    + vBand * 1.0
    + vRoad * (0.7 + aLane * 0.5);
  // Bojo: particulas menores onde a densidade e maior.
  float galaxySize = mix(CORE_SIZE, 1.0, smoothstep(0.0, 0.3, galaxyRadius));
  boost = mix(boost, galaxySize, vGalaxy);
  float perspective = uSize * aScale * boost * (7.0 / max(vDepth, 0.4));
  float base = clamp(perspective * uPixelRatio, 0.9, 6.5);

  // --- Hipertunel: o ponto vira risco pela velocidade projetada ------------
  // Um ponto a sPx do ponto de fuga (o centro: a camera olha pelo eixo), a
  // vDepth da camera, andando a uFlowSpeed pelo eixo, desliza na tela a
  // sPx * v / depth px por segundo. Perto e rapido = risco longo; longe =
  // ponto. So no hipertunel (uStreak) e so para particulas do tunel.
  vec2 ndc = gl_Position.xy / max(gl_Position.w, 1e-4);
  vec2 px = ndc * 0.5 * uResolution;
  float sPx = length(px);
  float streak = 0.0;
  if (uStreak > 0.001 && vRoad > 0.001) {
    float speedPx = sPx * uFlowSpeed / max(vDepth, 0.5) * STREAK_TIME;
    streak = min(speedPx, STREAK_MAX * uPixelRatio) * uStreak * vRoad;
  }
  // gl_PointCoord cresce para baixo: inverte y.
  vStreakAxis = sPx > 0.5 ? vec2(px.x, -px.y) / sPx : vec2(1.0, 0.0);
  vBaseFrac = base / (base + streak);
  gl_PointSize = base + streak;
}
`;
