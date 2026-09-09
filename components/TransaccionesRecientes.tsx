"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { bovedaDB } from "@/lib/db";
import { actualizarCategoria, borrarTransaccion } from "@/lib/actions";
import { CATEGORIAS_DISPONIBLES } from "@/lib/categorizer";
import { formatMoneda, formatFecha } from "@/lib/utils";
import { EmptyState, inputCls } from "@/components/ui";

const signoTipo: Record<string, string> = {
  ingreso: "text-emerald-400",
  devolucion: "text-emerald-400",
  egreso: "text-red-400",
  prestamo: "text-amber-400",
};

export default function TransaccionesRecientes({ limite = 30 }: { limite?: number }) {
  const transacciones = useLiveQuery(
    () => bovedaDB.transacciones.orderBy("fecha").reverse().limit(limite).toArray(),
    [limite],
  );
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.toArray(), []);

  if (transacciones === undefined) {
    return <p className="text-sm text-zinc-500">Cargando movimientos…</p>;
  }
  if (transacciones.length === 0) {
    return <EmptyState>Todavía no cargaste movimientos.</EmptyState>;
  }

  const nombreCuenta = (id: number) =>
    cuentas?.find((c) => c.id === id)?.nombre ?? "—";

  return (
    <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
      {transacciones.map((t) => {
        const positivo = t.tipo === "ingreso" || t.tipo === "devolucion";
        return (
          <li
            key={t.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-zinc-900/40 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-200">
                {t.descripcion || "(sin descripción)"}
              </p>
              <p className="text-xs text-zinc-500">
                {formatFecha(t.fecha)} · {nombreCuenta(t.cuenta_id)}
              </p>
            </div>

            <select
              className={`${inputCls} h-9 w-auto py-1`}
              value={
                CATEGORIAS_DISPONIBLES.includes(t.categoria)
                  ? t.categoria
                  : "Sin categoría"
              }
              onChange={(e) => t.id != null && actualizarCategoria(t.id, e.target.value)}
              aria-label="Categoría"
            >
              {CATEGORIAS_DISPONIBLES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <span
              className={`w-28 text-right text-sm font-semibold tabular-nums ${
                signoTipo[t.tipo] ?? "text-zinc-200"
              }`}
            >
              {positivo ? "+" : "−"}
              {formatMoneda(t.monto, t.moneda)}
            </span>

            <button
              type="button"
              onClick={() => t.id != null && borrarTransaccion(t.id)}
              className="text-zinc-600 transition-colors hover:text-red-400"
              aria-label="Borrar movimiento"
            >
              <Trash2 size={16} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
