import { NextResponse } from "next/server";

const LIMITES = {
  nome: 200,
  empresa: 200,
  email: 254,
  telefone: 40,
  descricao: 4000,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Rota padrão do formulário. Valida e registra; não integra com serviço
 * externo enquanto o endpoint definitivo não estiver definido em site.ts.
 */
export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  // Armadilha de robô preenchida: responde ok sem registrar nada.
  if (String(payload.website ?? "").length > 0) {
    return NextResponse.json({ ok: true });
  }

  const texto = (campo: keyof typeof LIMITES) =>
    String(payload[campo] ?? "").trim();

  const nome = texto("nome");
  const empresa = texto("empresa");
  const email = texto("email");
  const descricao = texto("descricao");

  const erros: string[] = [];
  if (nome.length < 2) erros.push("nome");
  if (empresa.length < 2) erros.push("empresa");
  if (!EMAIL_RE.test(email)) erros.push("email");
  if (descricao.length < 20) erros.push("descricao");

  for (const [campo, limite] of Object.entries(LIMITES)) {
    if (texto(campo as keyof typeof LIMITES).length > limite) {
      erros.push(campo);
    }
  }

  if (erros.length > 0) {
    return NextResponse.json({ erro: "campos inválidos", erros }, { status: 422 });
  }

  console.info("[contato] novo envio", { empresa, email });
  return NextResponse.json({ ok: true });
}
