import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import ContactForm from "@/components/contact/ContactForm";
import Footer from "@/components/layout/Footer";
import Narrative from "@/components/sections/Narrative";
import Navbar from "@/components/layout/Navbar";
import Process from "@/components/sections/Process";
import { nav } from "@/config/site";
import { stages } from "@/content/stages";

function Page() {
  return (
    <>
      <Navbar />
      <main id="conteudo">
        <Narrative />
        <Process />
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}

describe("conteúdo principal", () => {
  it("renderiza a página sem quebrar", () => {
    render(<Page />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("mostra o título de todos os estágios da narrativa", () => {
    render(<Narrative />);
    for (const stage of stages) {
      expect(
        screen.getByRole("heading", { name: stage.title }),
      ).toBeInTheDocument();
    }
  });

  it("mantém uma seção por estágio", () => {
    const { container } = render(<Narrative />);
    for (const stage of stages) {
      expect(container.querySelector(`#${stage.id}`)).not.toBeNull();
    }
  });

  it("apresenta os dois textos opostos da hélice", () => {
    render(<Narrative />);
    expect(
      screen.getByRole("heading", { name: "IA conectada aos seus sistemas." }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Do dado bruto à ação." }),
    ).toBeInTheDocument();
  });

  it("apresenta o fluxo do estágio de pipeline", () => {
    render(<Narrative />);
    for (const step of ["Entrada", "Contexto", "Decisão", "Execução", "Auditoria"]) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });

  it("apresenta os quatro cards de engenharia", () => {
    render(<Narrative />);
    for (const card of ["Frontend", "Backend e APIs", "Dados e integrações", "Cloud e observabilidade"]) {
      expect(screen.getByRole("heading", { name: card })).toBeInTheDocument();
    }
  });

  it("descreve o processo de trabalho", () => {
    render(<Process />);
    expect(
      screen.getByRole("heading", { name: /diagnóstico primeiro/i }),
    ).toBeInTheDocument();
  });
});

describe("navegação", () => {
  it("expõe os links principais", () => {
    render(<Navbar />);
    const menu = screen.getByRole("navigation", { name: "Principal" });
    for (const item of nav) {
      expect(within(menu).getByRole("link", { name: item.label })).toHaveAttribute(
        "href",
        item.href,
      );
    }
  });

  it("oferece atalho para pular ao conteúdo", () => {
    render(<Navbar />);
    expect(
      screen.getByRole("link", { name: /pular para o conteúdo/i }),
    ).toHaveAttribute("href", "#conteudo");
  });

  it("não inventa redes sociais quando não configuradas", () => {
    render(<Footer />);
    expect(screen.queryByRole("link", { name: /linkedin/i })).toBeNull();
  });
});

describe("experiência visual", () => {
  it("usa o fallback estático quando não há WebGL", async () => {
    render(<Narrative />);
    await waitFor(() =>
      expect(screen.getByTestId("webgl-fallback")).toBeInTheDocument(),
    );
  });

  it("mantém o canvas fora da árvore de acessibilidade", async () => {
    render(<Narrative />);
    await waitFor(() =>
      expect(screen.getByTestId("particle-experience")).toHaveAttribute(
        "aria-hidden",
        "true",
      ),
    );
  });
});

describe("formulário de contato", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("expõe todos os campos rotulados", () => {
    render(<ContactForm />);
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(screen.getByLabelText("Empresa")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText(/telefone ou whatsapp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/o que precisa executar melhor/i)).toBeInTheDocument();
  });

  it("recusa envio incompleto e aponta o erro", async () => {
    const user = userEvent.setup({ delay: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ContactForm />);

    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Informe seu nome.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("valida formato de e-mail", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ContactForm />);

    await user.type(screen.getByLabelText("Nome"), "Jonas");
    await user.type(screen.getByLabelText("Empresa"), "Empresa");
    await user.type(screen.getByLabelText("E-mail"), "invalido");
    await user.type(
      screen.getByLabelText(/o que precisa executar melhor/i),
      "Precisamos automatizar a triagem de atendimento.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(
      await screen.findByText("Informe um e-mail válido."),
    ).toBeInTheDocument();
  });

  it("envia quando os dados são válidos", async () => {
    const user = userEvent.setup({ delay: null });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    render(<ContactForm />);
    await user.type(screen.getByLabelText("Nome"), "Jonas");
    await user.type(screen.getByLabelText("Empresa"), "Empresa");
    await user.type(screen.getByLabelText("E-mail"), "jonas@empresa.test");
    await user.type(
      screen.getByLabelText(/o que precisa executar melhor/i),
      "Precisamos automatizar a triagem de atendimento no WhatsApp.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/retornamos com os próximos passos/i)).toBeInTheDocument();
  });

  it("mostra erro quando o envio falha", async () => {
    const user = userEvent.setup({ delay: null });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("erro", { status: 500 }),
    );

    render(<ContactForm />);
    await user.type(screen.getByLabelText("Nome"), "Jonas");
    await user.type(screen.getByLabelText("Empresa"), "Empresa");
    await user.type(screen.getByLabelText("E-mail"), "jonas@empresa.test");
    await user.type(
      screen.getByLabelText(/o que precisa executar melhor/i),
      "Precisamos automatizar a triagem de atendimento no WhatsApp.",
    );
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(
      await screen.findByText(/não foi possível enviar agora/i),
    ).toBeInTheDocument();
  });

  it("ignora envio de robô que preenche o campo oculto", async () => {
    const user = userEvent.setup({ delay: null });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(<ContactForm />);

    const armadilha = container.querySelector<HTMLInputElement>("#website")!;
    armadilha.value = "http://spam.test";
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("layout responsivo", () => {
  it("não usa largura fixa maior que a viewport", () => {
    const { container } = render(<Page />);
    const largos = container.querySelectorAll<HTMLElement>("[style*='width']");
    for (const elemento of largos) {
      expect(elemento.style.width).not.toMatch(/^\d{4,}px$/);
    }
  });

  it("reserva altura da narrativa em unidades relativas", () => {
    const { container } = render(<Narrative />);
    // Container com altura definida (as secoes sao absolutas dentro dele) e
    // cada secao posicionada e dimensionada em vh.
    const narrativa = container.querySelector<HTMLElement>("#narrativa")!;
    expect(narrativa.style.height).toMatch(/vh$/);
    for (const section of container.querySelectorAll<HTMLElement>("#narrativa > section")) {
      expect(section.style.minHeight).toMatch(/vh$/);
      expect(section.style.top).toMatch(/vh$/);
    }
  });
});
