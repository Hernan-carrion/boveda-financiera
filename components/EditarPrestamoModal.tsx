"use client";

import { useState } from "react";
import type { Prestamo } from "@/lib/db";
import { actualizarPrestamo } from "@/lib/actions";
import { montoDevuelto } from "@/lib/prestamos";
import { formatMoneda } from "@/lib/utils";
import { inputCls, btnCls, Field } from "@/components/ui";
import Modal from "@/components/Modal";

/** "2026-09-13" (hora local) a partir de un ISO, para el input date. */
function aFechaLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Modal para editar un préstamo ya cargado (persona, monto, cotización,
 * fecha). Mismo patrón que `EditarSuscripcionModal`. El tipo y la moneda no
 * se editan: ya generaron movimientos en una cuenta de esa moneda.
 */
export default function EditarPrestamoModal({
  prestamo,
  onClose,
}: {
  prestamo: Prestamo | null;
  onClose: () => void;
}) {
  return (
    <Modal open={!!prestamo} title="Editar préstamo" onClose={onClose}>
      {prestamo && <PrestamoForm key={prestamo.id} prestamo={prestamo} onClose={onClose} />}
    </Modal>
  );
}

function PrestamoForm({
  prestamo,
  onClose,
}: {
  prestamo: Prestamo;
  onClose: () => void;
}) {
  const [persona, setPersona] = useState(prestamo.persona);
  const [monto, setMonto] = useState(String(prestamo.monto));
  const [cotizacion, setCotizacion] = useState(
    prestamo.cotizacion_origen ? String(prestamo.cotizacion_origen) : "",
  );
  const [fecha, setFecha] = useState(aFechaLocal(prestamo.fecha_prestamo));
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const devuelto = montoDevuelto(prestamo);
  const montoNum = Number(monto);
  const restante = Math.max(0, Math.round((montoNum - devuelto) * 100) / 100);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (prestamo.id == null) return;
    setGuardando(true);
    try {
      await actualizarPrestamo(prestamo.id, {
        persona,
        monto: montoNum,
        cotizacion_origen: Number(cotizacion) > 0 ? Number(cotizacion) : null,
        // Si no se tocó la fecha se conserva el ISO original (con su hora).
        fecha_prestamo:
          fecha === aFechaLocal(prestamo.fecha_prestamo) || !fecha
            ? prestamo.fecha_prestamo
            : new Date(`${fecha}T12:00:00`).toISOString(),
      });
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Persona">
          <input
            className={inputCls}
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
          />
        </Field>
      </div>

      <div className="col-span-2">
        <Field label={`Monto del préstamo (${prestamo.moneda})`}>
          <input
            type="number"
            min={0}
            step="0.01"
            className={inputCls}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </Field>
        {montoNum > 0 &&
          (montoNum < devuelto - 0.005 ? (
            <p className="mt-1.5 text-xs text-red-400">
              No puede ser menor a lo ya devuelto ({formatMoneda(devuelto, prestamo.moneda)}).
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-subtle">
              Ya devuelto {formatMoneda(devuelto, prestamo.moneda)} · quedaría{" "}
              <span className="font-medium text-zinc-200">
                {restante > 0 ? `resta ${formatMoneda(restante, prestamo.moneda)}` : "saldado"}
              </span>
            </p>
          ))}
      </div>

      <Field label="Fecha">
        <input
          type="date"
          className={inputCls}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </Field>

      <Field label="Dólar al prestar">
        <input
          type="number"
          min={0}
          step="0.01"
          className={inputCls}
          value={cotizacion}
          onChange={(e) => setCotizacion(e.target.value)}
          placeholder="Opcional"
        />
      </Field>

      <p className="col-span-2 text-xs text-subtle">
        Cambiar el monto sólo cambia lo que se debe: no modifica movimientos ni
        saldos. Si te perdonaron una parte, también podés registrarla como
        devolución &quot;sin mover una cuenta&quot; y queda en el historial.
      </p>

      <div className="col-span-2 mt-1 flex justify-end">
        <button type="submit" disabled={guardando} className={btnCls}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
      {msg && <p className="col-span-2 text-xs text-red-400">{msg}</p>}
    </form>
  );
}
