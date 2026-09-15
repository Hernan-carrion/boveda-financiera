"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, X } from "lucide-react";
import { bovedaDB, type Transaccion, type TipoTransaccion, type Moneda } from "@/lib/db";
import { CATEGORIAS_DISPONIBLES } from "@/lib/categorizer";
import { formatMoneda, formatFecha, cn } from "@/lib/utils";
import EditarMovimientoModal from "@/components/EditarMovimientoModal";
import { Card, SectionTitle, Field, EmptyState, inputCls, btnGhostCls } from "@/components/ui";

const TIPOS_FILTRO: { value: TipoTransaccion | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "ingreso", label: "Ingreso" },
  { value: "egreso", label: "Egreso" },
  { value: "prestamo", label: "Préstamo" },
  { value: "devolucion", label: "Devolución" },
];

export default function MovimientosPage() {
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.orderBy("nombre").toArray(), []);
  const transacciones = useLiveQuery(
    () =>
      bovedaDB.transacciones
        .orderBy("fecha")
        .reverse()
        .filter((t) => !t.eliminado)
        .toArray(),
    [],
  );

  const [cuentaId, setCuentaId] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tipo, setTipo] = useState<TipoTransaccion | "">("");
  const [texto, setTexto] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [editando, setEditando] = useState<Transaccion | null>(null);

  const nombreCuenta = (id: number) =>
    cuentas?.find((c) => c.id === id)?.nombre ?? "Cuenta";

  const filtrados = useMemo(() => {
    const textoNorm = texto.trim().toLowerCase();
    return (transacciones ?? []).filter((t) => {
      if (cuentaId && String(t.cuenta_id) !== cuentaId) return false;
      if (categoria && t.categoria !== categoria) return false;
      if (tipo && t.tipo !== tipo) return false;
      if (textoNorm && !t.descripcion.toLowerCase().includes(textoNorm)) return false;
      const fechaDia = t.fecha.slice(0, 10);
      if (desde && fechaDia < desde) return false;
      if (hasta && fechaDia > hasta) return false;
      return true;
    });
  }, [transacciones, cuentaId, categoria, tipo, texto, desde, hasta]);

  const hayFiltros = !!(cuentaId || categoria || tipo || texto || desde || hasta);

  const totalesPorMoneda = filtrados.reduce<
    Partial<Record<Moneda, { ingresos: number; egresos: number }>>
  >((acc, t) => {
    const fila = (acc[t.moneda] ??= { ingresos: 0, egresos: 0 });
    const positivo = t.tipo === "ingreso" || t.tipo === "devolucion";
    if (positivo) fila.ingresos += t.monto;
    else fila.egresos += t.monto;
    return acc;
  }, {});

  function limpiarFiltros() {
    setCuentaId("");
    setCategoria("");
    setTipo("");
    setTexto("");
    setDesde("");
    setHasta("");
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionTitle>Filtros</SectionTitle>
        <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Buscar en descripción">
            <input
              className={inputCls}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="nafta, super, sueldo…"
            />
          </Field>
          <Field label="Cuenta">
            <select
              className={inputCls}
              value={cuentaId}
              onChange={(e) => setCuentaId(e.target.value)}
            >
              <option value="">Todas</option>
              {cuentas?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Categoría">
            <select
              className={inputCls}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option value="">Todas</option>
              {CATEGORIAS_DISPONIBLES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo">
            <select
              className={inputCls}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoTransaccion | "")}
            >
              {TIPOS_FILTRO.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Desde">
            <input
              type="date"
              className={inputCls}
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              className={inputCls}
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </Field>
          {hayFiltros && (
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <button type="button" onClick={limpiarFiltros} className={btnGhostCls}>
                <X size={15} />
                Limpiar filtros
              </button>
            </div>
          )}
        </Card>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>
            {`Movimientos${hayFiltros ? " filtrados" : ""} (${filtrados.length})`}
          </SectionTitle>
          {Object.keys(totalesPorMoneda).length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
              {(Object.entries(totalesPorMoneda) as [Moneda, { ingresos: number; egresos: number }][]).map(
                ([moneda, t]) => (
                  <span key={moneda}>
                    <span className="text-emerald-400">
                      +{formatMoneda(t.ingresos, moneda)}
                    </span>{" "}
                    <span className="text-red-400">
                      −{formatMoneda(t.egresos, moneda)}
                    </span>
                  </span>
                ),
              )}
            </div>
          )}
        </div>

        {transacciones === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : filtrados.length === 0 ? (
          <EmptyState>
            {hayFiltros
              ? "Ningún movimiento coincide con estos filtros."
              : "Todavía no cargaste movimientos."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {filtrados.map((t) => {
              const positivo = t.tipo === "ingreso" || t.tipo === "devolucion";
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setEditando(t)}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 bg-zinc-900/40 px-4 py-3 text-left transition-colors hover:bg-zinc-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">
                        {t.descripcion || "(sin descripción)"}
                        {t.reintegrable && !t.reintegrado && (
                          <span className="ml-2 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
                            por cobrar
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                        {formatFecha(t.fecha)} · {nombreCuenta(t.cuenta_id)} · {t.categoria}
                        <Pencil size={11} className="text-zinc-600" />
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        positivo ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {positivo ? "+" : "−"}
                      {formatMoneda(t.monto, t.moneda)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <EditarMovimientoModal
        tx={editando}
        cuentas={cuentas ?? []}
        onClose={() => setEditando(null)}
      />
    </div>
  );
}
