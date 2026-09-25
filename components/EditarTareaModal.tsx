"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X } from "lucide-react";
import type { Tarea, PrioridadTarea } from "@/lib/db";
import { actualizarTarea, borrarTarea } from "@/lib/actions";
import { inputCls, btnCls, Field } from "@/components/ui";

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
    <AnimatePresence>
      {tarea && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-t-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-2xl backdrop-blur-xl sm:rounded-2xl"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <p className="text-sm font-medium text-zinc-100">Editar tarea</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <TareaForm key={tarea.id} tarea={tarea} proyectos={proyectos} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
