"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Target, Trash2 } from "lucide-react";
import { bovedaDB, type Moneda } from "@/lib/db";
import { CATEGORIAS_EGRESO } from "@/lib/categorizer";
import { calcularAvances } from "@/lib/presupuestos";
import { formatMoneda, periodoActual, cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ProgressBar";
import {
  Card,
  SectionTitle,
  Field,
  EmptyState,
  inputCls,
  btnCls,
} from "@/components/ui";

function nombreMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

export default function PresupuestosPage() {
  const [mes, setMes] = useState(periodoActual());
  const presupuestos = useLiveQuery(
    () => bovedaDB.presupuestos.toArray(),
    [],
  );
  const transacciones = useLiveQuery(() => bovedaDB.transacciones.toArray(), []);

  const cargando = presupuestos === undefined || transacciones === undefined;
  const avances = calcularAvances(presupuestos ?? [], transacciones ?? [], mes);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Presupuestos · {nombreMes(mes)}</SectionTitle>
          <input
            type="month"
            className={`${inputCls} w-auto`}
            value={mes}
            onChange={(e) => setMes(e.target.value || periodoActual())}
          />
        </div>

        {cargando ? (
          <Card className="text-sm text-zinc-500">Cargando…</Card>
        ) : avances.length === 0 ? (
          <EmptyState>
            No hay presupuestos para este mes. Creá uno abajo.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {avances.map((a) => (
              <Card key={a.presupuesto.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-zinc-200">
                    <Target size={15} className="text-zinc-500" />
                    {a.presupuesto.categoria}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums",
                      a.estado === "excedido"
                        ? "text-red-400"
                        : a.estado === "alerta"
                          ? "text-orange-400"
                          : "text-zinc-400",
                    )}
                  >
                    {formatMoneda(a.gastado, a.presupuesto.moneda)} /{" "}
                    {formatMoneda(a.presupuesto.monto_limite, a.presupuesto.moneda)}
                  </span>
                </div>
                <ProgressBar pct={a.pct} estado={a.estado} />
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{a.pct.toFixed(0)}% consumido</span>
                  <span className="flex items-center gap-3">
                    <span>
                      {a.restante >= 0
                        ? `Quedan ${formatMoneda(a.restante, a.presupuesto.moneda)}`
                        : `Excedido en ${formatMoneda(-a.restante, a.presupuesto.moneda)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        a.presupuesto.id != null &&
                        bovedaDB.presupuestos.delete(a.presupuesto.id)
                      }
                      className="text-zinc-600 transition-colors hover:text-red-400"
                      aria-label="Borrar presupuesto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Nuevo presupuesto</SectionTitle>
        <NuevoPresupuestoForm mesActual={mes} />
      </section>
    </div>
  );
}

function NuevoPresupuestoForm({ mesActual }: { mesActual: string }) {
  const [categoria, setCategoria] = useState(CATEGORIAS_EGRESO[0]);
  const [limite, setLimite] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [mes, setMes] = useState(mesActual);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const monto = Number(limite);
    if (!(monto > 0)) {
      setMsg("Poné un límite mayor a 0.");
      return;
    }
    const yaExiste = await bovedaDB.presupuestos
      .filter(
        (p) => p.categoria === categoria && p.mes === mes && p.moneda === moneda,
      )
      .first();
    if (yaExiste?.id != null) {
      await bovedaDB.presupuestos.update(yaExiste.id, {
        monto_limite: monto,
        last_updated: new Date().toISOString(),
      });
      setMsg("Presupuesto actualizado ✓");
    } else {
      await bovedaDB.presupuestos.add({
        categoria,
        monto_limite: monto,
        moneda,
        mes,
        last_updated: new Date().toISOString(),
      });
      setMsg("Presupuesto creado ✓");
    }
    setLimite("");
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Categoría">
          <select
            className={inputCls}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {CATEGORIAS_EGRESO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Límite mensual">
          <input
            type="number"
            className={inputCls}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            placeholder="50000"
          />
        </Field>
        <Field label="Moneda">
          <select
            className={inputCls}
            value={moneda}
            onChange={(e) => setMoneda(e.target.value as Moneda)}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </Field>
        <Field label="Mes">
          <input
            type="month"
            className={inputCls}
            value={mes}
            onChange={(e) => setMes(e.target.value || mesActual)}
          />
        </Field>
        <div className="flex items-end">
          <button type="submit" className={btnCls}>
            <Plus size={16} />
            Guardar
          </button>
        </div>
      </form>
      {msg && <p className="mt-3 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}
