"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { TrendingUp, TrendingDown } from "lucide-react";
import { bovedaDB } from "@/lib/db";
import {
  getAvailableMonths,
  getHistoricalSummary,
  getDailyNetWorthSeries,
  formatMonthLabel,
  monthKey,
  sameMonth,
  type MonthKey,
} from "@/lib/historical";
import { formatMonedaCompact, formatPct } from "@/lib/utils";
import MonthYearSelector from "@/components/historico/MonthYearSelector";
import BentoCard from "@/components/historico/BentoCard";
import StatTile from "@/components/historico/StatTile";
import NetWorthAreaChart from "@/components/charts/NetWorthAreaChart";
import IncomeExpenseChart from "@/components/charts/IncomeExpenseChart";

function pctChange(cur: number, prev: number): number | null {
  if (!Number.isFinite(prev) || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export default function HistoricoPage() {
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.toArray(), []);
  const transacciones = useLiveQuery(() => bovedaDB.transacciones.toArray(), []);
  const inversiones = useLiveQuery(() => bovedaDB.inversiones.toArray(), []);

  const [selected, setSelected] = useState<MonthKey>(() => monthKey());

  const cargando =
    cuentas === undefined ||
    transacciones === undefined ||
    inversiones === undefined;

  const months = useMemo(
    () => getAvailableMonths(transacciones ?? []),
    [transacciones],
  );

  const summary = useMemo(
    () =>
      getHistoricalSummary(
        cuentas ?? [],
        transacciones ?? [],
        inversiones ?? [],
        selected,
      ),
    [cuentas, transacciones, inversiones, selected],
  );

  const prevSummary = useMemo(() => {
    const idx = months.findIndex((m) => sameMonth(m, selected));
    if (idx <= 0) return null;
    return getHistoricalSummary(
      cuentas ?? [],
      transacciones ?? [],
      inversiones ?? [],
      months[idx - 1],
    );
  }, [cuentas, transacciones, inversiones, months, selected]);

  const series = useMemo(
    () => getDailyNetWorthSeries(cuentas ?? [], transacciones ?? [], selected),
    [cuentas, transacciones, selected],
  );

  const label = formatMonthLabel(selected);
  const crecimientoMes = pctChange(summary.netWorthClose, summary.netWorthOpen);
  const trendIngresos = prevSummary
    ? pctChange(summary.ingresos, prevSummary.ingresos)
    : null;
  const trendGastos = prevSummary
    ? pctChange(summary.gastos, prevSummary.gastos)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-50">
            Resúmenes mensuales
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Consolidado histórico de patrimonio y flujo de caja · ARS
          </p>
        </div>
        <MonthYearSelector
          value={selected}
          months={months}
          onChange={setSelected}
        />
      </div>

      <div className="rounded-3xl border border-white/5 bg-[#08080c] p-3 sm:p-5 [background-image:radial-gradient(110%_80%_at_0%_0%,rgba(59,130,246,0.08),transparent_55%),radial-gradient(90%_70%_at_100%_0%,rgba(74,222,128,0.05),transparent_45%)]">
        {cargando ? (
          <SkeletonGrid />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(8.5rem,auto)]">
            {/* Hero — Patrimonio neto */}
            <BentoCard
              accent="equity"
              className="sm:col-span-2 lg:col-span-2 lg:row-span-2"
            >
              <div className="flex h-full flex-col">
                <span className="font-display text-[0.7rem] font-medium uppercase tracking-[0.14em] text-zinc-500">
                  Patrimonio neto · cierre {label}
                </span>
                <p className="mt-3 font-tech text-[2.5rem] leading-none text-[#60a5fa] sm:text-5xl">
                  {formatMonedaCompact(summary.netWorthClose, "ARS")}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {crecimientoMes !== null && (
                    <span
                      className={
                        crecimientoMes >= 0
                          ? "rounded-md bg-[#4ade80]/10 px-1.5 py-0.5 font-tech text-[#4ade80]"
                          : "rounded-md bg-[#fb7185]/10 px-1.5 py-0.5 font-tech text-[#fb7185]"
                      }
                    >
                      {formatPct(crecimientoMes)} en el mes
                    </span>
                  )}
                  <span className="text-zinc-500">
                    Apertura {formatMonedaCompact(summary.netWorthOpen, "ARS")}
                  </span>
                </div>
                <div className="mt-auto pt-4">
                  <NetWorthAreaChart data={series} compact />
                </div>
              </div>
            </BentoCard>

            <BentoCard accent="in">
              <StatTile
                label="Ingresos · Cash In"
                value={formatMonedaCompact(summary.ingresos, "ARS")}
                accent="in"
                icon={TrendingUp}
                trend={trendIngresos}
                sub={prevSummary ? "vs mes anterior" : undefined}
              />
            </BentoCard>

            <BentoCard accent="out">
              <StatTile
                label="Gastos · Cash Out"
                value={formatMonedaCompact(summary.gastos, "ARS")}
                accent="out"
                icon={TrendingDown}
                trend={trendGastos}
                sub={prevSummary ? "vs mes anterior" : undefined}
              />
            </BentoCard>

            <BentoCard>
              <StatTile
                label="Flujo de caja libre"
                value={formatMonedaCompact(summary.flujoLibre, "ARS")}
                accent={summary.flujoLibre >= 0 ? "in" : "out"}
                sub="Ingresos − Gastos"
              />
            </BentoCard>

            <BentoCard>
              <StatTile
                label="Tasa de ahorro"
                value={`${summary.tasaAhorro.toFixed(1)}%`}
                accent={summary.tasaAhorro >= 0 ? "in" : "out"}
                sub="del ingreso del mes"
              />
            </BentoCard>

            {/* Área — evolución del patrimonio */}
            <BentoCard className="sm:col-span-2 lg:col-span-4 lg:row-span-2">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[0.7rem] font-medium uppercase tracking-[0.14em] text-zinc-500">
                    Evolución del patrimonio · {label}
                  </span>
                  <span className="flex items-center gap-1.5 text-[0.7rem] text-zinc-500">
                    <span className="size-1.5 rounded-full bg-[#60a5fa]" />
                    Net worth diario
                  </span>
                </div>
                <div className="mt-3 min-h-0 flex-1">
                  <NetWorthAreaChart data={series} />
                </div>
              </div>
            </BentoCard>

            {/* Ingresos vs Gastos */}
            <BentoCard className="sm:col-span-2 lg:col-span-2">
              <div className="flex h-full flex-col">
                <span className="font-display text-[0.7rem] font-medium uppercase tracking-[0.14em] text-zinc-500">
                  Ingresos vs Gastos
                </span>
                <div className="mt-3 min-h-0 flex-1">
                  <IncomeExpenseChart
                    ingresos={summary.ingresos}
                    gastos={summary.gastos}
                  />
                </div>
              </div>
            </BentoCard>

            {/* Inversiones + movimientos */}
            <BentoCard className="sm:col-span-2 lg:col-span-2">
              <div className="grid h-full grid-cols-2 gap-4">
                <StatTile
                  label="Rend. inversiones"
                  value={formatMonedaCompact(
                    summary.rendimientoInversiones,
                    "ARS",
                  )}
                  accent="equity"
                  sub="capital activo"
                />
                <StatTile
                  label="Movimientos"
                  value={String(summary.movimientos)}
                  accent="neutral"
                  sub="registrados en el mes"
                />
              </div>
            </BentoCard>
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  const spans = [
    "sm:col-span-2 lg:col-span-2 lg:row-span-2",
    "",
    "",
    "",
    "",
    "sm:col-span-2 lg:col-span-4 lg:row-span-2",
    "sm:col-span-2 lg:col-span-2",
    "sm:col-span-2 lg:col-span-2",
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(8.5rem,auto)]">
      {spans.map((s, i) => (
        <div
          key={i}
          className={`min-h-[8.5rem] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03] ${s}`}
        />
      ))}
    </div>
  );
}
