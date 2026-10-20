"use client";

import { useRef, useState } from "react";

import { site } from "@/config/site";

type Status = "idle" | "sending" | "success" | "error";

interface Errors {
  nome?: string;
  empresa?: string;
  email?: string;
  descricao?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_INTERVAL_MS = 15000;

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const lastSubmit = useRef(0);

  function validate(data: FormData): Errors {
    const found: Errors = {};
    const nome = String(data.get("nome") ?? "").trim();
    const empresa = String(data.get("empresa") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const descricao = String(data.get("descricao") ?? "").trim();

    if (nome.length < 2) found.nome = "Informe seu nome.";
    if (empresa.length < 2) found.empresa = "Informe a empresa.";
    if (!EMAIL_RE.test(email)) found.email = "Informe um e-mail válido.";
    if (descricao.length < 20)
      found.descricao = "Descreva o projeto com pelo menos 20 caracteres.";
    return found;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    // Armadilha para robô: campo escondido preenchido significa envio automático.
    if (String(data.get("website") ?? "").length > 0) {
      setStatus("success");
      return;
    }

    const found = validate(data);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setStatus("error");
      setMessage("Revise os campos destacados.");
      return;
    }

    const agora = Date.now();
    if (agora - lastSubmit.current < RESEND_INTERVAL_MS) {
      setStatus("error");
      setMessage("Aguarde alguns segundos antes de enviar de novo.");
      return;
    }

    setStatus("sending");
    setMessage("");
    try {
      const endpoint = site.contactEndpoint || "/api/contato";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(data.entries())),
      });
      if (!response.ok) throw new Error(String(response.status));

      lastSubmit.current = agora;
      setStatus("success");
      setMessage("Recebido. Retornamos com os próximos passos.");
      form.reset();
    } catch {
      setStatus("error");
      setMessage("Não foi possível enviar agora. Tente novamente em instantes.");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/18 bg-[#0b0f1a] px-4 py-3 text-[#f7f8fc] placeholder:text-[#9ba4b7] focus:border-[#5cf6ff]/70";

  return (
    <form onSubmit={onSubmit} noValidate className="mt-10 grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nome" className="block text-sm font-medium text-[#c3c9d6]">
            Nome
          </label>
          <input
            id="nome"
            name="nome"
            type="text"
            required
            autoComplete="name"
            aria-invalid={Boolean(errors.nome)}
            aria-describedby={errors.nome ? "erro-nome" : undefined}
            className={`mt-2 ${inputClass}`}
          />
          {errors.nome && (
            <p id="erro-nome" role="alert" className="mt-1 text-xs text-[#ff4fd8]">
              {errors.nome}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="empresa" className="block text-sm font-medium text-[#c3c9d6]">
            Empresa
          </label>
          <input
            id="empresa"
            name="empresa"
            type="text"
            required
            autoComplete="organization"
            aria-invalid={Boolean(errors.empresa)}
            aria-describedby={errors.empresa ? "erro-empresa" : undefined}
            className={`mt-2 ${inputClass}`}
          />
          {errors.empresa && (
            <p id="erro-empresa" role="alert" className="mt-1 text-xs text-[#ff4fd8]">
              {errors.empresa}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[#c3c9d6]">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "erro-email" : undefined}
            className={`mt-2 ${inputClass}`}
          />
          {errors.email && (
            <p id="erro-email" role="alert" className="mt-1 text-xs text-[#ff4fd8]">
              {errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="telefone" className="block text-sm font-medium text-[#c3c9d6]">
            Telefone ou WhatsApp <span className="text-[#9ba4b7]">(opcional)</span>
          </label>
          <input
            id="telefone"
            name="telefone"
            type="tel"
            autoComplete="tel"
            className={`mt-2 ${inputClass}`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="descricao" className="block text-sm font-medium text-[#c3c9d6]">
          O que precisa executar melhor
        </label>
        <textarea
          id="descricao"
          name="descricao"
          rows={5}
          required
          aria-invalid={Boolean(errors.descricao)}
          aria-describedby={errors.descricao ? "erro-descricao" : undefined}
          className={`mt-2 ${inputClass}`}
        />
        {errors.descricao && (
          <p id="erro-descricao" role="alert" className="mt-1 text-xs text-[#ff4fd8]">
            {errors.descricao}
          </p>
        )}
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Não preencha este campo</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-full bg-[#5cf6ff] px-6 py-3 text-sm font-medium text-[#03040a] disabled:opacity-60"
        >
          {status === "sending" ? "Enviando…" : "Enviar"}
        </button>
        <p
          role="status"
          aria-live="polite"
          className={`text-sm ${
            status === "error" ? "text-[#ff4fd8]" : "text-[#5cf6ff]"
          }`}
        >
          {message}
        </p>
      </div>
    </form>
  );
}

export default ContactForm;
