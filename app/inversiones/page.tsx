"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Coins, Plus, X } from "lucide-react";
import { bovedaDB } from "@/lib/db";
import {
  registrarCompraDolares,
  cerrarInversion,
  borrarInversion,
} from "@/lib/actions";
import { formatMoneda, formatMonedaCompact, formatFecha } from "@/lib/utils";
import {
  Card,
  SectionTitle,
  Field,
  EmptyState,
  inputCls,
  btnCls,
} from "@/components/ui";

const TIPOS_DOLAR = ["MEP", "Blue", "CCL", "Oficial", "Cripto"];

export default function InversionesPage() {
  const inversiones = useLiveQuery(
    () => bovedaDB.inversiones.reverse().toArray(),
    [],
  );

  const compras = useMemo(
    () => (inversiones ?? []).filter((i) => i.moneda === "USD"),
    [inversiones],
  );
  const otras = useMemo(
    () => (inversiones ?? []).filter((i) => i.moneda !== "USD"),
    [inversiones],
  );

  const totalUsd = compras
    .filter((c) => c.estado === "activa")
    .reduce((s, c) => s + (c.capital_inicial || 0), 0);
  const totalArs = compras
    .filter((c) => c.estado === "activa")
    .reduce(
      (s, c) =>
        s + (c.costo_ars ?? (c.capital_inicial || 0) * (c.cotizacion_compra || 0)),
      0,
    );
  const ppc = totalUsd > 0 ? totalArs / totalUsd : 0;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Comprar dólares</SectionTitle>
        <CompraDolaresForm />
      </section>

      <section>
        <SectionTitle>Tenencia de dólares</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              USD comprados (activos)
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">
              {formatMoneda(totalUsd, "USD")}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              ARS invertidos
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">
              {formatMonedaCompact(totalArs, "ARS")}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Precio promedio de compra
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">
              {ppc > 0 ? `$${ppc.toFixed(2)}` : "—"}
            </p>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle>Compras registradas</SectionTitle>
        {inversiones === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : compras.length === 0 ? (
          <EmptyState>Todavía no registraste compras de dólares.</EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {compras.map((c) => {
              const totalOperacion =
                c.costo_ars ??
                (c.capital_inicial || 0) * (c.cotizacion_compra || 0);
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-zinc-900/40 px-4 py-3 text-sm"
                >
                  <div className="min-w-32">
                    <p className="font-medium text-zinc-200">
                      {c.tipo}
                      {c.estado === "cerrada" && (
                        <span className="ml-2 text-xs text-zinc-500">
                          (cerrada)
                        </span>
                      )}
                    </p>
                    {c.fecha && (
                      <p className="text-xs text-zinc-500">
                        {formatFecha(c.fecha)}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Monto adquirido
                    </p>
                    <p className="tabular-nums text-emerald-400">
                      {formatMoneda(c.capital_inicial, "USD")}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Cotización compra
                    </p>
                    <p className="tabular-nums text-zinc-200">
                      {c.cotizacion_compra ? `$${c.cotizacion_compra}` : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Total ARS invertidos
                    </p>
                    <p className="tabular-nums text-zinc-200">
                      {totalOperacion > 0
                        ? formatMoneda(totalOperacion, "ARS")
                        : "—"}
                    </p>
                  </div>

                  <div className="ml-auto flex gap-2">
                    {c.estado === "activa" && c.id != null && (
                      <button
                        type="button"
                        onClick={() => cerrarInversion(c.id!)}
                        className="text-xs text-zinc-500 hover:text-zinc-200"
                      >
                        Cerrar
                      </button>
                    )}
                    {c.id != null && (
                      <button
                        type="button"
                        onClick={() => borrarInversion(c.id!)}
                        className="text-zinc-600 hover:text-red-400"
                        aria-label="Borrar compra"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {otras.length > 0 && (
        <section>
          <SectionTitle>Otras inversiones</SectionTitle>
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {otras.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between bg-zinc-900/40 px-4 py-3 text-sm"
              >
                <span className="text-zinc-200">
                  {i.nombre}{" "}
                  <span className="text-xs text-zinc-500">({i.tipo})</span>
                </span>
                <span className="tabular-nums text-zinc-300">
                  {formatMoneda(i.capital_inicial, i.moneda)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CompraDolaresForm() {
  const [tipo, setTipo] = useState(TIPOS_DOLAR[0]);
  const [capital, setCapital] = useState("");
  const [cotizacion, setCotizacion] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const capitalNum = Number(capital);
  const cotizacionNum = Number(cotizacion);
  const costoArs =
    capitalNum > 0 && cotizacionNum > 0 ? capitalNum * cotizacionNum : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!(capitalNum > 0)) {
      setMsg("Ingresá el monto en USD.");
      return;
    }
    if (!(cotizacionNum > 0)) {
      setMsg("La cotización de compra (ARS por USD) es obligatoria.");
      return;
    }
    try {
      await registrarCompraDolares({
        tipo,
        capitalUsd: capitalNum,
        cotizacionCompra: cotizacionNum,
      });
      setCapital("");
      setCotizacion("");
      setMsg("Compra registrada ✓");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo registrar.");
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tipo de dólar">
          <select
            className={inputCls}
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            {TIPOS_DOLAR.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Monto adquirido (USD)">
          <input
            type="number"
            min={0}
            step="0.01"
            className={inputCls}
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            placeholder="200"
          />
        </Field>
        <Field label="Cotización de compra (ARS por USD) *">
          <input
            type="number"
            min={0}
            step="0.01"
            required
            className={inputCls}
            value={cotizacion}
            onChange={(e) => setCotizacion(e.target.value)}
            placeholder="1450"
          />
        </Field>
        <div className="flex items-end">
          <button type="submit" className={btnCls}>
            <Plus size={16} />
            Registrar
          </button>
        </div>
      </form>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <Coins size={15} className="text-zinc-500" />
        <span className="text-zinc-500">Costo de la operación:</span>
        <span className="font-semibold tabular-nums text-zinc-100">
          {costoArs > 0 ? formatMoneda(costoArs, "ARS") : "—"}
        </span>
      </div>
      {msg && <p className="mt-2 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}
