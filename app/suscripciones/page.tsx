"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Repeat, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { bovedaDB, type Moneda } from "@/lib/db";
import { CATEGORIAS_EGRESO } from "@/lib/categorizer";
import { procesarSuscripcionesVencidas } from "@/lib/actions";
import { formatMoneda, periodoActual } from "@/lib/utils";
import {
  Card,
  SectionTitle,
  Field,
  EmptyState,
  inputCls,
  btnCls,
  btnGhostCls,
} from "@/components/ui";

export default function SuscripcionesPage() {
  const suscripciones = useLiveQuery(
    () => bovedaDB.suscripciones.toArray(),
    [],
  );
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.toArray(), []);
  const periodo = periodoActual();

  async function procesarAhora() {
    const cobradas = await procesarSuscripcionesVencidas();
    if (cobradas.length === 0) {
      toast("No hay suscripciones pendientes de cobro este mes");
    } else {
      toast.success(`Se registraron ${cobradas.length} cobro(s)`, {
        description: cobradas.join(" · "),
      });
    }
  }

  const nombreCuenta = (id: number) =>
    cuentas?.find((c) => c.id === id)?.nombre ?? "—";

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Suscripciones</SectionTitle>
          <button onClick={procesarAhora} className={btnGhostCls}>
            <Play size={15} />
            Procesar cobros
          </button>
        </div>

        {suscripciones === undefined ? (
          <Card className="text-sm text-zinc-500">Cargando…</Card>
        ) : suscripciones.length === 0 ? (
          <EmptyState>Todavía no cargaste suscripciones.</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {suscripciones.map((s) => {
              const cobradaEsteMes = s.ultimo_cobro_periodo === periodo;
              return (
                <Card
                  key={s.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2"
                >
                  <Repeat size={16} className="text-zinc-500" />
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium text-zinc-200">
                      {s.descripcion}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Día {s.dia_cobro} · {nombreCuenta(s.cuenta_id)} · {s.categoria}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-zinc-100">
                    {formatMoneda(s.monto, s.moneda)}
                  </span>
                  <span
                    className={
                      cobradaEsteMes
                        ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400"
                        : "rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                    }
                  >
                    {cobradaEsteMes ? "Cobrada este mes" : "Pendiente"}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={s.activa}
                      onChange={(e) =>
                        s.id != null &&
                        bovedaDB.suscripciones.update(s.id, {
                          activa: e.target.checked,
                          last_updated: new Date().toISOString(),
                        })
                      }
                    />
                    Activa
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      s.id != null && bovedaDB.suscripciones.delete(s.id)
                    }
                    className="text-zinc-600 transition-colors hover:text-red-400"
                    aria-label="Borrar suscripción"
                  >
                    <Trash2 size={15} />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Nueva suscripción</SectionTitle>
        <NuevaSuscripcionForm
          cuentas={cuentas ?? []}
        />
      </section>
    </div>
  );
}

function NuevaSuscripcionForm({
  cuentas,
}: {
  cuentas: { id?: number; nombre: string; moneda: Moneda }[];
}) {
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [categoria, setCategoria] = useState("Suscripciones");
  const [cuentaId, setCuentaId] = useState<string>("");
  const [diaCobro, setDiaCobro] = useState("1");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const m = Number(monto);
    const dia = Math.min(31, Math.max(1, Number(diaCobro) || 1));
    const cuenta_id = Number(cuentaId) || cuentas[0]?.id;
    if (!descripcion.trim()) return setMsg("Poné una descripción.");
    if (!(m > 0)) return setMsg("El monto debe ser mayor a 0.");
    if (cuenta_id == null) return setMsg("Creá una cuenta primero.");

    await bovedaDB.suscripciones.add({
      descripcion: descripcion.trim(),
      monto: m,
      moneda,
      categoria,
      cuenta_id,
      dia_cobro: dia,
      activa: true,
      last_updated: new Date().toISOString(),
    });
    setDescripcion("");
    setMonto("");
    setMsg("Suscripción creada ✓");
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Descripción">
          <input
            className={inputCls}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Netflix, Gym, Spotify…"
          />
        </Field>
        <Field label="Monto">
          <input
            type="number"
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
        <Field label="Cuenta">
          <select
            className={inputCls}
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
          >
            <option value="">— elegí —</option>
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
