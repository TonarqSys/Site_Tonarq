import { processSteps, techGroups } from "@/content/stages";

/**
 * Fecho da narrativa, não uma landing genérica colada no fim.
 *
 * Sem fundo opaco: o campo de partículas continua vivo atrás, e a separação
 * vem de filete e tipografia, não de caixas empilhadas.
 */
export function Process() {
  return (
    <section
      id="processo"
      aria-labelledby="processo-titulo"
      className="relative z-10 px-4 py-32 sm:px-6"
    >
      <div className="mx-auto w-full max-w-6xl">
        <p className="font-display text-xs uppercase tracking-[0.28em] text-[#5cf6ff]">
          Como trabalhamos
        </p>
        <h2
          id="processo-titulo"
          className="readable mt-5 max-w-2xl text-3xl leading-tight font-medium sm:text-4xl"
        >
          Diagnóstico primeiro. Código depois.
        </h2>
        <p className="readable mt-5 max-w-2xl text-[#c3c9d6]">
          Não propomos ferramenta antes de entender a operação. O escopo sai do
          diagnóstico, e o critério de pronto é definido antes de começar.
        </p>

        <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step, index) => (
            <li
              key={step.title}
              className="bg-[#05070f]/94 p-7"
            >
              <span className="font-display text-xs text-[#3478ff]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-lg font-medium">{step.title}</h3>
              <p className="mt-2 text-sm text-[#c3c9d6]">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div id="tecnologia" className="mx-auto mt-32 w-full max-w-6xl">
        <p className="font-display text-xs uppercase tracking-[0.28em] text-[#8b5cf6]">
          Tecnologia
        </p>
        <h2 className="readable mt-5 max-w-2xl text-3xl leading-tight font-medium sm:text-4xl">
          Escolhas que sustentam operação real.
        </h2>

        <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {techGroups.map((group) => (
            <article key={group.title}>
              <h3 className="font-display border-b border-white/12 pb-3 text-sm tracking-wide text-[#5cf6ff]">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {group.items.map((item) => (
                  <li key={item} className="readable text-sm text-[#c3c9d6]">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Process;
