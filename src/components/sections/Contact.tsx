import ContactForm from "@/components/contact/ContactForm";

/**
 * Formulário sobre painel sólido.
 *
 * Deixar o campo de partículas aparecer atrás de um formulário destrói a
 * leitura: rótulo e placeholder somem no ruído luminoso. Aqui a atmosfera fica
 * ao redor do painel, não atrás do texto que precisa ser lido.
 */
export function Contact() {
  return (
    <section
      id="contato"
      aria-labelledby="contato-titulo"
      className="relative z-10 px-4 py-32 sm:px-6"
    >
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/12 bg-[#05070f] p-6 shadow-[0_0_80px_rgba(3,4,10,0.9)] sm:p-10">
        <p className="font-display text-xs uppercase tracking-[0.28em] text-[#5cf6ff]">
          Contato
        </p>
        <h2
          id="contato-titulo"
          className="mt-5 text-3xl leading-tight font-medium sm:text-4xl"
        >
          Descreva o processo. Nós desenhamos a solução.
        </h2>
        <p className="mt-5 text-[#c3c9d6]">
          Quanto mais concreto o processo — quem executa, em qual ferramenta e com
          que volume — mais preciso é o diagnóstico.
        </p>
        <ContactForm />
      </div>
    </section>
  );
}

export default Contact;
