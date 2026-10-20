export type StageLayout = "center" | "opposed" | "side" | "default";

export interface StageBlock {
  title: string;
  body: string;
  highlights?: readonly string[];
}

export interface Stage {
  id: string;
  index: number;
  marker: string;
  layout: StageLayout;
  title: string;
  body: string;
  /** Segundo bloco, usado no estágio de layout oposto. */
  counterpart?: StageBlock;
  highlights?: readonly string[];
  flow?: readonly string[];
  cards?: readonly { title: string; body: string }[];
  ctas?: readonly { label: string; href: string; primary?: boolean }[];
}

export const stages: readonly Stage[] = [
  {
    id: "orbe",
    index: 0,
    marker: "01 — Origem",
    layout: "center",
    title: "Sistemas que pensam. Produtos que executam.",
    body: "Criamos agentes autônomos, pipelines de IA e software completo — da infraestrutura à experiência que chega ao usuário.",
    ctas: [
      { label: "Transformar uma operação", href: "#contato", primary: true },
      { label: "Conhecer nossas soluções", href: "#processo" },
    ],
  },
  {
    id: "cilindro",
    index: 1,
    marker: "02 — Inteligência",
    layout: "side",
    title: "Inteligência que participa da operação.",
    body: "Desenvolvemos agentes capazes de analisar contexto, tomar decisões, utilizar ferramentas e executar processos com supervisão, rastreabilidade e limites definidos.",
    highlights: [
      "Agentes comerciais",
      "Atendimento inteligente",
      "Operações autônomas",
      "Assistentes internos",
    ],
  },
  {
    id: "dna",
    index: 2,
    marker: "03 — Fluxo",
    layout: "opposed",
    title: "IA conectada aos seus sistemas.",
    body: "Modelos isolados não transformam empresas. Construímos pipelines que conectam inteligência artificial, dados, APIs, documentos e sistemas existentes.",
    counterpart: {
      title: "Do dado bruto à ação.",
      body: "Projetamos fluxos confiáveis para coletar, validar, transformar e entregar informações no ponto certo da operação.",
      highlights: [
        "RAG e bases de conhecimento",
        "Orquestração de modelos",
        "Processamento de documentos",
      ],
    },
    flow: ["Entrada", "Contexto", "Decisão", "Execução", "Auditoria"],
  },
  {
    id: "estrada",
    index: 3,
    marker: "04 — Engenharia",
    layout: "default",
    title: "Engenharia de ponta a ponta.",
    body: "Construímos produtos digitais completos, combinando interfaces de alta qualidade, arquiteturas backend, bancos de dados, segurança, observabilidade e infraestrutura.",
    cards: [
      {
        title: "Frontend",
        body: "Interfaces acessíveis, rápidas e sustentáveis, do design system à entrega.",
      },
      {
        title: "Backend e APIs",
        body: "Serviços versionados, autorização por objeto e contratos estáveis.",
      },
      {
        title: "Dados e integrações",
        body: "Modelagem, migrações reversíveis e conexão com sistemas existentes.",
      },
      {
        title: "Cloud e observabilidade",
        body: "Infraestrutura reproduzível, métricas, logs e rastreamento em produção.",
      },
    ],
  },
  {
    id: "tunel",
    index: 4,
    marker: "05 — Convergência",
    layout: "default",
    title: "Uma operação, não um punhado de ferramentas.",
    body: "Sistemas soltos criam retrabalho em vez de removê-lo. O que entregamos converge num fluxo único, com os dados atravessando cada etapa sem reentrada manual.",
  },
  {
    id: "galaxia",
    index: 5,
    marker: "06 — Escala",
    layout: "center",
    title: "Transforme um processo crítico em vantagem operacional.",
    body: "Conte o que sua empresa precisa executar melhor. Nós projetamos a solução, integramos os sistemas e colocamos a operação em funcionamento.",
    ctas: [
      { label: "Falar sobre um projeto", href: "#contato", primary: true },
      { label: "Solicitar diagnóstico", href: "#contato" },
    ],
  },
] as const;

export const processSteps = [
  {
    title: "Diagnóstico",
    body: "Mapeamos o processo atual, onde o trabalho manual se acumula e o que é medível.",
  },
  {
    title: "Desenho da solução",
    body: "Definimos escopo, integrações necessárias, riscos e o critério de pronto.",
  },
  {
    title: "Construção",
    body: "Entregamos em fatias verticais funcionais, com testes e revisão a cada etapa.",
  },
  {
    title: "Operação",
    body: "Colocamos em produção com observabilidade, limites definidos e acompanhamento.",
  },
] as const;

export const techGroups = [
  {
    title: "Inteligência",
    items: ["Agentes com ferramentas", "RAG", "Orquestração de modelos", "Avaliações"],
  },
  {
    title: "Aplicação",
    items: ["TypeScript", "React e Next.js", "Python", "APIs HTTP"],
  },
  {
    title: "Dados",
    items: ["PostgreSQL", "Filas e jobs", "Pipelines", "Integrações"],
  },
  {
    title: "Operação",
    items: ["Containers", "CI/CD", "Observabilidade", "Segurança"],
  },
] as const;
