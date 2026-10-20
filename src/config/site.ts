/**
 * Dados institucionais. Nada aqui é inventado: campos ainda indefinidos ficam
 * como string vazia e a interface omite o que estiver vazio.
 */
export const site = {
  name: "Tonarq",
  shortName: "Tonarq",
  tagline: "Sistemas que pensam. Produtos que executam.",
  description:
    "Criamos agentes autônomos, pipelines de IA e software completo — da infraestrutura à experiência que chega ao usuário.",
  url: "",
  email: "",
  whatsapp: "",
  phone: "",
  social: {
    linkedin: "",
    instagram: "",
    github: "",
  },
  legal: {
    legalName: "",
    cnpj: "",
    address: "",
    city: "",
    state: "",
  },
  /** Endpoint que recebe o formulário. Vazio usa a rota interna /api/contato. */
  contactEndpoint: "",
} as const;

export const nav = [
  { label: "Soluções", href: "#solucoes" },
  { label: "Processo", href: "#processo" },
  { label: "Tecnologia", href: "#tecnologia" },
  { label: "Contato", href: "#contato" },
] as const;

export function hasValue(value: string): boolean {
  return value.trim().length > 0;
}
