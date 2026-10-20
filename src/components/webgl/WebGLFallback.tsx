/**
 * Substituto estático quando não há WebGL ou o usuário pediu menos movimento.
 * Puramente decorativo: todo o conteúdo continua no HTML.
 */
export function WebGLFallback() {
  return (
    <div
      aria-hidden="true"
      data-testid="webgl-fallback"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(92,246,255,0.22),rgba(52,120,255,0.16)_38%,rgba(139,92,246,0.12)_58%,transparent_72%)] blur-2xl" />
      <div className="absolute left-1/2 top-1/2 h-[46vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
      <div className="absolute left-1/2 top-1/2 h-[62vmin] w-[62vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
    </div>
  );
}

export default WebGLFallback;
