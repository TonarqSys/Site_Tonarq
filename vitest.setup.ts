import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom não tem matchMedia; os componentes consultam movimento reduzido e ponteiro.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// jsdom não implementa WebGL: o caminho testado é sempre o fallback estático.
HTMLCanvasElement.prototype.getContext = vi.fn(
  () => null,
) as unknown as HTMLCanvasElement["getContext"];

window.scrollTo = vi.fn();
