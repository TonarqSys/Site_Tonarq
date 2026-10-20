import { describe, expect, it } from "vitest";

import {
  EFFECTS,
  NARRATIVE_VH,
  STAGE_COUNT,
  TEXT_CENTERS,
  TEXT_WINDOWS,
  TRANSITIONS,
  emptySample,
  sampleTimeline,
  stageAt,
  stageSectionTopVh,
  stageTextOpacity,
} from "./timeline";

const amostra = (p: number) => sampleTimeline(p, emptySample());

const MORPHS = [
  TRANSITIONS.orbToCylinder,
  TRANSITIONS.cylinderToDna,
  TRANSITIONS.dnaToRoad,
  TRANSITIONS.fold,
  TRANSITIONS.galaxyFormation,
];

describe("timeline: distribuição", () => {
  it("cada morph ocupa uma faixa confortável de scroll (>= 9%)", () => {
    // Tolerancia de float: 0.73 - 0.63 da 0.0999999...
    for (const [a, b] of MORPHS) expect(b - a).toBeGreaterThanOrEqual(0.09 - 1e-9);
  });

  it("os morphs não se sobrepõem", () => {
    for (let i = 1; i < MORPHS.length; i += 1) {
      expect(MORPHS[i][0]).toBeGreaterThanOrEqual(MORPHS[i - 1][1]);
    }
  });

  it("nenhum trecho fica sem resposta visual por mais de 5%", () => {
    // Em cada ponto: ou algum morph avanca, ou a camera se move (zoom), ou
    // um texto esta visivel. Procura a maior sequencia sem nenhum dos tres.
    let maiorVazio = 0;
    let atual = 0;
    for (let i = 0; i <= 1000; i += 1) {
      const p = i / 1000;
      const s = amostra(p);
      const morphAtivo = MORPHS.some(([a, b]) => p > a && p < b);
      const zoomAtivo = p > EFFECTS.galaxyZoom[0] && p < EFFECTS.galaxyZoom[1];
      const travessia = p > EFFECTS.traverse[0] && p < EFFECTS.traverse[1];
      const nucleo = p > EFFECTS.tipToCore[0] && p < EFFECTS.tipToCore[1];
      const textoVisivel = Array.from({ length: STAGE_COUNT }, (_, k) => stageTextOpacity(k, p)).some((o) => o > 0.5);
      if (morphAtivo || zoomAtivo || travessia || nucleo || textoVisivel || s.turbulence > 0) atual = 0;
      else atual += 0.001;
      maiorVazio = Math.max(maiorVazio, atual);
    }
    expect(maiorVazio).toBeLessThanOrEqual(0.05);
  });

  it("morphs somam mais scroll que as esperas", () => {
    const morph = MORPHS.reduce((a, [x, y]) => a + (y - x), 0);
    const zoom = EFFECTS.galaxyZoom[1] - EFFECTS.galaxyZoom[0];
    expect(morph + zoom).toBeGreaterThan(0.5);
  });
});

describe("timeline: galáxia", () => {
  it("a ponta vira núcleo antes do zoom out; o zoom termina junto com o nascimento", () => {
    expect(EFFECTS.tipToCore[0]).toBe(TRANSITIONS.galaxyFormation[0]);
    expect(EFFECTS.tipToCore[1]).toBe(EFFECTS.galaxyZoom[0]);
    expect(EFFECTS.galaxyZoom[1]).toBe(TRANSITIONS.galaxyFormation[1]);
    const s = amostra((EFFECTS.galaxyZoom[0] + EFFECTS.galaxyZoom[1]) / 2);
    expect(s.galaxyFormation).toBeGreaterThan(s.galaxyZoom);
    expect(s.galaxyZoom).toBeGreaterThan(0);
    expect(s.galaxyZoom).toBeLessThan(1);
    expect(amostra(EFFECTS.galaxyZoom[0]).galaxyFormation).toBeGreaterThan(0.2);
  });

  it("a galáxia é exatamente zero até o cilindro estar completo e atravessado", () => {
    for (const p of [0.5, 0.63, 0.68, 0.73, 0.77, 0.83]) expect(amostra(p).galaxyFormation).toBe(0);
    expect(amostra(TRANSITIONS.fold[1]).fold).toBe(1);
    expect(amostra(EFFECTS.traverse[1]).traverse).toBe(1);
    expect(EFFECTS.traverse[1]).toBeLessThanOrEqual(TRANSITIONS.galaxyFormation[0]);
  });

  it("há retenção final com a galáxia completa", () => {
    expect(EFFECTS.galaxyHold[1] - EFFECTS.galaxyHold[0]).toBeGreaterThanOrEqual(0.03);
    expect(amostra(1).galaxyZoom).toBe(1);
    expect(amostra(1).galaxyFormation).toBe(1);
  });

  it("o fluxo corre desde a formação da estrada, dispara no hipertúnel e zera só na ponta", () => {
    expect(amostra(0.4).flowRate).toBe(0);
    expect(amostra(0.5).flowRate).toBeGreaterThan(0);
    expect(amostra(0.6).flowRate).toBe(1);
    expect(amostra(TRANSITIONS.fold[1]).flowRate).toBe(1);
    expect(amostra(0.77).flowRate).toBeGreaterThan(3);
    expect(amostra(EFFECTS.traverse[1]).flowRate).toBe(0);
    expect(amostra(0.6).streak).toBe(0);
    expect(amostra(0.9).streak).toBe(0);
  });
});

describe("timeline: amostragem", () => {
  it("começa no orbe com fluxo ligado", () => {
    const s = amostra(0);
    expect(s.orbFlow).toBe(1);
    expect(s.orbToCylinder).toBe(0);
    expect(s.turbulence).toBe(0);
  });

  it("durante a retenção do DNA a forma está pronta e parada, com riscos", () => {
    const meio = (TRANSITIONS.cylinderToDna[1] + TRANSITIONS.dnaToRoad[0]) / 2;
    const s = amostra(meio);
    expect(s.cylinderToDna).toBe(1);
    expect(s.dnaToRoad).toBe(0);
    expect(s.turbulence).toBeCloseTo(0, 6);
    expect(s.bands).toBe(1);
  });

  it("é determinística e escreve sem alocar", () => {
    for (const p of [0.05, 0.19, 0.4, 0.65, 0.82, 0.93]) expect(amostra(p)).toEqual(amostra(p));
    const out = emptySample();
    expect(sampleTimeline(0.5, out)).toBe(out);
  });
});

describe("texto", () => {
  it("cada texto fica em 100% durante a retenção e some só no morph seguinte", () => {
    for (let k = 0; k < STAGE_COUNT; k += 1) {
      const [, inEnd, outStart] = TEXT_WINDOWS[k];
      expect(stageTextOpacity(k, (inEnd + Math.min(outStart, 1)) / 2)).toBeCloseTo(1, 3);
    }
    expect(stageTextOpacity(2, TRANSITIONS.dnaToRoad[0] - 0.005)).toBeCloseTo(1, 2);
    expect(stageTextOpacity(2, TRANSITIONS.dnaToRoad[1])).toBeLessThan(0.05);
  });

  it("o texto entra quando o morph do seu estágio termina, não antes", () => {
    expect(TEXT_WINDOWS[1][1]).toBeGreaterThanOrEqual(TRANSITIONS.orbToCylinder[1]);
    expect(TEXT_WINDOWS[2][1]).toBeGreaterThanOrEqual(TRANSITIONS.cylinderToDna[1]);
    expect(TEXT_WINDOWS[3][1]).toBeGreaterThanOrEqual(TRANSITIONS.dnaToRoad[1]);
    expect(TEXT_WINDOWS[5][0]).toBeGreaterThanOrEqual(TRANSITIONS.galaxyFormation[1]);
  });

  it("primeiro e último textos não piscam nas pontas", () => {
    expect(stageTextOpacity(0, 0)).toBe(1);
    expect(stageTextOpacity(STAGE_COUNT - 1, 1)).toBe(1);
  });

  it("a seção é posicionada onde o centro da retenção cruza o meio da tela", () => {
    for (let k = 0; k < STAGE_COUNT; k += 1) {
      const top = stageSectionTopVh(k);
      // scrollY em vh no progresso alvo; centro da secao = top + 50.
      const scrollY = TEXT_CENTERS[k] * (NARRATIVE_VH - 100);
      expect(top + 50 - scrollY).toBeCloseTo(50, 6);
      expect(top + 100).toBeLessThanOrEqual(NARRATIVE_VH + 1e-6);
    }
  });

  it("estágio dominante segue as janelas de texto", () => {
    expect(stageAt(0)).toBe(0);
    expect(stageAt(0.22)).toBe(1);
    expect(stageAt(0.42)).toBe(2);
    expect(stageAt(1)).toBe(STAGE_COUNT - 1);
  });
});
