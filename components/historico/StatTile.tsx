import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn, formatPct } from "@/lib/utils";

type Accent = "in" | "out" | "equity" | "neutral";

const valueColor: Record<Accent, string> = {
  in: "text-[#4ade80]",
  out: "text-[#fb7185]",
  equity: "text-[#60a5fa]",
  neutral: "text-zinc-100",
};

const dotColor: Record<Accent, string> = {
  in: "bg-[#4ade80]",
  out: "bg-[#fb7185]",
  equity: "bg-[#60a5fa]",
  neutral: "bg-zinc-500",
};

/**
 * KPI financiero: etiqueta técnica arriba, número grande en monospace,
 * y (opcional) variación porcentual contra el mes anterior.
 */
export default function StatTile({
  label,
  value,
  sub,
  accent = "neutral",
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: Accent;
  icon?: LucideIcon;
  trend?: number | null;
}) {
  const showTrend = typeof trend === "number" && Number.isFinite(trend);
  const trendUp = (trend ?? 0) >= 0;

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className={cn("size-1.5 rounded-full", dotColor[accent])} />
        <span className="font-display text-[0.7rem] font-medium uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </span>
        {Icon && <Icon size={14} className="ml-auto text-zinc-600" />}
      </div>

      <div>
        <p
          className={cn(
            "font-tech text-2xl leading-none sm:text-[1.75rem]",
            valueColor[accent],
          )}
        >
          {value}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {showTrend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-tech text-[0.7rem]",
                trendUp
                  ? "bg-[#4ade80]/10 text-[#4ade80]"
                  : "bg-[#fb7185]/10 text-[#fb7185]",
              )}
            >
              {trendUp ? (
                <ArrowUpRight size={12} />
              ) : (
                <ArrowDownRight size={12} />
              )}
              {formatPct(trend ?? 0)}
            </span>
          )}
          {sub && <span className="text-xs text-zinc-500">{sub}</span>}
        </div>
      </div>
    </div>
  );
}
