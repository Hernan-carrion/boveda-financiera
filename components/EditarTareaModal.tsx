"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Tarea, PrioridadTarea } from "@/lib/db";
import { actualizarTarea, borrarTarea } from "@/lib/actions";
import { inputCls, btnCls, Field } from "@/components/ui";
import Modal from "@/components/Modal";

const PRIORIDADES: { value: PrioridadTarea; label: string }[] = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];

/** Mismo patrón que EditarMovimientoModal / EditarSuscripcionModal. */
export default function EditarTareaModal({
  tarea,
  proyectos,
  onClose,
}: {
  tarea: Tarea | null;
  proyectos: { id?: number; nombre: string }[];
  onClose: () => void;
}) {
  return (
    <Modal open={!!tarea} title="Editar tarea" onClose={onClose}>
      {tarea && <TareaForm key={tarea.id} tarea={tarea} proyectos={proyectos} onClose={onClose} />}
    </Modal>
  );
}

function TareaForm({
  tarea,
  proyectos,
  onClose,
}: {
  tarea: Tarea;
  proyectos: { id?: number; nombre: string }[];
  onClose: () => void;
}) {
  const [titulo, setTitulo] = useState(tarea.titulo);
  const [descripcion, setDescripcion] = useState(tarea.descripcion ?? "");
  const [fecha, setFecha] = useState(tarea.fecha_vencimiento ?? "");
  const [prioridad, setPrioridad] = useState<PrioridadTarea>(tarea.prioridad);
  const [proyectoId, setProyectoId] = useState(String(tarea.proyecto_id ?? ""));
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (tarea.id == null) return;
    if (!titulo.trim()) {
      setMsg("El título no puede estar vacío.");
      return;
    }
    setGuardando(true);
    try {
      await actualizarTarea(tarea.id, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        fecha_vencimiento: fecha || undefined,
        prioridad,
        proyecto_id: proyectoId ? Number(proyectoId) : undefined,
      });
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (tarea.id == null) return;
    if (!window.confirm(`¿Eliminar la tarea "${tarea.titulo}"?`)) return;
    await borrarTarea(tarea.id);
    onClose();
  }

  return (
    <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Título">
          <input
            className={inputCls}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </Field>
      </div>

      <div className="col-span-2">
        <Field label="Descripción (opcional)">
          <textarea
            className={inputCls}
            rows={2}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Vencimiento">
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

      <div className="col-span-2">
        <Field label="Proyecto">
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
      </div>

      <div className="col-span-2 mt-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={eliminar}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 size={15} />
          Eliminar
        </button>
        <button type="submit" disabled={guardando} className={btnCls}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
      {msg && <p className="col-span-2 text-xs text-red-400">{msg}</p>}
    </form>
  );
}
