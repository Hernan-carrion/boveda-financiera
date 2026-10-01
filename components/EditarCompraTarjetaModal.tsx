"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { CompraTarjeta, Moneda, Tarjeta } from "@/lib/db";
import { editarCompraTarjeta, borrarCompraTarjeta } from "@/lib/actions";
import { montoPorCuota } from "@/lib/cuotas";
import { formatMoneda } from "@/lib/utils";
import { inputCls, btnCls, Field } from "@/components/ui";
import Modal from "@/components/Modal";

/**
 * Modal para editar o eliminar una compra en cuotas ya cargada (ej: monto,
 * tarjeta o cantidad de cuotas mal puestos al cargarla). Mismo patrón que
 * `EditarSuscripcionModal` — ver `lib/actions.ts::editarCompraTarjeta` para
 * cómo se recalcula el reparto en `deudas_tarjetas`.
 */
export default function EditarCompraTarjetaModal({
  compra,
  tarjetas,
  onClose,
}: {
  compra: CompraTarjeta | null;
  tarjetas: Tarjeta[];
  onClose: () => void;
}) {
  return (
    <Modal open={!!compra} title="Editar compra" onClose={onClose}>
      {compra && (
        <CompraForm key={compra.id} compra={compra} tarjetas={tarjetas} onClose={onClose} />
      )}
    </Modal>
  );
}

function CompraForm({
  compra,
  tarjetas,
  onClose,
}: {
  compra: CompraTarjeta;
  tarjetas: Tarjeta[];
  onClose: () => void;
}) {
  const [tarjetaId, setTarjetaId] = useState(String(compra.tarjeta_id));
  const [descripcion, setDescripcion] = useState(compra.descripcion);
  const [monto, setMonto] = useState(String(compra.monto_total));
  const [cuotas, setCuotas] = useState(String(compra.cuotas_totales));
  const [periodoInicio, setPeriodoInicio] = useState(compra.periodo_inicio);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const tarjetaSel = tarjetas.find((t) => String(t.id) === tarjetaId);
  const montoNum = Number(monto);
  const cuotasNum = Math.max(1, Math.floor(Number(cuotas)) || 1);
  const moneda: Moneda = tarjetaSel?.moneda ?? compra.moneda;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (compra.id == null) return;
    const tid = Number(tarjetaId);
    if (!tid) {
      setMsg("Elegí una tarjeta.");
      return;
    }
    if (!descripcion.trim()) {
      setMsg("Poné una descripción.");
      return;
    }
    if (!(montoNum > 0)) {
      setMsg("El monto debe ser mayor a 0.");
      return;
    }
    setGuardando(true);
    try {
      await editarCompraTarjeta(compra.id, {
        tarjeta_id: tid,
        descripcion: descripcion.trim(),
        monto_total: montoNum,
        cuotas_totales: cuotasNum,
        moneda,
        periodo_inicio: periodoInicio || compra.periodo_inicio,
      });
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (compra.id == null) return;
    if (
      !window.confirm(
        `¿Eliminar la compra "${compra.descripcion}"? Se descuenta de los resúmenes de tarjeta que todavía no pagaste.`,
      )
    ) {
      return;
    }
    await borrarCompraTarjeta(compra.id);
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

      <div className="col-span-2">
        <Field label="Tarjeta">
          <select
            className={inputCls}
            value={tarjetaId}
            onChange={(e) => setTarjetaId(e.target.value)}
          >
            {tarjetas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Monto total">
        <input
          type="number"
          min={0}
          step="0.01"
          className={inputCls}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
      </Field>

      <Field label="Cantidad de cuotas">
        <input
          type="number"
          min={1}
          max={48}
          className={inputCls}
          value={cuotas}
          onChange={(e) => setCuotas(e.target.value)}
        />
      </Field>

      <div className="col-span-2">
        <Field label="Período de la 1ª cuota">
          <input
            type="month"
            className={inputCls}
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
          />
        </Field>
      </div>

      {montoNum > 0 && (
        <p className="col-span-2 text-xs text-subtle">
          {cuotasNum} cuota{cuotasNum === 1 ? "" : "s"} de{" "}
          <span className="font-medium text-zinc-200">
            {formatMoneda(montoPorCuota(montoNum, cuotasNum), moneda)}
          </span>
        </p>
      )}

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
