"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { bovedaDB } from "@/lib/db";
import { transaccionesToCSV } from "@/lib/actions";
import { getExpensesByCategory } from "@/lib/metrics";
import {
  getAvailableMonths,
  getHistoricalSummary,
  formatMonthLabel,
} from "@/lib/historical";
import { formatMoneda } from "@/lib/utils";
import { Card, SectionTitle, btnCls } from "@/components/ui";
import HistoryLineChart, {
  type HistoryPoint,
} from "@/components/charts/HistoryLineChart";
import CategoryPieChart from "@/components/charts/CategoryPieChart";

export default function EstadisticasPage() {
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.toArray(), []);
  const transacciones = useLiveQuery(() => bovedaDB.transacciones.toArray(), []);
  const inversiones = useLiveQuery(() => bovedaDB.inversiones.toArray(), []);
  const [descargando, setDescargando] = useState(false);

  const cargando =
    cuentas === undefined ||
    transacciones === undefined ||
    inversiones === undefined;

  const txs = transacciones ?? [];
  const meses = getAvailableMonths(txs);
  const serie: HistoryPoint[] = meses.map((key) => {
    const s = getHistoricalSummary(
      cuentas ?? [],
      txs,
      inversiones ?? [],
      key,
      "ARS",
    );
    return {
      mes: formatMonthLabel(key).slice(0, 3) + " " + String(key.year).slice(2),
      patrimonio: Math.round(s.netWorthClose),
      ingresos: Math.round(s.ingresos),
      gastos: Math.round(s.gastos),
    };
  });

  const porCategoria = getExpensesByCategory(txs);

  async function exportarCSV() {
    setDescargando(true);
    try {
      const csv = await transaccionesToCSV();
      const blob = new Blob(["﻿" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boveda-transacciones-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado ✓");
    } catch {
      toast.error("No se pudo exportar el CSV");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Estadísticas</SectionTitle>
          <button
            onClick={exportarCSV}
            disabled={descargando || cargando}
            className={btnCls}
          >
            <Download size={16} />
            {descargando ? "Generando…" : "Exportar a CSV"}
          </button>
        </div>

        <SectionTitle>Evolución histórica (ARS)</SectionTitle>
        <Card>
          {cargando ? (
            <p className="text-sm text-zinc-500">Cargando…</p>
          ) : (
            <HistoryLineChart data={serie} />
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>Gastos del mes por categoría</SectionTitle>
        <Card>
          {cargando ? (
            <p className="text-sm text-zinc-500">Cargando…</p>
          ) : (
            <>
              <CategoryPieChart data={porCategoria} />
              <ul className="mt-4 divide-y divide-zinc-800 text-sm">
                {porCategoria.map((c) => (
                  <li
                    key={c.name}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-zinc-300">{c.name}</span>
                    <span className="tabular-nums text-zinc-400">
                      {formatMoneda(c.value, "ARS")}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
