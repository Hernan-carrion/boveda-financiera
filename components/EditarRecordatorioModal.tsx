"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Recordatorio, RepeticionRecordatorio } from "@/lib/db";
import { actualizarRecordatorio, borrarRecordatorio } from "@/lib/actions";
import { CATEGORIAS_RECORDATORIO } from "@/lib/recordatorios";
import { inputCls, btnCls, Field } from "@/components/ui";
import Modal from "@/components/Modal";

/** Mismo patrón que EditarMovimientoModal / EditarSuscripcionModal. */
export default function EditarRecordatorioModal({
  recordatorio,
  onClose,
}: {
  recordatorio: Recordatorio | null;
  onClose: () => void;
}) {
  return (
    <Modal open={!!recordatorio} title="Editar recordatorio" onClose={onClose}>
      {recordatorio && <RecordatorioForm key={recordatorio.id} recordatorio={recordatorio} onClose={onClose} />}
    </Modal>
  );
}

function RecordatorioForm({
  recordatorio,
  onClose,
}: {
  recordatorio: Recordatorio;
  onClose: () => void;
}) {
  const [titulo, setTitulo] = useState(recordatorio.titulo);
  const [categoria, setCategoria] = useState(recordatorio.categoria);
  const [fecha, setFecha] = useState(recordatorio.fecha);
  const [repetir, setRepetir] = useState<RepeticionRecordatorio>(recordatorio.repetir);
  const [diasAviso, setDiasAviso] = useState(String(recordatorio.dias_aviso));
  const [activo, setActivo] = useState(recordatorio.activo);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (recordatorio.id == null) return;
    if (!titulo.trim()) {
      setMsg("El título no puede estar vacío.");
      return;
    }
    if (!fecha) {
      setMsg("Elegí una fecha.");
      return;
    }
    setGuardando(true);
    try {
      await actualizarRecordatorio(recordatorio.id, {
        titulo: titulo.trim(),
        categoria,
        fecha,
        repetir,
        dias_aviso: Math.max(0, Number(diasAviso) || 0),
        activo,
      });
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (recordatorio.id == null) return;
    if (!window.confirm(`¿Eliminar el recordatorio "${recordatorio.titulo}"?`)) return;
    await borrarRecordatorio(recordatorio.id);
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

      <Field label="Categoría">
        <select
          className={inputCls}
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          {CATEGORIAS_RECORDATORIO.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Fecha">
        <input
          type="date"
          className={inputCls}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </Field>

      <Field label="Se repite">
        <select
          className={inputCls}
          value={repetir}
          onChange={(e) => setRepetir(e.target.value as RepeticionRecordatorio)}
        >
          <option value="ninguna">No</option>
          <option value="mensual">Cada mes</option>
          <option value="anual">Cada año</option>
        </select>
      </Field>

      <Field label="Avisar con (días)">
        <input
          type="number"
          min={0}
          max={60}
          className={inputCls}
          value={diasAviso}
          onChange={(e) => setDiasAviso(e.target.value)}
        />
      </Field>

      <div className="col-span-2">
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
          />
          Activo
        </label>
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
