"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

import { hasValue, nav, site } from "@/config/site";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const brand = hasValue(site.name) ? site.name : "Configurar nome";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-[#03040a]/92" : "bg-transparent"
      }`}
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[#080b14] focus:px-4 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <nav
        aria-label="Principal"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6"
      >
        <a href="#topo" className="flex items-center" aria-label={brand}>
          <Image
            src="/tonarq-logo.svg"
            alt={brand}
            width={300}
            height={100}
            priority
            unoptimized
            className="h-8 w-auto"
          />
        </a>
        <ul className="hidden items-center gap-7 md:flex">
          {nav.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="text-sm text-[#9ba4b7] transition-colors hover:text-[#f7f8fc]"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <a
          href="#contato"
          className="rounded-full border border-[#5cf6ff]/40 px-4 py-1.5 text-sm text-[#5cf6ff] transition-colors hover:bg-[#5cf6ff]/10"
        >
          Falar com engenharia
        </a>
      </nav>
    </header>
  );
}

export default Navbar;
