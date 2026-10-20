/**
 * Adaptação ao poder da máquina de quem visita.
 *
 * A capacidade real só aparece medindo: o mesmo modelo de notebook roda
 * diferente com bateria baixa, aba pesada ao lado ou GPU integrada. Então a
 * qualidade parte de uma estimativa pelo hardware declarado e depois sobe ou
 * desce conforme a taxa de quadros observada.
 *
 * Nenhum degrau reconstrói geometria nem recarrega nada: o visitante não vê
 * salto, só continua fluido.
 */

export interface QualityState {
  /** Fração de partículas desenhada, 0..1. Lida pelo shader. */
  density: number;
  /** Resolução de render. Acima de 1.25 o custo de preenchimento explode. */
  dpr: number;
}

/** Degraus do mais bonito ao mais leve. */
export const QUALITY_TIERS: readonly QualityState[] = [
  { density: 1.0, dpr: 1.25 },
  { density: 0.8, dpr: 1.0 },
  { density: 0.62, dpr: 1.0 },
  { density: 0.45, dpr: 0.85 },
  { density: 0.3, dpr: 0.7 },
];

export const quality: QualityState & { tier: number } = {
  tier: 0,
  ...QUALITY_TIERS[0],
};

function applyTier(index: number): boolean {
  const clamped = Math.min(Math.max(index, 0), QUALITY_TIERS.length - 1);
  if (clamped === quality.tier) return false;
  quality.tier = clamped;
  Object.assign(quality, QUALITY_TIERS[clamped]);
  return true;
}

/** Um degrau abaixo. Devolve true quando algo mudou. */
export function degrade(): boolean {
  return applyTier(quality.tier + 1);
}

/** Um degrau acima, quando sobra folga. */
export function recover(): boolean {
  return applyTier(quality.tier - 1);
}

export function resetQuality(): void {
  quality.tier = 0;
  Object.assign(quality, QUALITY_TIERS[0]);
}

/**
 * Chute inicial pelo hardware declarado. Começa conservador de propósito:
 * subir um degrau é imperceptível, descer depois de travar não é.
 */
export function initialTier(): number {
  if (typeof window === "undefined") return 2;

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  const mobile = window.matchMedia("(max-width: 768px)").matches;

  if (mobile) return cores <= 4 ? 4 : 3;
  if (cores <= 4 || (memory !== undefined && memory <= 4)) return 3;
  if (cores >= 12) return 1;
  return 2;
}

export function startAtInitialTier(): void {
  applyTier(initialTier());
}
