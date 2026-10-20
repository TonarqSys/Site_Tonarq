import Image from "next/image";

import { hasValue, nav, site } from "@/config/site";

export function Footer() {
  const social = Object.entries(site.social).filter(([, url]) => hasValue(url));

  return (
    <footer className="relative z-10 border-t border-white/10 bg-gradient-to-b from-transparent to-[#03040a]/85">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Image
              src="/tonarq-logo.svg"
              alt={hasValue(site.name) ? site.name : "Configurar nome"}
              width={300}
              height={100}
              unoptimized
              className="h-7 w-auto"
            />
            <p className="mt-3 text-sm text-[#9ba4b7]">{site.description}</p>
          </div>

          <nav aria-label="Rodapé">
            <ul className="flex flex-col gap-2">
              {nav.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-[#9ba4b7] hover:text-[#f7f8fc]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="text-sm text-[#9ba4b7]">
            {hasValue(site.email) && (
              <p>
                <a className="hover:text-[#f7f8fc]" href={`mailto:${site.email}`}>
                  {site.email}
                </a>
              </p>
            )}
            {hasValue(site.whatsapp) && (
              <p className="mt-2">
                <a
                  className="hover:text-[#f7f8fc]"
                  href={`https://wa.me/${site.whatsapp.replace(/\D/g, "")}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  WhatsApp
                </a>
              </p>
            )}
            {social.length > 0 && (
              <ul className="mt-3 flex gap-4">
                {social.map(([label, url]) => (
                  <li key={label}>
                    <a
                      className="capitalize hover:text-[#f7f8fc]"
                      href={url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="mt-10 text-xs text-[#9ba4b7]">
          {hasValue(site.legal.legalName) ? `${site.legal.legalName} — ` : ""}
          {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}

export default Footer;
