"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, PiggyBank, Trash2 } from "lucide-react";
import { bovedaDB, type Moneda } from "@/lib/db";
import { getCotizacionUSD } from "@/lib/config";
import { progresoMeta } from "@/lib/patrimonio";
import { formatMoneda } from "@/lib/utils";
import { ProgressBar, CircleProgress } from "@/components/ProgressBar";
import {
  Card,
  SectionTitle,
  Field,
  EmptyState,
  inputCls,
  btnCls,
} from "@/components/ui";

const COLORES = [
  "#34d399",
  "#60a5fa",
  "#f472b6",
  "#fbbf24",
  "#a78bfa",
  "#fb923c",
];

export default function MetasPage() {
  const metas = useLiveQuery(() => bovedaDB.metas_ahorro.toArray(), []);
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.toArray(), []);
  const cotizacion = useLiveQuery(() => getCotizacionUSD(), []);

  const cargando =
    metas === undefined || cuentas === undefined || cotizacion === undefined;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Metas de ahorro</SectionTitle>
        <p className="mb-3 text-xs text-zinc-500">
          El progreso consolida todo tu patrimonio (ARS + USD) a la moneda de la
          meta usando la cotización {formatMoneda(cotizacion ?? 0, "ARS")} / USD
          (se ajusta en Configuración).
        </p>

        {cargando ? (
          <Card className="text-sm text-zinc-500">Cargando…</Card>
        ) : metas.length === 0 ? (
          <EmptyState>Todavía no creaste metas de ahorro.</EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {metas.map((meta) => {
              const p = progresoMeta(meta, cuentas ?? [], cotizacion ?? 1);
              return (
                <Card key={meta.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <PiggyBank size={16} style={{ color: meta.color_hex }} />
                      <div>
                        <p className="text-sm font-medium text-zinc-100">
                          {meta.nombre}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Objetivo:{" "}
                          {formatMoneda(meta.monto_objetivo, meta.moneda)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        meta.id != null && bovedaDB.metas_ahorro.delete(meta.id)
                      }
                      className="text-zinc-600 transition-colors hover:text-red-400"
                      aria-label="Borrar meta"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <CircleProgress pct={p.pct} color={meta.color_hex} />
                    <div className="flex-1">
                      <p className="text-lg font-semibold tabular-nums text-zinc-50">
                        {formatMoneda(p.actual, meta.moneda)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {p.falta > 0
                          ? `Faltan ${formatMoneda(p.falta, meta.moneda)}`
                          : "¡Meta alcanzada! 🎉"}
                      </p>
                    </div>
                  </div>
                  {/* En una meta, más % siempre es bueno → barra verde. */}
                  <ProgressBar pct={p.pct} estado="ok" />
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Nueva meta</SectionTitle>
        <NuevaMetaForm />
      </section>
    </div>
  );
}

function NuevaMetaForm() {
  const [nombre, setNombre] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [color, setColor] = useState(COLORES[0]);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const monto = Number(objetivo);
    if (!nombre.trim()) return setMsg("Poné un nombre.");
    if (!(monto > 0)) return setMsg("El objetivo debe ser mayor a 0.");

    await bovedaDB.metas_ahorro.add({
      nombre: nombre.trim(),
      monto_objetivo: monto,
      moneda,
      color_hex: color,
      last_updated: new Date().toISOString(),
    });
    setNombre("");
    setObjetivo("");
    setMsg("Meta creada ✓");
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nombre">
          <input
            className={inputCls}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Moto 150cc, Llantas Golf…"
          />
        </Field>
        <Field label="Monto objetivo">
          <input
            type="number"
            className={inputCls}
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
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
        <Field label="Color">
          <div className="flex gap-1.5 pt-1">
            {COLORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: c,
                  borderColor: color === c ? "#f4f4f5" : "transparent",
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </Field>
        <div className="flex items-end">
          <button type="submit" className={btnCls}>
            <Plus size={16} />
            Crear
          </button>
        </div>
      </form>
      {msg && <p className="mt-3 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}
