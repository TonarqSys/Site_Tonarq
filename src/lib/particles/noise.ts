/**
 * Simplex noise 3D (Ashima Arts / Stefan Gustavson, MIT), porte fiel do GLSL
 * usado no vertex shader. Existe só para os testes medirem o fluxo da orbe
 * com a mesma função que a GPU executa.
 */

type V3 = [number, number, number];
type V4 = [number, number, number, number];

const mod289 = (x: number) => x - Math.floor(x * (1 / 289)) * 289;
const permute = (x: number) => mod289((x * 34 + 1) * x);
const taylorInvSqrt = (r: number) => 1.79284291400159 - 0.85373472095314 * r;
const step = (edge: number, x: number) => (x < edge ? 0 : 1);
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function snoise(v: V3): number {
  const Cx = 1 / 6;
  const Cy = 1 / 3;
  const s = (v[0] + v[1] + v[2]) * Cy;
  const i: V3 = [Math.floor(v[0] + s), Math.floor(v[1] + s), Math.floor(v[2] + s)];
  const t = (i[0] + i[1] + i[2]) * Cx;
  const x0: V3 = [v[0] - i[0] + t, v[1] - i[1] + t, v[2] - i[2] + t];

  const g: V3 = [step(x0[1], x0[0]), step(x0[2], x0[1]), step(x0[0], x0[2])];
  const l: V3 = [1 - g[0], 1 - g[1], 1 - g[2]];
  const i1: V3 = [Math.min(g[0], l[2]), Math.min(g[1], l[0]), Math.min(g[2], l[1])];
  const i2: V3 = [Math.max(g[0], l[2]), Math.max(g[1], l[0]), Math.max(g[2], l[1])];

  const x1: V3 = [x0[0] - i1[0] + Cx, x0[1] - i1[1] + Cx, x0[2] - i1[2] + Cx];
  const x2: V3 = [x0[0] - i2[0] + Cy, x0[1] - i2[1] + Cy, x0[2] - i2[2] + Cy];
  const x3: V3 = [x0[0] - 0.5, x0[1] - 0.5, x0[2] - 0.5];

  const im: V3 = [mod289(i[0]), mod289(i[1]), mod289(i[2])];
  const p: V4 = [0, 0, 0, 0];
  const iz = [0, i1[2], i2[2], 1];
  const iy = [0, i1[1], i2[1], 1];
  const ix = [0, i1[0], i2[0], 1];
  for (let k = 0; k < 4; k += 1) {
    p[k] = permute(permute(permute(im[2] + iz[k]) + im[1] + iy[k]) + im[0] + ix[k]);
  }

  // Constantes em float32, como na GPU: em float64 o literal fica abaixo de
  // 1/7 e floor(j * ns.z) erra nos multiplos de 7, escolhendo gradientes
  // errados. Com fround, os mesmos floors da GPU.
  const n_ = Math.fround(0.142857142857);
  const ns: V3 = [Math.fround(n_ * 2), Math.fround(n_ * 0.5 - 1), n_]; // n_ * D.wyz - D.xzx
  const j: V4 = [0, 0, 0, 0];
  const x_: V4 = [0, 0, 0, 0];
  const y_: V4 = [0, 0, 0, 0];
  const x: V4 = [0, 0, 0, 0];
  const y: V4 = [0, 0, 0, 0];
  const h: V4 = [0, 0, 0, 0];
  for (let k = 0; k < 4; k += 1) {
    j[k] = p[k] - 49 * Math.floor(p[k] * ns[2] * ns[2]);
    x_[k] = Math.floor(j[k] * ns[2]);
    y_[k] = Math.floor(j[k] - 7 * x_[k]);
    x[k] = x_[k] * ns[0] + ns[1];
    y[k] = y_[k] * ns[0] + ns[1];
    h[k] = 1 - Math.abs(x[k]) - Math.abs(y[k]);
  }

  const b0: V4 = [x[0], x[1], y[0], y[1]];
  const b1: V4 = [x[2], x[3], y[2], y[3]];
  const s0: V4 = b0.map((b) => Math.floor(b) * 2 + 1) as V4;
  const s1: V4 = b1.map((b) => Math.floor(b) * 2 + 1) as V4;
  const sh: V4 = h.map((hh) => -step(hh, 0)) as V4;

  // a0 = b0.xzyw + s0.xzyw * sh.xxyy ; a1 = b1.xzyw + s1.xzyw * sh.zzww
  const a0: V4 = [
    b0[0] + s0[0] * sh[0],
    b0[2] + s0[2] * sh[0],
    b0[1] + s0[1] * sh[1],
    b0[3] + s0[3] * sh[1],
  ];
  const a1: V4 = [
    b1[0] + s1[0] * sh[2],
    b1[2] + s1[2] * sh[2],
    b1[1] + s1[1] * sh[3],
    b1[3] + s1[3] * sh[3],
  ];

  const p0: V3 = [a0[0], a0[1], h[0]];
  const p1: V3 = [a0[2], a0[3], h[1]];
  const p2: V3 = [a1[0], a1[1], h[2]];
  const p3: V3 = [a1[2], a1[3], h[3]];
  const scale = (q: V3) => {
    const n = taylorInvSqrt(dot3(q, q));
    q[0] *= n;
    q[1] *= n;
    q[2] *= n;
  };
  scale(p0);
  scale(p1);
  scale(p2);
  scale(p3);

  const m: V4 = [
    Math.max(0.6 - dot3(x0, x0), 0),
    Math.max(0.6 - dot3(x1, x1), 0),
    Math.max(0.6 - dot3(x2, x2), 0),
    Math.max(0.6 - dot3(x3, x3), 0),
  ];
  for (let k = 0; k < 4; k += 1) m[k] *= m[k];
  return (
    42 *
    (m[0] * m[0] * dot3(p0, x0) +
      m[1] * m[1] * dot3(p1, x1) +
      m[2] * m[2] * dot3(p2, x2) +
      m[3] * m[3] * dot3(p3, x3))
  );
}

/** Campo vetorial a partir de uma amostra de ruído: igual ao flowField do shader. */
export function flowField(p: V3, turn: number): V3 {
  const n = snoise(p);
  const a = n * turn;
  return [Math.cos(a) * n, Math.sin(a * 1.37) * n, Math.sin(a) * n];
}
