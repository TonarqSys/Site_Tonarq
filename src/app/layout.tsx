import type { Metadata, Viewport } from "next";
import { Geist, Space_Grotesk } from "next/font/google";

import { hasValue, site } from "@/config/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const title = hasValue(site.name)
  ? `${site.name} — ${site.tagline}`
  : site.tagline;

export const metadata: Metadata = {
  title,
  description: site.description,
  ...(hasValue(site.url) ? { metadataBase: new URL(site.url) } : {}),
  openGraph: {
    title,
    description: site.description,
    type: "website",
    locale: "pt_BR",
    ...(hasValue(site.name) ? { siteName: site.name } : {}),
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#03040A",
  width: "device-width",
  initialScale: 1,
};

function schema() {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    description: site.description,
    areaServed: "BR",
    knowsAbout: [
      "Agentes autônomos",
      "Pipelines de inteligência artificial",
      "RAG",
      "Integrações de sistemas",
      "Engenharia de software",
    ],
  };
  // Só entra no schema o que realmente existe; nada é preenchido por suposição.
  if (hasValue(site.name)) data.name = site.name;
  if (hasValue(site.url)) data.url = site.url;
  if (hasValue(site.email)) data.email = site.email;
  if (hasValue(site.legal.legalName)) data.legalName = site.legal.legalName;
  return data;
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${spaceGrotesk.variable} antialiased`}
      >
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            // Escapa `<` para nenhum valor conseguir fechar a tag script.
            __html: JSON.stringify(schema()).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
