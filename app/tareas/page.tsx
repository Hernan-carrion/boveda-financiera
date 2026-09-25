"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckSquare, Circle, Plus } from "lucide-react";
import { bovedaDB, type Tarea, type PrioridadTarea, type EstadoTarea } from "@/lib/db";
import { crearTarea, crearProyecto, completarTarea, borrarProyecto } from "@/lib/actions";
import { diasHasta } from "@/lib/recordatorios";
import { cn } from "@/lib/utils";
import EditarTareaModal from "@/components/EditarTareaModal";
import {
  Card,
  SectionTitle,
  Field,
  EmptyState,
  inputCls,
  btnCls,
} from "@/components/ui";

const PRIORIDADES: { value: PrioridadTarea; label: string }[] = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];

const COLOR_PRIORIDAD: Record<PrioridadTarea, string> = {
  alta: "text-red-400",
  media: "text-amber-400",
  baja: "text-zinc-500",
};

const COLORES_PROYECTO = ["#34d399", "#38bdf8", "#a78bfa", "#fbbf24", "#f87171", "#fb923c"];

export default function TareasPage() {
  const tareas = useLiveQuery(
    () => bovedaDB.tareas.filter((t) => !t.eliminado).toArray(),
    [],
  );
  const proyectos = useLiveQuery(
    () => bovedaDB.proyectos.filter((p) => !p.eliminado).toArray(),
    [],
  );

  const [filtroProyecto, setFiltroProyecto] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoTarea | "">("pendiente");
  const [editando, setEditando] = useState<Tarea | null>(null);

  const nombreProyecto = (id?: number) => proyectos?.find((p) => p.id === id)?.nombre;
  const colorProyecto = (id?: number) => proyectos?.find((p) => p.id === id)?.color_hex;

  const filtradas = useMemo(() => {
    const lista = (tareas ?? []).filter((t) => {
      if (filtroProyecto && String(t.proyecto_id ?? "") !== filtroProyecto) return false;
      if (filtroPrioridad && t.prioridad !== filtroPrioridad) return false;
      if (filtroEstado && t.estado !== filtroEstado) return false;
      return true;
    });
    return [...lista].sort((a, b) => {
      if (a.estado !== b.estado) return a.estado === "pendiente" ? -1 : 1;
      const fa = a.fecha_vencimiento ?? "9999-99-99";
      const fb = b.fecha_vencimiento ?? "9999-99-99";
      return fa.localeCompare(fb);
    });
  }, [tareas, filtroProyecto, filtroPrioridad, filtroEstado]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Filtros</SectionTitle>
        <Card className="grid gap-3 sm:grid-cols-3">
          <Field label="Proyecto">
            <select
              className={inputCls}
              value={filtroProyecto}
              onChange={(e) => setFiltroProyecto(e.target.value)}
            >
              <option value="">Todos</option>
              {proyectos?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prioridad">
            <select
              className={inputCls}
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value)}
            >
              <option value="">Todas</option>
              {PRIORIDADES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              className={inputCls}
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as EstadoTarea | "")}
            >
              <option value="pendiente">Pendientes</option>
              <option value="hecha">Hechas</option>
              <option value="">Todas</option>
            </select>
          </Field>
        </Card>
      </section>

      <section>
        <SectionTitle>Nueva tarea</SectionTitle>
        <NuevaTareaForm proyectos={proyectos ?? []} />
      </section>

      <section>
        <SectionTitle>{`Tareas (${filtradas.length})`}</SectionTitle>
        {tareas === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : filtradas.length === 0 ? (
          <EmptyState>No hay tareas con estos filtros.</EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {filtradas.map((t) => {
              const hecha = t.estado === "hecha";
              const dias = t.fecha_vencimiento ? diasHasta(t.fecha_vencimiento) : null;
              const proyNombre = nombreProyecto(t.proyecto_id);
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 bg-zinc-900/40 px-4 py-3 transition-colors hover:bg-zinc-800/40"
                >
                  <button
                    type="button"
                    onClick={() => t.id != null && completarTarea(t.id, !hecha)}
                    aria-label={hecha ? "Marcar pendiente" : "Marcar hecha"}
                    className="shrink-0 text-zinc-500 transition-colors hover:text-emerald-400"
                  >
                    {hecha ? (
                      <CheckSquare size={18} className="text-emerald-400" />
                    ) : (
                      <Circle size={18} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditando(t)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p
                      className={cn(
                        "truncate text-sm",
                        hecha ? "text-zinc-500 line-through" : "text-zinc-200",
                      )}
                    >
                      {t.titulo}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-500">
                      {proyNombre && (
                        <span className="flex items-center gap-1">
                          <span
                            className="size-1.5 rounded-full"
                            style={{ background: colorProyecto(t.proyecto_id) }}
                          />
                          {proyNombre}
                        </span>
                      )}
                      <span className={COLOR_PRIORIDAD[t.prioridad]}>{t.prioridad}</span>
                      {t.fecha_vencimiento && dias != null && (
                        <span
                          className={
                            dias < 0 && !hecha
                              ? "text-red-400"
                              : dias === 0
                                ? "text-amber-400"
                                : undefined
                          }
                        >
                          · {dias < 0 ? "venció" : dias === 0 ? "hoy" : `en ${dias}d`}
                        </span>
                      )}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Proyectos</SectionTitle>
        <NuevoProyectoForm />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {proyectos !== undefined && proyectos.length === 0 && (
            <EmptyState>Todavía no creaste proyectos.</EmptyState>
          )}
          {proyectos?.map((p) => (
            <Card key={p.id} className="flex items-center gap-3">
              <span className="size-3 shrink-0 rounded-full" style={{ background: p.color_hex }} />
              <span className="flex-1 text-sm text-zinc-200">{p.nombre}</span>
              <button
                type="button"
                onClick={() => p.id != null && borrarProyecto(p.id)}
                className="text-xs text-zinc-500 transition-colors hover:text-red-400"
              >
                Archivar
              </button>
            </Card>
          ))}
        </div>
      </section>

      <EditarTareaModal
        tarea={editando}
        proyectos={proyectos ?? []}
        onClose={() => setEditando(null)}
      />
    </div>
  );
}

function NuevaTareaForm({
  proyectos,
}: {
  proyectos: { id?: number; nombre: string }[];
}) {
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [prioridad, setPrioridad] = useState<PrioridadTarea>("media");
  const [proyectoId, setProyectoId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await crearTarea({
        titulo,
        fecha_vencimiento: fecha || undefined,
        prioridad,
        proyecto_id: proyectoId ? Number(proyectoId) : undefined,
      });
      setTitulo("");
      setFecha("");
      setPrioridad("media");
      setMsg("Tarea creada ✓");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo crear.");
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Título">
          <input
            className={inputCls}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Presupuesto para el cliente…"
          />
        </Field>
        <Field label="Vencimiento (opcional)">
          <input
            type="date"
            className={inputCls}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Field>
        <Field label="Prioridad">
          <select
            className={inputCls}
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as PrioridadTarea)}
          >
            {PRIORIDADES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Proyecto (opcional)">
          <select
            className={inputCls}
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
          >
            <option value="">Sin proyecto</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <button type="submit" className={btnCls}>
            <Plus size={16} />
            Crear
          </button>
        </div>
      </form>
      {msg && <p className="mt-3 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}

function NuevoProyectoForm() {
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLORES_PROYECTO[0]);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await crearProyecto({ nombre, color_hex: color });
      setNombre("");
      setMsg("Proyecto creado ✓");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo crear.");
    }
  }

  return (
    <Card className="mb-3">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <Field label="Nombre del proyecto">
            <input
              className={inputCls}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Viaje a Bariloche, Remodelar el baño…"
            />
          </Field>
        </div>
        <div className="flex items-center gap-1.5">
          {COLORES_PROYECTO.map((c) => (
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
