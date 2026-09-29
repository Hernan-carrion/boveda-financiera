import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buscarSeccion, TONE } from "@/lib/nav";

/*
 * Controles compartidos. Alto mínimo de 44px (objetivo táctil cómodo en
 * mobile), foco con anillo esmeralda y feedback de presión sin mover el layout.
 */
export const inputCls =
  "min-h-11 w-full rounded-lg border border-line bg-zinc-900/70 px-3 py-2 text-base text-zinc-100 outline-none transition-colors duration-150 placeholder:text-subtle hover:border-line-strong focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/20 focus-visible:outline-none sm:text-sm";

export const btnCls =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-[background-color,transform] duration-150 hover:bg-white active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

export const btnGhostCls =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-zinc-200 transition-[background-color,border-color,transform] duration-150 hover:border-zinc-500 hover:bg-white/5 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

/** Link dentro de texto corrido (estados vacíos, ayudas). */
export const inlineLinkCls =
  "font-medium text-accent underline-offset-4 hover:underline";

/**
 * Encabezado de página: toma ícono, nombre y color del mapa de navegación
 * (lib/nav.ts) para que coincida con el sidebar. `title` pisa el nombre.
 */
export function PageHeader({
  href,
  title,
  description,
  actions,
}: {
  href: string;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const { link, tone } = buscarSeccion(href);
  const { Icon } = link;
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
            TONE[tone].chip,
          )}
          aria-hidden
        >
          <Icon size={20} />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-50">
            {title ?? link.label}
          </h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

/** Selector de mes anterior/siguiente (Hábitos, Cuenta sueldo). */
export function MonthStepper({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const btn =
    "grid size-10 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-white/10 hover:text-zinc-100";
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1">
      <button type="button" aria-label="Mes anterior" className={btn} onClick={onPrev}>
        <ChevronLeft size={18} aria-hidden />
      </button>
      <span
        aria-live="polite"
        className="min-w-[8.5rem] text-center text-sm font-medium capitalize text-zinc-100"
      >
        {label}
      </span>
      <button type="button" aria-label="Mes siguiente" className={btn} onClick={onNext}>
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}

/** Placeholder de carga: filas grises pulsantes en vez de "Cargando…". */
export function LoadingState({
  rows = 3,
  label = "Cargando",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-900/60" />
      ))}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface p-5 shadow-lg shadow-black/20 transition-colors duration-200 hover:border-line-strong/80",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-zinc-100">
      <span className="h-4 w-1 rounded-full bg-accent" aria-hidden />
      {children}
    </h2>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line-strong/70 bg-zinc-900/30 p-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}
