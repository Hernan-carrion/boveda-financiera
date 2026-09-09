"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { bovedaDB } from "@/lib/db";
import {
  getMonthlySummary,
  getExpensesByCategory,
  getExpenseToIncomeRatio,
  getLoanReturnRate,
} from "@/lib/metrics";
import { formatMoneda } from "@/lib/utils";
import { Card, SectionTitle } from "@/components/ui";
import MonthlyBalanceChart from "@/components/charts/MonthlyBalanceChart";
import CategoryPieChart from "@/components/charts/CategoryPieChart";
import MetricsCards from "@/components/charts/MetricsCards";

export default function ResumenPage() {
  const transacciones = useLiveQuery(() => bovedaDB.transacciones.toArray(), []);
  const prestamos = useLiveQuery(() => bovedaDB.prestamos.toArray(), []);

  const cargando = transacciones === undefined || prestamos === undefined;

  const txs = transacciones ?? [];
  const { ingresos, egresos } = getMonthlySummary(txs);
  const porCategoria = getExpensesByCategory(txs);
  const ratio = getExpenseToIncomeRatio(ingresos, egresos);
  const tasaDevolucion = getLoanReturnRate(prestamos ?? []);
  const balance = ingresos - egresos;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Indicadores del mes (ARS)</SectionTitle>
        {cargando ? (
          <Card className="text-sm text-zinc-500">Cargando métricas…</Card>
        ) : (
          <MetricsCards
            ratioGastoIngreso={ratio}
            tasaDevolucion={tasaDevolucion}
          />
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle>Ingresos vs egresos</SectionTitle>
          <Card>
            <MonthlyBalanceChart ingresos={ingresos} egresos={egresos} />
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">
                  Ingresos
                </dt>
                <dd className="mt-0.5 font-semibold text-emerald-400">
                  {formatMoneda(ingresos, "ARS")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">
                  Egresos
                </dt>
                <dd className="mt-0.5 font-semibold text-red-400">
                  {formatMoneda(egresos, "ARS")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">
                  Balance
                </dt>
                <dd
                  className={
                    balance >= 0
                      ? "mt-0.5 font-semibold text-zinc-100"
                      : "mt-0.5 font-semibold text-red-400"
                  }
                >
                  {formatMoneda(balance, "ARS")}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <div>
          <SectionTitle>Gastos por categoría</SectionTitle>
          <Card>
            <CategoryPieChart data={porCategoria} />
          </Card>
        </div>
      </section>
    </div>
  );
}
