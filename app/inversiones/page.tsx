"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRightLeft, Coins, Plus, X } from "lucide-react";
import { bovedaDB } from "@/lib/db";
import {
  registrarCompraDolares,
  registrarCambioDivisa,
  cerrarInversion,
  borrarInversion,
} from "@/lib/actions";
import { getCotizacionUSD } from "@/lib/config";
import { formatMoneda, formatMonedaCompact, formatFecha } from "@/lib/utils";
import { Card, SectionTitle, Field, EmptyState, inputCls, btnCls, PageHeader, LoadingState } from "@/components/ui";

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
      <PageHeader
        href="/inversiones"
        description="Cambio de divisas y compras de dólares con precio promedio."
      />
      <section>
        <SectionTitle>Cambio de divisas</SectionTitle>
        <p className="mb-3 text-xs text-subtle">
          Mueve dinero real entre dos de tus cuentas: sale de la cuenta de
          origen y entra a la de destino ya convertido con la cotización que
          cargues. Si compras dólares, también queda registrada la compra acá
          abajo para el precio promedio.
        </p>
        <CambioDivisaForm />
      </section>

      <section>
        <SectionTitle>Registrar compra de dólares (sólo cartera)</SectionTitle>
        <p className="mb-3 text-xs text-subtle">
          Para llevar el precio promedio de compra sin mover plata de ninguna
          cuenta (por ejemplo, dólares que ya tenías antes de usar la app).
        </p>
        <CompraDolaresForm />
      </section>

      <section>
        <SectionTitle>Tenencia de dólares</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-wide text-subtle">
              USD comprados (activos)
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">
              {formatMoneda(totalUsd, "USD")}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-subtle">
              ARS invertidos
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">
              {formatMonedaCompact(totalArs, "ARS")}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-subtle">
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
          <LoadingState />
        ) : compras.length === 0 ? (
          <EmptyState>Todavía no registraste compras de dólares.</EmptyState>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {compras.map((c) => {
              const totalOperacion =
                c.costo_ars ??
                (c.capital_inicial || 0) * (c.cotizacion_compra || 0);
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-surface px-4 py-3 text-sm"
                >
                  <div className="min-w-32">
                    <p className="font-medium text-zinc-200">
                      {c.tipo}
                      {c.estado === "cerrada" && (
                        <span className="ml-2 text-xs text-subtle">
                          (cerrada)
                        </span>
                      )}
                    </p>
                    {c.fecha && (
                      <p className="text-xs text-subtle">
                        {formatFecha(c.fecha)}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-subtle">
                      Monto adquirido
                    </p>
                    <p className="tabular-nums text-emerald-400">
                      {formatMoneda(c.capital_inicial, "USD")}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-subtle">
                      Cotización compra
                    </p>
                    <p className="tabular-nums text-zinc-200">
                      {c.cotizacion_compra ? `$${c.cotizacion_compra}` : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-subtle">
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
                        className="text-xs text-subtle hover:text-zinc-200"
                      >
                        Cerrar
                      </button>
                    )}
                    {c.id != null && (
                      <button
                        type="button"
                        onClick={() => borrarInversion(c.id!)}
                        className="text-subtle hover:text-red-400"
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
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {otras.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between bg-surface px-4 py-3 text-sm"
              >
                <span className="text-zinc-200">
                  {i.nombre}{" "}
                  <span className="text-xs text-subtle">({i.tipo})</span>
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

function CambioDivisaForm() {
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.orderBy("nombre").toArray(), []);
  const cotizacionGuardada = useLiveQuery(() => getCotizacionUSD(), []);

  const [origenId, setOrigenId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [monto, setMonto] = useState("");
  // "" hasta que el usuario la toca: mientras tanto se muestra/usa la
  // cotización guardada en Configuración como valor por defecto.
  const [cotizacionInput, setCotizacionInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const cotizacion =
    cotizacionInput !== ""
      ? cotizacionInput
      : cotizacionGuardada != null
        ? String(cotizacionGuardada)
        : "";

  const origen = cuentas?.find((c) => String(c.id) === origenId);
  const destino = cuentas?.find((c) => String(c.id) === destinoId);
  const montoNum = Number(monto);
  const cotizacionNum = Number(cotizacion);
  const montoDestino =
    origen && destino && montoNum > 0 && cotizacionNum > 0
      ? origen.moneda === "USD"
        ? montoNum * cotizacionNum
        : montoNum / cotizacionNum
      : 0;
  const operacion =
    origen && destino
      ? origen.moneda === "USD"
        ? "Venta de dólares"
        : destino.moneda === "USD"
          ? "Compra de dólares"
          : null
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const oid = Number(origenId);
    const did = Number(destinoId);
    if (!oid || !did) return setMsg("Elegí cuenta de origen y de destino.");
    if (!(montoNum > 0)) return setMsg("Ingresá un monto válido.");
    if (!(cotizacionNum > 0)) return setMsg("Ingresá la cotización.");
    try {
      const r = await registrarCambioDivisa({
        cuenta_origen_id: oid,
        cuenta_destino_id: did,
        monto_origen: montoNum,
        cotizacion: cotizacionNum,
      });
      setMonto("");
      setMsg(
        `Listo ✓ ${formatMoneda(montoNum, origen!.moneda)} → ${formatMoneda(r.montoDestino, destino!.moneda)}`,
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo registrar el cambio.");
    }
  }

  if ((cuentas?.length ?? 0) < 2) {
    return (
      <EmptyState>
        Necesitás al menos dos cuentas (una en ARS y otra en USD) para hacer un
        cambio de divisas.
      </EmptyState>
    );
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Sale de">
          <select
            className={inputCls}
            value={origenId}
            onChange={(e) => setOrigenId(e.target.value)}
          >
            <option value="">Elegir cuenta…</option>
            {cuentas?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.moneda})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Entra a">
          <select
            className={inputCls}
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
          >
            <option value="">Elegir cuenta…</option>
            {cuentas
              ?.filter((c) => String(c.id) !== origenId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.moneda})
                </option>
              ))}
          </select>
        </Field>
        <Field label={`Monto${origen ? ` (${origen.moneda})` : ""}`}>
          <input
            type="number"
            min={0}
            step="0.01"
            className={inputCls}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Cotización (ARS por USD)">
          <input
            type="number"
            min={0}
            step="0.01"
            className={inputCls}
            value={cotizacion}
            onChange={(e) => setCotizacionInput(e.target.value)}
            placeholder="1450"
          />
        </Field>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <button type="submit" className={btnCls}>
            <ArrowRightLeft size={16} />
            Registrar cambio
          </button>
        </div>
      </form>

      {origen && destino && origen.moneda !== destino.moneda && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <ArrowRightLeft size={15} className="text-subtle" />
          <span className="text-subtle">
            {operacion ? `${operacion}:` : ""}
          </span>
          <span className="font-semibold tabular-nums text-zinc-100">
            {formatMoneda(montoNum || 0, origen.moneda)} → {" "}
            {formatMoneda(montoDestino, destino.moneda)}
          </span>
        </div>
      )}
      {origen && destino && origen.moneda === destino.moneda && (
        <p className="mt-3 text-xs text-amber-400">
          Elegí cuentas de distinta moneda (una en ARS y otra en USD).
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-zinc-400">{msg}</p>}
    </Card>
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
        <Coins size={15} className="text-subtle" />
        <span className="text-subtle">Costo de la operación:</span>
        <span className="font-semibold tabular-nums text-zinc-100">
          {costoArs > 0 ? formatMoneda(costoArs, "ARS") : "—"}
        </span>
      </div>
      {msg && <p className="mt-2 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}
