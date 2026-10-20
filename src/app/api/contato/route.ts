import { NextResponse } from "next/server";

const LIMITES = {
  nome: 200,
  empresa: 200,
  email: 254,
  telefone: 40,
  descricao: 4000,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const RESEND_URL = "https://api.resend.com/emails";
const DESTINO = "tonarqjcl@gmail.com";
/** O remetente resend.dev só entrega para o e-mail dono da conta Resend. */
const REMETENTE = "Site Tonarq <onboarding@resend.dev>";

/**
 * Rota padrão do formulário. Valida e encaminha por e-mail via Resend;
 * exige RESEND_API_KEY no ambiente.
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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[contato] RESEND_API_KEY não configurada");
    return NextResponse.json({ erro: "envio indisponível" }, { status: 503 });
  }

  const telefone = texto("telefone");
  const corpo = [
    `Nome: ${nome}`,
    `Empresa: ${empresa}`,
    `E-mail: ${email}`,
    `Telefone: ${telefone || "não informado"}`,
    "",
    descricao,
  ].join("\n");

  let resposta: Response;
  try {
    resposta = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: REMETENTE,
        to: [DESTINO],
        reply_to: email,
        subject: `Contato pelo site: ${empresa}`.replace(/[\r\n]+/g, " "),
        text: corpo,
      }),
    });
  } catch (erro) {
    console.error("[contato] falha de rede no envio", erro);
    return NextResponse.json({ erro: "falha no envio" }, { status: 502 });
  }

  if (!resposta.ok) {
    console.error("[contato] Resend recusou o envio", resposta.status, await resposta.text());
    return NextResponse.json({ erro: "falha no envio" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
