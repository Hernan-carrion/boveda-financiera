import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
