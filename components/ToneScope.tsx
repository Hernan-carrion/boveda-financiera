"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { buscarSeccion } from "@/lib/nav";

/**
 * Marca el contenido con el pilar de la ruta actual (data-tone), así los
 * acentos que usan el color `section` (títulos de sección, links en texto)
 * siguen el color del sidebar: violeta en Vida, esmeralda en Finanzas.
 * Con export estático la ruta se conoce en el prerender: no hay parpadeo.
 */
export default function ToneScope({ children }: { children: ReactNode }) {
  const raw = usePathname() ?? "/";
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  const { tone } = buscarSeccion(path);
  return (
    <div data-tone={tone} className="contents">
      {children}
    </div>
  );
}
