"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Wallet,
  PieChart,
  History,
  CreditCard,
  HandCoins,
  Coins,
  Settings,
  Target,
  Repeat,
  PiggyBank,
  BarChart3,
  Receipt,
  CalendarCheck,
  ListFilter,
  CheckSquare,
  Bell,
  StickyNote,
  Sun,
  Flame,
  Menu,
  X,
} from "lucide-react";

/**
 * Dos pilares (ver la vista previa de diseño que aprobó el usuario): Vida en
 * violeta, Finanzas en esmeralda. En mobile colapsa a un menú hamburguesa —
 * antes la lista completa de 19 links ocupaba toda la primera pantalla y
 * tapaba el contenido de cada página.
 */
const navGroups: {
  label: string;
  accentClass: string;
  links: { href: string; label: string; Icon: typeof Wallet }[];
}[] = [
  {
    label: "Vida",
    accentClass: "text-violet-400",
    links: [
      { href: "/hoy", label: "Hoy", Icon: Sun },
      { href: "/tareas", label: "Tareas", Icon: CheckSquare },
      { href: "/habitos", label: "Hábitos", Icon: Flame },
      { href: "/recordatorios", label: "Recordatorios", Icon: Bell },
      { href: "/notas", label: "Notas", Icon: StickyNote },
    ],
  },
  {
    label: "Finanzas",
    accentClass: "text-emerald-400",
    links: [
      { href: "/", label: "Dashboard", Icon: Wallet },
      { href: "/movimientos", label: "Movimientos", Icon: ListFilter },
      { href: "/presupuestos", label: "Presupuestos", Icon: Target },
      { href: "/metas", label: "Metas", Icon: PiggyBank },
      { href: "/suscripciones", label: "Suscripciones", Icon: Repeat },
      { href: "/sueldo", label: "Cuenta sueldo", Icon: CalendarCheck },
      { href: "/por-cobrar", label: "Por cobrar", Icon: Receipt },
      { href: "/estadisticas", label: "Estadísticas", Icon: BarChart3 },
      { href: "/resumen", label: "Resumen", Icon: PieChart },
      { href: "/historico", label: "Histórico", Icon: History },
      { href: "/tarjetas", label: "Tarjetas", Icon: CreditCard },
      { href: "/prestamos", label: "Préstamos", Icon: HandCoins },
      { href: "/inversiones", label: "Inversiones", Icon: Coins },
    ],
  },
];

export default function NavBar() {
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="border-b border-zinc-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
      <nav className="mx-auto max-w-5xl px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            prefetch={false}
            className="font-display text-lg font-bold tracking-tight"
          >
            <span aria-hidden className="mr-1">
              👣
            </span>
            <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
              Huella
            </span>
          </Link>

          <div className="hidden flex-1 flex-col gap-2 text-sm text-zinc-400 sm:flex sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-6 sm:gap-y-2">
            {navGroups.map((grupo) => (
              <div key={grupo.label} className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${grupo.accentClass}`}
                >
                  {grupo.label}
                </span>
                {grupo.links.map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    className="flex items-center gap-1.5 transition-colors hover:text-zinc-100"
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                ))}
              </div>
            ))}
            <Link
              href="/configuracion"
              prefetch={false}
              className="flex items-center gap-1.5 transition-colors hover:text-zinc-100"
            >
              <Settings size={16} />
              Configuración
            </Link>
          </div>

          <button
            type="button"
            aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={abierto}
            onClick={() => setAbierto((v) => !v)}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-zinc-800 text-zinc-300 transition-colors hover:bg-white/5 sm:hidden"
          >
            {abierto ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {abierto && (
          <div className="flex flex-col gap-4 border-t border-zinc-800 py-4 text-sm text-zinc-300 sm:hidden">
            {navGroups.map((grupo) => (
              <div key={grupo.label} className="flex flex-col gap-2">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${grupo.accentClass}`}
                >
                  {grupo.label}
                </span>
                <div className="flex flex-col gap-1">
                  {grupo.links.map(({ href, label, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      prefetch={false}
                      onClick={() => setAbierto(false)}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-white/5 hover:text-zinc-100"
                    >
                      <Icon size={17} />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <Link
              href="/configuracion"
              prefetch={false}
              onClick={() => setAbierto(false)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-zinc-300 transition-colors hover:bg-white/5 hover:text-zinc-100"
            >
              <Settings size={17} />
              Configuración
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
