"use client";

import { TrendingDown, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui";

/**
 * Tarjetas de KPI del mes:
 *  1. % de gastos sobre ingresos (rojo si supera el 80%).
 *  2. Tasa de devolución de préstamos.
 */
export default function MetricsCards({
  ratioGastoIngreso,
  tasaDevolucion,
}: {
  ratioGastoIngreso: number;
  tasaDevolucion: number;
}) {
  const gasto = Math.round(ratioGastoIngreso);
  const devuelto = Math.round(tasaDevolucion);
  const alerta = ratioGastoIngreso > 80;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <div className="flex items-center gap-2 text-zinc-400">
          <TrendingDown size={16} />
          <span className="text-sm">Gastos vs ingresos</span>
        </div>
        <p
          className={cn(
            "mt-2 text-3xl font-semibold tabular-nums",
            alerta ? "text-red-400" : "text-zinc-50",
          )}
        >
          {gasto}%
        </p>
        <p
          className={cn(
            "mt-1 text-sm",
            alerta ? "text-red-400" : "text-zinc-500",
          )}
        >
          Has gastado el {gasto}% de tus ingresos este mes
          {alerta ? " — ¡cuidado!" : ""}
        </p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-zinc-400">
          <HandCoins size={16} />
          <span className="text-sm">Devolución de préstamos</span>
        </div>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-50">
          {devuelto}%
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          {devuelto}% del dinero prestado ha sido devuelto
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, devuelto))}%` }}
          />
        </div>
      </Card>
    </div>
  );
}
