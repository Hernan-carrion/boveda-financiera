"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Flame, Plus, X } from "lucide-react";
import { bovedaDB, type Habito, type HabitoRegistro } from "@/lib/db";
import { crearHabito, borrarHabito, marcarHabito } from "@/lib/actions";
import { monthKey, formatMonthLabel, type MonthKey } from "@/lib/historical";
import {
  diasDelMes,
  mapaPorFecha,
  calcularRacha,
  mesVecino,
  type DiaCalendarioHabito,
} from "@/lib/habitos";
import { cn } from "@/lib/utils";
import { Card, SectionTitle, Field, EmptyState, inputCls, btnCls } from "@/components/ui";

const NOMBRES_DIA = ["D", "L", "M", "M", "J", "V", "S"];
const COLORES_HABITO = ["#a78bfa", "#34d399", "#38bdf8", "#fbbf24", "#f87171", "#fb923c"];

export default function HabitosPage() {
  const [mes, setMes] = useState<MonthKey>(() => monthKey());
  const habitos = useLiveQuery(
    () => bovedaDB.habitos.filter((h) => !h.eliminado && h.activo).toArray(),
    [],
  );
  const registros = useLiveQuery(() => bovedaDB.habito_registros.toArray(), []);

  const celdas = diasDelMes(mes);
  const relleno = celdas.length > 0 ? celdas[0].diaSemana : 0;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Hábitos</SectionTitle>
          <div className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/50 p-1">
            <button
              type="button"
              aria-label="Mes anterior"
              className="grid size-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
              onClick={() => setMes((m) => mesVecino(m, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-medium text-zinc-100">
              {formatMonthLabel(mes)}
            </span>
            <button
              type="button"
              aria-label="Mes siguiente"
              className="grid size-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
              onClick={() => setMes((m) => mesVecino(m, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <NuevoHabitoForm />
      </section>

      <section>
        {habitos === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : habitos.length === 0 ? (
          <EmptyState>Todavía no creaste hábitos.</EmptyState>
        ) : (
          <div className="flex flex-col gap-6">
            {habitos.map((h) => (
              <HabitoCard
                key={h.id}
                habito={h}
                celdas={celdas}
                relleno={relleno}
                registros={(registros ?? []).filter((r) => r.habito_id === h.id)}
              />
            ))}
          </div>
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

function HabitoCard({
  habito,
  celdas,
  relleno,
  registros,
}: {
  habito: Habito;
  celdas: DiaCalendarioHabito[];
  relleno: number;
  registros: HabitoRegistro[];
}) {
  const mapa = mapaPorFecha(registros);
  const fechasHechas = new Set(registros.filter((r) => r.hecho).map((r) => r.fecha));
  const racha = calcularRacha(fechasHechas);

  async function tocar(fecha: string) {
    if (habito.id == null) return;
    const actual = mapa.get(fecha)?.hecho ?? false;
    await marcarHabito(habito.id, fecha, !actual);
  }

  async function eliminar() {
    if (habito.id == null) return;
    if (!window.confirm(`¿Eliminar el hábito "${habito.nombre}"?`)) return;
    await borrarHabito(habito.id);
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-3 shrink-0 rounded-full" style={{ background: habito.color_hex }} />
          <span className="text-sm font-medium text-zinc-200">{habito.nombre}</span>
        </div>
        <div className="flex items-center gap-3">
          {racha > 0 && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Flame size={13} />
              {racha} día{racha === 1 ? "" : "s"}
            </span>
          )}
          <button
            type="button"
            onClick={eliminar}
            aria-label="Eliminar hábito"
            className="text-zinc-600 transition-colors hover:text-red-400"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-zinc-600">
        {NOMBRES_DIA.map((n, i) => (
          <div key={i} className="pb-1">
            {n}
          </div>
        ))}
        {Array.from({ length: relleno }).map((_, i) => (
          <div key={`relleno-${i}`} />
        ))}
        {celdas.map((c) => {
          const hecho = mapa.get(c.fecha)?.hecho ?? false;
          return (
            <button
              key={c.fecha}
              type="button"
              onClick={() => tocar(c.fecha)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors",
                hecho
                  ? "border-transparent text-zinc-950"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:bg-zinc-800/60",
              )}
              style={hecho ? { background: habito.color_hex } : undefined}
            >
              {c.numero}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
