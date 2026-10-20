// Fonte GLSL como modulo TypeScript. ATENCAO: nenhuma crase dentro do GLSL.
import { CORE_ATTENUATION, GALAXY } from "@/lib/particles/sceneConfig";

const f = (v: number) => v.toFixed(6);

export const particlesFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uColorCore;    // ciano
uniform vec3 uColorMid;     // azul
uniform vec3 uColorEdge;    // violeta
uniform vec3 uColorAccent;  // magenta
uniform vec3 uColorWhite;
uniform float uOpacity;
uniform float uCoreAtten;   // alpha individual no centro do bojo

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
varying vec2 vStreakAxis;
varying float vBaseFrac;

const float GAL_ALPHA = ${f(GALAXY.alpha)};
const float CORE_ATTEN_RADIUS = ${f(CORE_ATTENUATION.radius)};

void main() {
  // Sprite em capsula: um segmento ao longo do eixo do risco com pontas
  // redondas. Sem risco (vBaseFrac = 1) o segmento tem comprimento zero e a
  // capsula e o ponto redondo de sempre.
  vec2 q = gl_PointCoord - vec2(0.5);
  vec2 axis = vStreakAxis;
  vec2 perp = vec2(-axis.y, axis.x);
  float along = dot(q, axis);
  float across = dot(q, perp);
  float halfW = 0.5 * vBaseFrac;
  float segHalf = 0.5 - halfW;
  float dAlong = max(abs(along) - segHalf, 0.0);
  float radius = length(vec2(dAlong, across)) / halfW;
  if (radius > 1.0) discard;
  // Miolo cheio e borda macia: le como ponto de luz, nao como disco chapado.
  float falloff = smoothstep(1.0, 0.24, radius);

  // Atenuacao por profundidade branda: o fundo escurece, mas nao some.
  float depthMix = clamp((vDepth - 1.5) / 16.0, 0.0, 1.0);
  vec3 color = mix(uColorCore, uColorMid, depthMix);
  color = mix(color, uColorEdge, smoothstep(0.6, 1.0, depthMix));

  // Magenta em poucas particulas: detalhe, nao gradiente geral.
  float accent = step(0.965, fract(vSeed * 41.7));
  color = mix(color, uColorAccent, accent * 0.75);

  // Particulas maiores sao as energizadas: mais claras.
  float energized = smoothstep(1.4, 2.3, vScale);
  color = mix(color, uColorWhite, energized * 0.35);

  // Estrada: ciano e azul dominantes; faixas e bordas mais claras; correntes
  // violeta/magenta em poucas particulas.
  vec3 roadTint = mix(uColorCore, uColorMid, 0.4);
  color = mix(color, roadTint, vRoad * 0.6);
  color = mix(color, mix(uColorCore, uColorWhite, 0.35), vRoad * vLane * 0.6);
  color = mix(color, mix(uColorEdge, uColorAccent, 0.5), vRoad * accent * 0.9);

  // Galaxia por raio: nucleo branco-ciano, interior ciano, bracos azul,
  // extremidades azul-violeta, com variacao por particula para o nucleo ter
  // textura. Bracos um pouco mais claros que o disco difuso.
  vec3 galaxy = mix(uColorWhite, uColorCore, smoothstep(0.0, 0.13, vGalaxyRadius));
  galaxy = mix(galaxy, uColorMid, smoothstep(0.1, 0.5, vGalaxyRadius));
  galaxy = mix(galaxy, uColorEdge, smoothstep(0.45, 1.1, vGalaxyRadius));
  galaxy = mix(galaxy, uColorCore, step(0.55, vGalaxyTone) * step(vGalaxyTone, 0.8) * 0.5);
  galaxy = mix(galaxy, uColorMid, step(0.8, vGalaxyTone) * 0.6);
  galaxy = mix(galaxy, uColorWhite, vArm * 0.12);
  color = mix(color, galaxy, vGalaxy);

  // Riscos da helice: claramente mais brilhantes que o corpo.
  color += mix(uColorCore, uColorWhite, 0.4) * vBand * 1.3;
  // Trilhas da estrada: segmentos claros correndo pelas faixas.
  color += mix(uColorCore, uColorWhite, 0.5) * vTrail * 0.9;
  color += uColorCore * vEnergy * 0.18;

  // A galaxia e vista de longe de proposito: nao escurece com a profundidade.
  float alpha = falloff * uOpacity * mix(0.62 + 0.38 * (1.0 - depthMix), 1.0, vGalaxy);
  alpha *= 1.0 + vBand * 1.2 + vRoad * (0.6 + vLane * 0.5) + vTrail * 0.8 + vFar * 0.5;
  // Riscos do hipertunel: alongados, um pouco mais tenues por pixel, sem saturar.
  alpha *= mix(0.22, 1.0, vBaseFrac);
  // Compensacao de densidade: quanto mais perto do centro do bojo, menor a
  // contribuicao individual. Bracos ligeiramente mais fortes que o disco difuso.
  float coreFactor = mix(uCoreAtten, 1.0, smoothstep(0.0, CORE_ATTEN_RADIUS, vGalaxyRadius));
  alpha *= mix(1.0, GAL_ALPHA * coreFactor * (0.8 + 0.35 * vArm), vGalaxy);
  // Pontas da estrada: zero onde a particula e reciclada.
  alpha *= vFade;
  gl_FragColor = vec4(color, min(alpha, 1.0));
}
`;
