import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const VALIDO = {
  nome: "Ana Souza",
  empresa: "Empresa Exemplo",
  email: "ana@exemplo.com",
  telefone: "",
  descricao: "Precisamos automatizar a triagem dos pedidos que chegam.",
  website: "",
};

function requisicao(corpo: unknown) {
  return new Request("http://localhost/api/contato", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

describe("POST /api/contato", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_teste");
    fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("encaminha o contato para o e-mail da Tonarq via Resend", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ id: "1" }), { status: 200 }));

    const resposta = await POST(requisicao(VALIDO));

    expect(resposta.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_teste");
    const enviado = JSON.parse(String(init.body));
    expect(enviado.to).toEqual(["tonarqjcl@gmail.com"]);
    expect(enviado.reply_to).toBe("ana@exemplo.com");
    expect(enviado.subject).toBe("Contato pelo site: Empresa Exemplo");
    expect(enviado.text).toContain("Nome: Ana Souza");
    expect(enviado.text).toContain("Telefone: não informado");
    expect(enviado.text).toContain(VALIDO.descricao);
  });

  it("responde 503 sem chamar o Resend quando a chave não está configurada", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    const resposta = await POST(requisicao(VALIDO));

    expect(resposta.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("responde 502 quando o Resend recusa o envio", async () => {
    fetchSpy.mockResolvedValue(new Response("{}", { status: 403 }));

    const resposta = await POST(requisicao(VALIDO));

    expect(resposta.status).toBe(502);
  });

  it("responde 502 quando a chamada ao Resend falha na rede", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));

    const resposta = await POST(requisicao(VALIDO));

    expect(resposta.status).toBe(502);
  });

  it("rejeita campos inválidos sem enviar e-mail", async () => {
    const resposta = await POST(requisicao({ ...VALIDO, email: "invalido", descricao: "curta" }));

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erros).toEqual(["email", "descricao"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita JSON inválido sem enviar e-mail", async () => {
    const resposta = await POST(requisicao("{"));

    expect(resposta.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignora envio de robô sem enviar e-mail", async () => {
    const resposta = await POST(requisicao({ ...VALIDO, website: "http://spam" }));

    expect(resposta.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
