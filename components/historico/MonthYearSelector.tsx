"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatMonthLabel,
  sameMonth,
  type MonthKey,
} from "@/lib/historical";
import { cn } from "@/lib/utils";

/**
 * Selector horizontal de mes/año, sin <select>: `‹  Octubre 2026  ›`.
 * Los botones se desactivan al llegar a los extremos del rango disponible.
 */
export default function MonthYearSelector({
  value,
  months,
  onChange,
}: {
  value: MonthKey;
  months: MonthKey[];
  onChange: (m: MonthKey) => void;
}) {
  const index = months.findIndex((m) => sameMonth(m, value));
  const canPrev = index > 0;
  const canNext = index >= 0 && index < months.length - 1;

  const btn =
    "grid size-9 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-zinc-400";

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 backdrop-blur-xl">
      <button
        type="button"
        aria-label="Mes anterior"
        className={btn}
        disabled={!canPrev}
        onClick={() => canPrev && onChange(months[index - 1])}
      >
        <ChevronLeft size={18} />
      </button>

      <div className="min-w-[9.5rem] px-2 text-center">
        <span className="font-display text-sm font-medium tracking-wide text-zinc-100">
          {formatMonthLabel(value)}
        </span>
      </div>

      <button
        type="button"
        aria-label="Mes siguiente"
        className={cn(btn)}
        disabled={!canNext}
        onClick={() => canNext && onChange(months[index + 1])}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
