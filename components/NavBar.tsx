"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups, configLink, TONE, type NavLink } from "@/lib/nav";

/**
 * En GitHub Pages de proyecto el sitio vive bajo /boveda-financiera. Un <img>
 * plano no recibe el basePath solo (a diferencia de <Link>), así que lo
 * anteponemos a mano — mismo patrón que ServiceWorkerRegister.tsx.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Con `trailingSlash: true` el pathname puede venir como "/tareas/". */
function normalizar(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function NavItem({
  link,
  tone,
  activo,
  onNavigate,
}: {
  link: NavLink;
  tone: keyof typeof TONE;
  activo: boolean;
  onNavigate?: () => void;
}) {
  const { href, label, Icon } = link;
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onNavigate}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
        "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-transparent",
        activo
          ? cn("font-medium", TONE[tone].active)
          : "text-muted hover:bg-white/5 hover:text-zinc-100",
      )}
    >
      <Icon
        size={17}
        aria-hidden
        className={cn("shrink-0", activo ? TONE[tone].icon : "text-subtle")}
      />
      {label}
    </Link>
  );
}

function NavContenido({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      {navGroups.map((grupo) => (
        <div key={grupo.label} className="flex flex-col gap-1">
          <p
            className={cn(
              "px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider",
              TONE[grupo.tone].heading,
            )}
          >
            {grupo.label}
          </p>
          {grupo.links.map((link) => (
            <NavItem
              key={link.href}
              link={link}
              tone={grupo.tone}
              activo={pathname === link.href}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
      <div className="mt-auto border-t border-line pt-4">
        <NavItem
          link={configLink}
          tone="neutral"
          activo={pathname === configLink.href}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

function Logo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      prefetch={false}
      onClick={onNavigate}
      className="inline-flex shrink-0 rounded-lg"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- export estático, sin loader de next/image */}
      <img
        src={`${BASE}/logo-header.png`}
        alt="Huella — ir al dashboard"
        width={120}
        height={40}
        className="h-10 w-auto"
      />
    </Link>
  );
}

export default function NavBar() {
  const pathname = normalizar(usePathname() ?? "/");
  const [abierto, setAbierto] = useState(false);
  const cerrar = () => setAbierto(false);

  // Drawer mobile: Escape cierra y el fondo no scrollea mientras está abierto.
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflowPrevio;
      window.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      {/* Desktop: sidebar fijo */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-zinc-950/70 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <nav
          aria-label="Principal"
          className="flex flex-1 flex-col overflow-y-auto px-3 pb-5 pt-2 [scrollbar-width:thin]"
        >
          <NavContenido pathname={pathname} />
        </nav>
      </aside>

      {/* Mobile / tablet: barra superior + drawer */}
      <header className="sticky top-0 z-30 border-b border-line bg-zinc-950/80 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <Logo />
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={abierto}
            aria-controls="menu-mobile"
            onClick={() => setAbierto(true)}
            className="grid size-11 place-items-center rounded-lg text-zinc-200 transition-colors hover:bg-white/5"
          >
            <Menu size={20} aria-hidden />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {abierto && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              aria-hidden
              onClick={cerrar}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            />
            <motion.nav
              id="menu-mobile"
              aria-label="Principal"
              className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col overflow-y-auto border-r border-line bg-zinc-950 px-3 pb-6 shadow-2xl shadow-black/60"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%", transition: { duration: 0.18, ease: "easeIn" } }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <div className="flex h-14 shrink-0 items-center justify-between pl-2">
                <Logo onNavigate={cerrar} />
                <button
                  type="button"
                  aria-label="Cerrar menú"
                  onClick={cerrar}
                  autoFocus
                  className="grid size-11 place-items-center rounded-lg text-zinc-200 transition-colors hover:bg-white/5"
                >
                  <X size={20} aria-hidden />
                </button>
              </div>
              <div className="flex flex-1 flex-col pt-2">
                <NavContenido pathname={pathname} onNavigate={cerrar} />
              </div>
            </motion.nav>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
