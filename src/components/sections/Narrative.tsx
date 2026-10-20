"use client";

import { useCallback, useEffect, useRef } from "react";

import ParticleExperience from "@/components/webgl/ParticleExperience";
import {
  NARRATIVE_VH,
  motionState,
  stageSectionTopVh,
  stageTextOpacity,
} from "@/lib/motion/scrollTimeline";
import { stages, type Stage } from "@/content/stages";

const NARRATIVE_ID = "narrativa";

function Marker({ text }: { text: string }) {
  return (
    <p className="font-display text-xs uppercase tracking-[0.28em] text-[#5cf6ff]">{text}</p>
  );
}

function Highlights({ items, align = "left" }: { items: readonly string[]; align?: "left" | "right" }) {
  return (
    <ul className={`mt-7 flex flex-wrap gap-x-6 gap-y-3 ${align === "right" ? "justify-end" : ""}`}>
      {items.map((item) => (
        <li
          key={item}
          className={`readable text-sm text-[#f7f8fc]/85 ${
            align === "right"
              ? "after:ml-2 after:text-[#8b5cf6] after:content-['—']"
              : "before:mr-2 before:text-[#8b5cf6] before:content-['—']"
          }`}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function StageBody({ stage }: { stage: Stage }) {
  return (
    <>
      {stage.flow && (
        <ol className="mt-7 flex flex-wrap items-center gap-2 text-sm">
          {stage.flow.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-white/14 bg-[#05070f]/90 px-3 py-1.5 text-[#f7f8fc]">
                {step}
              </span>
              {index < stage.flow!.length - 1 && (
                <span aria-hidden="true" className="text-[#3478ff]">→</span>
              )}
            </li>
          ))}
        </ol>
      )}

      {stage.cards && (
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {stage.cards.map((card) => (
            <article key={card.title} className="rounded-xl border border-white/10 bg-[#05070f]/88 p-5">
              <h3 className="font-display text-sm tracking-wide text-[#5cf6ff]">{card.title}</h3>
              <p className="mt-2 text-sm text-[#c3c9d6]">{card.body}</p>
            </article>
          ))}
        </div>
      )}

      {stage.ctas && (
        <div className={`mt-10 flex flex-wrap gap-3 ${stage.layout === "center" ? "justify-center" : ""}`}>
          {stage.ctas.map((cta) => (
            <a
              key={cta.label}
              href={cta.href}
              className={
                cta.primary
                  ? "rounded-full bg-[#5cf6ff] px-6 py-3 text-sm font-medium text-[#03040a] transition-transform hover:scale-[1.02] motion-reduce:hover:scale-100"
                  : "rounded-full border border-white/25 bg-[#05070f]/75 px-6 py-3 text-sm text-[#f7f8fc] transition-colors hover:border-[#5cf6ff]/60"
              }
            >
              {cta.label}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Cada secao e posicionada no container exatamente onde o meio da retencao
 * do seu estagio cruza o centro da viewport (stageSectionTopVh). Assim texto
 * e forma estavel coincidem por construcao, sem depender de alturas
 * proporcionais que acumulam desvio. A ordem do DOM continua a de leitura.
 *
 * A opacidade e escrita direto no DOM a cada mudanca de scroll (nao por
 * frame, nem por setState). So opacidade: visibility hidden tiraria o texto
 * da arvore de acessibilidade.
 */
export function Narrative() {
  const blocks = useRef<Array<HTMLDivElement | null>>([]);

  const applyOpacity = useCallback((progress: number) => {
    blocks.current.forEach((node, index) => {
      if (!node) return;
      const value = motionState.reducedMotion ? 1 : stageTextOpacity(index, progress);
      node.style.opacity = value.toFixed(3);
    });
  }, []);

  useEffect(() => {
    applyOpacity(motionState.progress);
  }, [applyOpacity]);

  const register = (index: number) => (node: HTMLDivElement | null) => {
    blocks.current[index] = node;
  };

  const sectionStyle = (index: number) => ({
    top: `${stageSectionTopVh(index)}vh`,
    minHeight: "100vh",
  });
  const sectionClass = "absolute inset-x-0 flex px-4 sm:px-6";

  return (
    <>
      <ParticleExperience narrativeId={NARRATIVE_ID} onProgress={applyOpacity} />

      <div id={NARRATIVE_ID} className="relative z-10" style={{ height: `${NARRATIVE_VH}vh` }}>
        {stages.map((stage) => {
          if (stage.layout === "center") {
            return (
              <section
                key={stage.id}
                id={stage.id}
                aria-labelledby={`${stage.id}-titulo`}
                className={`${sectionClass} items-center justify-center text-center`}
                style={sectionStyle(stage.index)}
              >
                <div ref={register(stage.index)} className="w-full max-w-2xl will-change-[opacity]">
                  <Marker text={stage.marker} />
                  <h2
                    id={`${stage.id}-titulo`}
                    className="readable mt-5 text-balance text-3xl leading-[1.1] font-medium sm:text-5xl"
                  >
                    {stage.title}
                  </h2>
                  <p className="readable mx-auto mt-6 max-w-xl text-base text-[#c3c9d6] sm:text-lg">
                    {stage.body}
                  </p>
                  <StageBody stage={stage} />
                  {stage.index === 0 && (
                    <p
                      className="mt-14 font-display text-xs uppercase tracking-[0.3em] text-[#9ba4b7]"
                      aria-hidden="true"
                    >
                      role para continuar
                    </p>
                  )}
                </div>
              </section>
            );
          }

          if (stage.layout === "opposed" && stage.counterpart) {
            return (
              <section
                key={stage.id}
                id={stage.id}
                aria-labelledby={`${stage.id}-titulo`}
                className={`${sectionClass} items-center`}
                style={sectionStyle(stage.index)}
              >
                <div
                  ref={register(stage.index)}
                  className="mx-auto grid w-full max-w-6xl items-center gap-8 will-change-[opacity] lg:grid-cols-[1fr_minmax(160px,22vw)_1fr] lg:gap-12"
                >
                  <div className="lg:max-w-sm lg:justify-self-end lg:text-right">
                    <Marker text={stage.marker} />
                    <h2
                      id={`${stage.id}-titulo`}
                      className="readable mt-5 text-3xl leading-[1.1] font-medium sm:text-4xl"
                    >
                      {stage.title}
                    </h2>
                    <p className="readable mt-5 text-[#c3c9d6]">{stage.body}</p>
                    {stage.counterpart.highlights && (
                      <Highlights items={stage.counterpart.highlights} align="right" />
                    )}
                  </div>
                  <div aria-hidden="true" className="hidden lg:block" />
                  <div className="lg:max-w-sm lg:justify-self-start">
                    <h2 className="readable text-3xl leading-[1.1] font-medium sm:text-4xl">
                      {stage.counterpart.title}
                    </h2>
                    <p className="readable mt-5 text-[#c3c9d6]">{stage.counterpart.body}</p>
                    {stage.flow && <StageBody stage={stage} />}
                  </div>
                </div>
              </section>
            );
          }

          // Cilindro: o objeto ocupa o centro da tela de alto a baixo, entao o
          // texto vai para a coluna esquerda da mesma grade da helice.
          if (stage.layout === "side") {
            return (
              <section
                key={stage.id}
                id={stage.id}
                aria-labelledby={`${stage.id}-titulo`}
                className={`${sectionClass} items-center`}
                style={sectionStyle(stage.index)}
              >
                <div
                  ref={register(stage.index)}
                  className="mx-auto grid w-full max-w-6xl items-center gap-8 will-change-[opacity] lg:grid-cols-[1fr_minmax(160px,26vw)_1fr] lg:gap-12"
                >
                  <div className="lg:max-w-sm lg:justify-self-end lg:text-right">
                    <Marker text={stage.marker} />
                    <h2
                      id={`${stage.id}-titulo`}
                      className="readable mt-5 text-balance text-3xl leading-[1.1] font-medium sm:text-4xl"
                    >
                      {stage.title}
                    </h2>
                    <p className="readable mt-5 text-[#c3c9d6]">{stage.body}</p>
                    {stage.highlights && <Highlights items={stage.highlights} align="right" />}
                  </div>
                  <div aria-hidden="true" className="hidden lg:block" />
                  <div aria-hidden="true" className="hidden lg:block" />
                </div>
              </section>
            );
          }

          return (
            <section
              key={stage.id}
              id={stage.id}
              aria-labelledby={`${stage.id}-titulo`}
              className={`${sectionClass} items-center`}
              style={sectionStyle(stage.index)}
            >
              <div ref={register(stage.index)} className="mx-auto w-full max-w-3xl will-change-[opacity]">
                <Marker text={stage.marker} />
                <h2
                  id={`${stage.id}-titulo`}
                  className="readable mt-5 text-balance text-3xl leading-[1.1] font-medium sm:text-5xl lg:text-6xl"
                >
                  {stage.title}
                </h2>
                <p className="readable mt-6 max-w-2xl text-base text-[#c3c9d6] sm:text-lg">{stage.body}</p>
                {stage.highlights && <Highlights items={stage.highlights} />}
                <StageBody stage={stage} />
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export default Narrative;
