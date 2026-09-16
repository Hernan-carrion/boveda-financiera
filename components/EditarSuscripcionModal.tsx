"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X } from "lucide-react";
import type { Cuenta, Moneda, Suscripcion } from "@/lib/db";
import { CATEGORIAS_EGRESO } from "@/lib/categorizer";
import { actualizarSuscripcion, borrarSuscripcion } from "@/lib/actions";
import { inputCls, btnCls, Field } from "@/components/ui";

/**
 * Modal glassmorphism para editar cualquier campo de una suscripción ya
 * cargada, o eliminarla (borrado lógico — ver el comentario en `lib/db.ts`).
 * Mismo patrón que `EditarMovimientoModal`.
 */
export default function EditarSuscripcionModal({
  sus,
  cuentas,
  onClose,
}: {
  sus: Suscripcion | null;
  cuentas: Cuenta[];
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {sus && (
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
              <p className="text-sm font-medium text-zinc-100">Editar suscripción</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* key={sus.id}: remonta el form entero al cambiar de suscripción,
                así el estado arranca siempre de los valores actuales sin
                necesitar un efecto que lo sincronice. */}
            <SuscripcionForm key={sus.id} sus={sus} cuentas={cuentas} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SuscripcionForm({
  sus,
  cuentas,
  onClose,
}: {
  sus: Suscripcion;
  cuentas: Cuenta[];
  onClose: () => void;
}) {
  const [descripcion, setDescripcion] = useState(sus.descripcion);
  const [monto, setMonto] = useState(String(sus.monto));
  const [moneda, setMoneda] = useState<Moneda>(sus.moneda);
  const [categoria, setCategoria] = useState(sus.categoria);
  const [cuentaId, setCuentaId] = useState(String(sus.cuenta_id));
  const [diaCobro, setDiaCobro] = useState(String(sus.dia_cobro));
  const [activa, setActiva] = useState(sus.activa);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (sus.id == null) return;
    const m = Number(monto);
    if (!descripcion.trim()) {
      setMsg("Poné una descripción.");
      return;
    }
    if (!(m > 0)) {
      setMsg("El monto debe ser mayor a 0.");
      return;
    }
    const cid = Number(cuentaId);
    if (!cid) {
      setMsg("Elegí una cuenta.");
      return;
    }
    setGuardando(true);
    try {
      await actualizarSuscripcion(sus.id, {
        descripcion: descripcion.trim(),
        monto: m,
        moneda,
        categoria,
        cuenta_id: cid,
        dia_cobro: Math.min(31, Math.max(1, Number(diaCobro) || 1)),
        activa,
      });
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (sus.id == null) return;
    if (
      !window.confirm(
        `¿Eliminar la suscripción "${sus.descripcion}"? No genera más cobros futuros.`,
      )
    ) {
      return;
    }
    await borrarSuscripcion(sus.id);
    onClose();
  }

  return (
    <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Descripción">
          <input
            className={inputCls}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Monto">
        <input
          type="number"
          min={0}
          step="0.01"
          className={inputCls}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
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

      <div className="col-span-2">
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
      </div>

      <Field label="Cuenta">
        <select
          className={inputCls}
          value={cuentaId}
          onChange={(e) => setCuentaId(e.target.value)}
        >
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Día de cobro">
        <input
          type="number"
          min={1}
          max={31}
          className={inputCls}
          value={diaCobro}
          onChange={(e) => setDiaCobro(e.target.value)}
        />
      </Field>

      <div className="col-span-2">
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={activa}
            onChange={(e) => setActiva(e.target.checked)}
          />
          Activa
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
