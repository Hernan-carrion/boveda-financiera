"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X } from "lucide-react";
import type { Cuenta, Moneda, Transaccion, TipoTransaccion } from "@/lib/db";
import { CATEGORIAS_DISPONIBLES } from "@/lib/categorizer";
import { actualizarTransaccion, borrarTransaccion } from "@/lib/actions";
import { inputCls, btnCls, Field } from "@/components/ui";

const TIPOS: { value: TipoTransaccion; label: string }[] = [
  { value: "egreso", label: "Egreso" },
  { value: "ingreso", label: "Ingreso" },
  { value: "prestamo", label: "Préstamo" },
  { value: "devolucion", label: "Devolución" },
];

/** "2026-09-13T14:05" a partir de un ISO, para el input datetime-local. */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** El valor de un datetime-local (hora local) de vuelta a ISO. */
function fromDatetimeLocal(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Modal glassmorphism para editar cualquier campo de un movimiento ya
 * cargado (monto, cuenta, tipo, moneda, categoría, fecha, descripción) o
 * eliminarlo. Recalcula el saldo de la cuenta al guardar o al borrar.
 */
export default function EditarMovimientoModal({
  tx,
  cuentas,
  onClose,
}: {
  tx: Transaccion | null;
  cuentas: Cuenta[];
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {tx && (
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
              <p className="text-sm font-medium text-zinc-100">Editar movimiento</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* key={tx.id}: al cambiar de movimiento se remonta el form entero,
                así el estado arranca siempre de los valores del tx actual sin
                necesitar un efecto que lo sincronice. */}
            <MovimientoForm key={tx.id} tx={tx} cuentas={cuentas} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MovimientoForm({
  tx,
  cuentas,
  onClose,
}: {
  tx: Transaccion;
  cuentas: Cuenta[];
  onClose: () => void;
}) {
  const [descripcion, setDescripcion] = useState(tx.descripcion);
  const [monto, setMonto] = useState(String(tx.monto));
  const [moneda, setMoneda] = useState<Moneda>(tx.moneda);
  const [tipo, setTipo] = useState<TipoTransaccion>(tx.tipo);
  const [categoria, setCategoria] = useState(tx.categoria);
  const [cuentaId, setCuentaId] = useState(String(tx.cuenta_id));
  const [fecha, setFecha] = useState(toDatetimeLocal(tx.fecha));
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (tx.id == null) return;
    const m = Number(monto);
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
      await actualizarTransaccion(tx.id, {
        descripcion: descripcion.trim(),
        monto: m,
        moneda,
        tipo,
        categoria,
        cuenta_id: cid,
        fecha: fecha ? fromDatetimeLocal(fecha) : undefined,
      });
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (tx.id == null) return;
    if (
      !window.confirm(
        "¿Eliminar este movimiento? El saldo de la cuenta se ajusta solo, como si nunca se hubiera cargado.",
      )
    ) {
      return;
    }
    await borrarTransaccion(tx.id);
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

      <Field label="Tipo">
        <select
          className={inputCls}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoTransaccion)}
        >
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

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

      <div className="col-span-2">
        <Field label="Categoría">
          <select
            className={inputCls}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {CATEGORIAS_DISPONIBLES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="col-span-2">
        <Field label="Fecha">
          <input
            type="datetime-local"
            className={inputCls}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
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
