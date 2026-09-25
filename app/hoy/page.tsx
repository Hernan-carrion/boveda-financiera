"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { CheckSquare, Circle, Bell, Flame } from "lucide-react";
import { bovedaDB } from "@/lib/db";
import { completarTarea, marcarHabito } from "@/lib/actions";
import { diasHasta, hoyISO } from "@/lib/recordatorios";
import { calcularRacha } from "@/lib/habitos";
import { cn } from "@/lib/utils";
import { SectionTitle, EmptyState } from "@/components/ui";

/**
 * Agenda del día: junta tareas vencidas/de hoy, hábitos sin marcar y
 * recordatorios próximos en un solo lugar — el "home" del pilar Vida.
 */
export default function HoyPage() {
  const tareas = useLiveQuery(
    () => bovedaDB.tareas.filter((t) => !t.eliminado && t.estado === "pendiente").toArray(),
    [],
  );
  const habitos = useLiveQuery(
    () => bovedaDB.habitos.filter((h) => !h.eliminado && h.activo).toArray(),
    [],
  );
  const registrosTodos = useLiveQuery(() => bovedaDB.habito_registros.toArray(), []);
  const recordatorios = useLiveQuery(
    () => bovedaDB.recordatorios.filter((r) => !r.eliminado && r.activo).toArray(),
    [],
  );

  const hoy = hoyISO();

  const tareasHoy = useMemo(() => {
    return (tareas ?? [])
      .filter((t) => t.fecha_vencimiento && t.fecha_vencimiento <= hoy)
      .sort((a, b) => (a.fecha_vencimiento ?? "").localeCompare(b.fecha_vencimiento ?? ""));
  }, [tareas, hoy]);

  const mapaHoy = useMemo(
    () =>
      new Map(
        (registrosTodos ?? [])
          .filter((r) => r.fecha === hoy)
          .map((r) => [r.habito_id, r.hecho]),
      ),
    [registrosTodos, hoy],
  );

  const recordatoriosProximos = useMemo(() => {
    return [...(recordatorios ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 5);
  }, [recordatorios]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Tareas de hoy</SectionTitle>
        {tareas === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : tareasHoy.length === 0 ? (
          <EmptyState>
            Sin tareas vencidas ni para hoy.{" "}
            <Link href="/tareas" className="underline hover:text-zinc-300">
              Ver todas
            </Link>
            .
          </EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {tareasHoy.map((t) => {
              const dias = t.fecha_vencimiento ? diasHasta(t.fecha_vencimiento) : null;
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 bg-zinc-900/40 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => t.id != null && completarTarea(t.id, true)}
                    aria-label="Marcar hecha"
                    className="shrink-0 text-zinc-500 transition-colors hover:text-emerald-400"
                  >
                    <Circle size={18} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">{t.titulo}</p>
                    <p
                      className={cn(
                        "text-xs",
                        dias != null && dias < 0 ? "text-red-400" : "text-amber-400",
                      )}
                    >
                      {dias != null && dias < 0 ? "venció" : "hoy"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Hábitos de hoy</SectionTitle>
        {habitos === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : habitos.length === 0 ? (
          <EmptyState>
            Todavía no creaste hábitos.{" "}
            <Link href="/habitos" className="underline hover:text-zinc-300">
              Crear uno
            </Link>
            .
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {habitos.map((h) => {
              const hecho = (h.id != null && mapaHoy.get(h.id)) ?? false;
              const fechasHechas = new Set(
                (registrosTodos ?? [])
                  .filter((r) => r.habito_id === h.id && r.hecho)
                  .map((r) => r.fecha),
              );
              const racha = calcularRacha(fechasHechas);
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => h.id != null && marcarHabito(h.id, hoy, !hecho)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    !hecho && "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/40",
                  )}
                  style={
                    hecho
                      ? { background: `${h.color_hex}26`, borderColor: `${h.color_hex}66` }
                      : undefined
                  }
                >
                  {hecho ? (
                    <CheckSquare size={18} style={{ color: h.color_hex }} className="shrink-0" />
                  ) : (
                    <Circle size={18} className="shrink-0 text-zinc-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">{h.nombre}</p>
                    {racha > 0 && (
                      <p className="flex items-center gap-1 text-xs text-amber-400">
                        <Flame size={11} />
                        {racha} día{racha === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Recordatorios próximos</SectionTitle>
        {recordatorios === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : recordatoriosProximos.length === 0 ? (
          <EmptyState>
            Sin recordatorios cargados.{" "}
            <Link href="/recordatorios" className="underline hover:text-zinc-300">
              Crear uno
            </Link>
            .
          </EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {recordatoriosProximos.map((r) => {
              const dias = diasHasta(r.fecha);
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 bg-zinc-900/40 px-4 py-3"
                >
                  <Bell size={16} className="shrink-0 text-zinc-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">{r.titulo}</p>
                    <p className="text-xs text-zinc-500">{r.categoria}</p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      dias < 0
                        ? "text-red-400"
                        : dias <= r.dias_aviso
                          ? "text-amber-400"
                          : "text-zinc-400",
                    )}
                  >
                    {dias < 0 ? "venció" : dias === 0 ? "hoy" : `en ${dias}d`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
