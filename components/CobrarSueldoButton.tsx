"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Banknote } from "lucide-react";
import { toast } from "sonner";
import { getMontoSueldo } from "@/lib/config";
import { cobrarSueldo } from "@/lib/actions";
import { formatMoneda } from "@/lib/utils";
import { Card, inputCls, btnCls } from "@/components/ui";

/**
 * Acción rápida del dashboard: acredita un cobro de sueldo directo a Mercado
 * Pago (siempre esa cuenta). El monto viene precargado desde el que se
 * configuró en Configuración, pero se puede pisar acá mismo antes de
 * confirmar — para un adelanto o un monto distinto sin ir a otro lado.
 */
export default function CobrarSueldoButton() {
  const montoConfigurado = useLiveQuery(() => getMontoSueldo(), []);
  const [montoInput, setMontoInput] = useState("");
  const [cobrando, setCobrando] = useState(false);

  const montoStr =
    montoInput !== ""
      ? montoInput
      : montoConfigurado && montoConfigurado > 0
        ? String(montoConfigurado)
        : "";

  async function cobrar() {
    const m = Number(montoStr);
    if (!(m > 0)) {
      toast.error("Ingresá un monto válido.");
      return;
    }
    setCobrando(true);
    try {
      const r = await cobrarSueldo(m);
      toast.success(`Sueldo acreditado a Mercado Pago: ${formatMoneda(r.monto, r.moneda)}`);
      setMontoInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo acreditar el sueldo.");
    } finally {
      setCobrando(false);
    }
  }

  return (
    <Card className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-zinc-300">
        <Banknote size={16} className="text-emerald-400" />
        <span className="text-sm font-medium">Cobrar sueldo</span>
      </div>
      <input
        type="number"
        min={0}
        step="0.01"
        className={`${inputCls} w-36`}
        value={montoStr}
        onChange={(e) => setMontoInput(e.target.value)}
        placeholder="Monto"
      />
      <button
        type="button"
        onClick={cobrar}
        disabled={cobrando || !(Number(montoStr) > 0)}
        className={btnCls}
      >
        {cobrando ? "Acreditando…" : "Cobrar"}
      </button>
      <span className="text-xs text-zinc-500">
        {montoConfigurado
          ? "a Mercado Pago · podés cambiar el monto antes de cobrar"
          : "a Mercado Pago · configurá un monto fijo en Configuración"}
      </span>
    </Card>
  );
}
