"use client";

import { useState } from "react";
import { Sparkles, Check, X } from "lucide-react";
import { procesarTextoGasto, type ResultadoGasto } from "@/lib/categorizer";
import { registrarTransaccion } from "@/lib/actions";
import { formatMoneda } from "@/lib/utils";
import { Card, inputCls, btnCls, btnGhostCls } from "@/components/ui";

/**
 * Entrada rápida en lenguaje natural: escribís "5000 nafta ypf con mp" y el
 * motor determinista arma la transacción. Se muestra una vista previa antes
 * de guardar en IndexedDB.
 */
export default function QuickInput() {
  const [texto, setTexto] = useState("");
  const [preview, setPreview] = useState<ResultadoGasto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function analizar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!texto.trim()) return;
    setPreview(procesarTextoGasto(texto));
  }

  async function confirmar() {
    if (!preview) return;
    if (!preview.monto || preview.monto <= 0) {
      setMsg("No se detectó un monto válido en el texto.");
      return;
    }
    setGuardando(true);
    try {
      await registrarTransaccion(preview);
      setMsg("Movimiento guardado ✓");
      setTexto("");
      setPreview(null);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card>
      <form onSubmit={analizar} className="flex flex-col gap-3 sm:flex-row">
        <input
          className={inputCls}
          placeholder='Ej: "5000 nafta ypf con mp" o "cobré 300000 sueldo"'
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className={btnCls}>
          <Sparkles size={16} />
          Analizar
        </button>
      </form>

      {preview && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Dato label="Monto" valor={formatMoneda(preview.monto, preview.moneda)} />
            <Dato label="Cuenta" valor={preview.cuenta} />
            <Dato label="Tipo" valor={preview.tipo} />
            <Dato label="Categoría" valor={preview.categoria} />
          </div>
          {preview.tipo === "egreso" && (
            <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={preview.reintegrable}
                onChange={(e) =>
                  setPreview({ ...preview, reintegrable: e.target.checked })
                }
              />
              Reintegrable (me lo van a devolver) → aparece en “Por cobrar”
            </label>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={confirmar} disabled={guardando} className={btnCls}>
              <Check size={16} />
              {guardando ? "Guardando…" : "Confirmar y guardar"}
            </button>
            <button
              onClick={() => setPreview(null)}
              className={btnGhostCls}
              type="button"
            >
              <X size={16} />
              Descartar
            </button>
          </div>
        </div>
      )}

      {msg && <p className="mt-3 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 font-medium capitalize text-zinc-100">{valor}</p>
    </div>
  );
}
