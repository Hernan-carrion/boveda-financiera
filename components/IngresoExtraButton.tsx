"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import { cobrarIngresoExtra, type CategoriaIngresoExtra } from "@/lib/actions";
import { formatMoneda } from "@/lib/utils";
import { inputCls, btnCls } from "@/components/ui";

/**
 * Acción rápida para acreditar un ingreso extra (comisión o trabajo
 * independiente) a Mercado Pago. A diferencia de "Cobrar sueldo" no tiene
 * monto precargado: varía cada vez, así que siempre se carga a mano.
 */
export default function IngresoExtraButton({
  categoria,
  label,
  Icon,
}: {
  categoria: CategoriaIngresoExtra;
  label: string;
  Icon: LucideIcon;
}) {
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cobrando, setCobrando] = useState(false);

  async function cobrar() {
    const m = Number(monto);
    if (!(m > 0)) {
      toast.error("Ingresá un monto válido.");
      return;
    }
    setCobrando(true);
    try {
      const r = await cobrarIngresoExtra(categoria, m, descripcion);
      toast.success(`${label} acreditado a Mercado Pago: ${formatMoneda(r.monto, r.moneda)}`);
      setMonto("");
      setDescripcion("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `No se pudo acreditar ${label.toLowerCase()}.`,
      );
    } finally {
      setCobrando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-[11rem] items-center gap-2 text-zinc-300">
        <Icon size={16} className="text-emerald-400" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <input
        type="number"
        min={0}
        step="0.01"
        className={`${inputCls} w-32`}
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        placeholder="Monto"
      />
      <input
        className={`${inputCls} w-44`}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Descripción (opcional)"
      />
      <button
        type="button"
        onClick={cobrar}
        disabled={cobrando || !(Number(monto) > 0)}
        className={btnCls}
      >
        {cobrando ? "Acreditando…" : "Cobrar"}
      </button>
    </div>
  );
}
