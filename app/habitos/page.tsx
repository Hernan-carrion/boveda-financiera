"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Flame, Plus, X } from "lucide-react";
import { bovedaDB } from "@/lib/db";
import { crearHabito, borrarHabito, marcarHabito } from "@/lib/actions";
import { monthKey, formatMonthLabel, type MonthKey } from "@/lib/historical";
import { diasDelMes, calcularRacha, mesVecino } from "@/lib/habitos";
import { cn } from "@/lib/utils";
import RuedaHabitos from "@/components/RuedaHabitos";
import { Card, SectionTitle, Field, EmptyState, inputCls, btnCls, PageHeader, MonthStepper, LoadingState } from "@/components/ui";

const COLORES_HABITO = ["#a78bfa", "#34d399", "#38bdf8", "#fbbf24", "#f87171", "#fb923c"];

export default function HabitosPage() {
  const [mes, setMes] = useState<MonthKey>(() => monthKey());
  const habitos = useLiveQuery(
    () => bovedaDB.habitos.filter((h) => !h.eliminado && h.activo).toArray(),
    [],
  );
  const registros = useLiveQuery(() => bovedaDB.habito_registros.toArray(), []);

  const celdas = diasDelMes(mes);

  const mapaPorHabito = useMemo(() => {
    const out = new Map<number, Map<string, boolean>>();
    for (const r of registros ?? []) {
      if (!out.has(r.habito_id)) out.set(r.habito_id, new Map());
      out.get(r.habito_id)!.set(r.fecha, r.hecho);
    }
    return out;
  }, [registros]);

  async function tocar(habitoId: number, fecha: string) {
    const actual = mapaPorHabito.get(habitoId)?.get(fecha) ?? false;
    await marcarHabito(habitoId, fecha, !actual);
  }

  async function eliminar(id: number, nombre: string) {
    if (!window.confirm(`¿Eliminar el hábito "${nombre}"?`)) return;
    await borrarHabito(id);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        href="/habitos"
        description="Marcá cada día y seguí tus rachas mes a mes."
        actions={
          <MonthStepper
            label={formatMonthLabel(mes)}
            onPrev={() => setMes((m) => mesVecino(m, -1))}
            onNext={() => setMes((m) => mesVecino(m, 1))}
          />
        }
      />
      <section>
        <SectionTitle>Nuevo hábito</SectionTitle>
        <NuevoHabitoForm />
      </section>

      <section>
        {habitos === undefined ? (
          <LoadingState />
        ) : habitos.length === 0 ? (
          <EmptyState>Todavía no creaste hábitos.</EmptyState>
        ) : (
          <>
            <Card>
              <RuedaHabitos
                habitos={habitos}
                celdas={celdas}
                mapaPorHabito={mapaPorHabito}
                onTocar={tocar}
              />
            </Card>

            <div className="mt-3 flex flex-col gap-2">
              {habitos.map((h) => {
                const fechasHechas = new Set(
                  (registros ?? [])
                    .filter((r) => r.habito_id === h.id && r.hecho)
                    .map((r) => r.fecha),
                );
                const racha = calcularRacha(fechasHechas);
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5"
                  >
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: h.color_hex }}
                    />
                    <span className="flex-1 truncate text-sm text-zinc-200">{h.nombre}</span>
                    {racha > 0 && (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <Flame size={13} />
                        {racha} día{racha === 1 ? "" : "s"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => h.id != null && eliminar(h.id, h.nombre)}
                      aria-label="Eliminar hábito"
                      className="text-subtle transition-colors hover:text-red-400"
                    >
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function NuevoHabitoForm() {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLORES_HABITO[0]);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await crearHabito({ nombre, color_hex: color });
      setNombre("");
      setMsg("Hábito creado ✓");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo crear.");
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <Field label="Nuevo hábito">
            <input
              className={inputCls}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tomar 2L de agua, leer 20 minutos…"
            />
          </Field>
        </div>
        <div className="flex items-center gap-1.5">
          {COLORES_HABITO.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={cn(
                "size-6 rounded-full border-2 transition-transform",
                color === c ? "scale-110 border-zinc-100" : "border-transparent",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <button type="submit" className={btnCls}>
          <Plus size={16} />
          Crear
        </button>
      </form>
      {msg && <p className="mt-3 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}
