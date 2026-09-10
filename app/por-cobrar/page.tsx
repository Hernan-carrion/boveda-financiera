"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Check, Receipt } from "lucide-react";
import { toast } from "sonner";
import { bovedaDB } from "@/lib/db";
import { marcarReintegrado } from "@/lib/actions";
import { formatMoneda, formatFecha } from "@/lib/utils";
import { Card, SectionTitle, EmptyState, btnCls } from "@/components/ui";

export default function PorCobrarPage() {
  const reintegrables = useLiveQuery(
    () =>
      bovedaDB.transacciones
        .filter((t) => t.reintegrable === true)
        .toArray(),
    [],
  );
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.toArray(), []);

  const nombreCuenta = (id: number) =>
    cuentas?.find((c) => c.id === id)?.nombre ?? "—";

  const pendientes = (reintegrables ?? [])
    .filter((t) => !t.reintegrado)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const cobrados = (reintegrables ?? [])
    .filter((t) => t.reintegrado)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const totalPendiente = pendientes.reduce(
    (acc, t) => {
      acc[t.moneda] = (acc[t.moneda] ?? 0) + t.monto;
      return acc;
    },
    {} as Record<string, number>,
  );

  async function cobrar(id: number) {
    await marcarReintegrado(id);
    toast.success("Reintegro registrado como ingreso compensatorio");
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Por cobrar</SectionTitle>
        {Object.keys(totalPendiente).length > 0 && (
          <div className="mb-3 flex flex-wrap gap-3">
            {Object.entries(totalPendiente).map(([moneda, monto]) => (
              <Card key={moneda} className="px-4 py-2">
                <span className="text-xs uppercase tracking-wide text-zinc-500">
                  Total {moneda}
                </span>
                <p className="text-lg font-semibold tabular-nums text-amber-400">
                  {formatMoneda(monto, moneda as "ARS" | "USD")}
                </p>
              </Card>
            ))}
          </div>
        )}

        {reintegrables === undefined ? (
          <Card className="text-sm text-zinc-500">Cargando…</Card>
        ) : pendientes.length === 0 ? (
          <EmptyState>
            No tenés gastos reintegrables pendientes. Marcá &quot;Reintegrable&quot;
            al cargar un gasto que te van a devolver.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {pendientes.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-zinc-900/40 px-4 py-3"
              >
                <Receipt size={16} className="text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">
                    {t.descripcion || "(sin descripción)"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatFecha(t.fecha)} · {nombreCuenta(t.cuenta_id)} ·{" "}
                    {t.categoria}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-zinc-100">
                  {formatMoneda(t.monto, t.moneda)}
                </span>
                <button
                  type="button"
                  onClick={() => t.id != null && cobrar(t.id)}
                  className={btnCls}
                >
                  <Check size={15} />
                  Marcar reintegrado
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cobrados.length > 0 && (
        <section>
          <SectionTitle>Ya reintegrados</SectionTitle>
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 opacity-70">
            {cobrados.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-zinc-900/40 px-4 py-2.5"
              >
                <Check size={15} className="text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-300">
                    {t.descripcion || "(sin descripción)"}
                  </p>
                  <p className="text-xs text-zinc-600">{formatFecha(t.fecha)}</p>
                </div>
                <span className="text-sm tabular-nums text-zinc-400">
                  {formatMoneda(t.monto, t.moneda)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
