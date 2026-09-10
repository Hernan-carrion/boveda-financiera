"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { HandCoins, TrendingUp, TrendingDown } from "lucide-react";
import {
  bovedaDB,
  type Cuenta,
  type Moneda,
  type Prestamo,
  type TipoPrestamo,
} from "@/lib/db";
import { registrarPrestamo, registrarDevolucionPrestamo } from "@/lib/actions";
import { analizarVolatilidad } from "@/lib/fx";
import { formatMoneda, formatFecha, formatPct } from "@/lib/utils";
import {
  Card,
  SectionTitle,
  Field,
  EmptyState,
  inputCls,
  btnCls,
  btnGhostCls,
} from "@/components/ui";

export default function PrestamosPage() {
  const prestamos = useLiveQuery(
    () => bovedaDB.prestamos.orderBy("fecha_prestamo").reverse().toArray(),
    [],
  );
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.toArray(), []);

  const abiertos = (prestamos ?? []).filter((p) => p.estado === "abierto");
  // "!== abierto" cubre "devuelto" y filas viejas migradas desde "saldado"
  const devueltos = (prestamos ?? []).filter((p) => p.estado !== "abierto");

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Asentar préstamo</SectionTitle>
        <NuevoPrestamoForm cuentas={cuentas ?? []} />
      </section>

      <section>
        <SectionTitle>Abiertos</SectionTitle>
        {prestamos === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : abiertos.length === 0 ? (
          <EmptyState>No hay préstamos abiertos.</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {abiertos.map((p) => (
              <PrestamoRow key={p.id} prestamo={p} cuentas={cuentas ?? []} />
            ))}
          </div>
        )}
      </section>

      {devueltos.length > 0 && (
        <section>
          <SectionTitle>Devueltos</SectionTitle>
          <div className="flex flex-col gap-3">
            {devueltos.map((p) => (
              <PrestamoDevueltoRow key={p.id} prestamo={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NuevoPrestamoForm({ cuentas }: { cuentas: Cuenta[] }) {
  const [persona, setPersona] = useState("");
  const [tipo, setTipo] = useState<TipoPrestamo>("otorgado");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [cuentaId, setCuentaId] = useState("");
  const [cotizacionOrigen, setCotizacionOrigen] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const m = Number(monto);
    const cid = Number(cuentaId);
    if (!persona.trim() || !m || m <= 0 || !cid) {
      setMsg("Completá persona, monto y cuenta.");
      return;
    }
    const cot = Number(cotizacionOrigen);
    await registrarPrestamo({
      persona: persona.trim(),
      tipo,
      monto: m,
      moneda,
      cuenta_id: cid,
      cotizacion_origen: cot > 0 ? cot : undefined,
    });
    setPersona("");
    setMonto("");
    setCotizacionOrigen("");
    setMsg("Préstamo asentado ✓");
  }

  if (cuentas.length === 0) {
    return <EmptyState>Necesitás al menos una cuenta.</EmptyState>;
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Persona">
          <input
            className={inputCls}
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="Juan"
          />
        </Field>
        <Field label="Tipo">
          <select
            className={inputCls}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoPrestamo)}
          >
            <option value="otorgado">Yo presté (otorgado)</option>
            <option value="recibido">Me prestaron (recibido)</option>
          </select>
        </Field>
        <Field label="Monto">
          <input
            type="number"
            min={0}
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
        <Field label="Cuenta afectada">
          <select
            className={inputCls}
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
          >
            <option value="">Elegir…</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.moneda})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cotización dólar al prestar (ARS/USD)">
          <input
            type="number"
            min={0}
            step="0.01"
            className={inputCls}
            value={cotizacionOrigen}
            onChange={(e) => setCotizacionOrigen(e.target.value)}
            placeholder="Opcional — para análisis de volatilidad"
          />
        </Field>
        <div className="flex items-end">
          <button type="submit" className={btnCls}>
            <HandCoins size={16} />
            Asentar
          </button>
        </div>
      </form>
      {msg && <p className="mt-3 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}

function PrestamoRow({
  prestamo,
  cuentas,
}: {
  prestamo: Prestamo;
  cuentas: Cuenta[];
}) {
  const [cuentaId, setCuentaId] = useState("");
  const [monto, setMonto] = useState("");
  const [cotizacionCierre, setCotizacionCierre] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const tieneOrigen = !!prestamo.cotizacion_origen;

  async function devolver(e: React.FormEvent) {
    e.preventDefault();
    const cid = Number(cuentaId);
    const m = Number(monto) || prestamo.monto;
    if (!cid || m <= 0) {
      setMsg("Elegí la cuenta.");
      return;
    }
    const cot = Number(cotizacionCierre);
    if (tieneOrigen && !(cot > 0)) {
      setMsg("Ingresá la cotización del dólar al momento de la devolución.");
      return;
    }
    if (prestamo.id == null) return;
    await registrarDevolucionPrestamo(
      prestamo.id,
      cid,
      m,
      cot > 0 ? cot : undefined,
    );
    setMsg("Devolución registrada ✓");
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-zinc-200">{prestamo.persona}</span>
        <span className="text-zinc-500">
          {prestamo.tipo === "otorgado" ? "le presté" : "me prestó"}
        </span>
        <span className="text-zinc-500">
          {formatFecha(prestamo.fecha_prestamo)}
        </span>
        {tieneOrigen && (
          <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-xs tabular-nums text-zinc-400">
            dólar @ ${prestamo.cotizacion_origen}
          </span>
        )}
        <span className="ml-auto tabular-nums font-semibold text-zinc-100">
          {formatMoneda(prestamo.monto, prestamo.moneda)}
        </span>
      </div>

      <form
        onSubmit={devolver}
        className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        <select
          className={inputCls}
          value={cuentaId}
          onChange={(e) => setCuentaId(e.target.value)}
        >
          <option value="">
            {prestamo.tipo === "otorgado" ? "Ingresa a…" : "Sale de…"}
          </option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({c.moneda})
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          className={inputCls}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder={`Total ${prestamo.monto}`}
        />
        <input
          type="number"
          min={0}
          step="0.01"
          className={inputCls}
          value={cotizacionCierre}
          onChange={(e) => setCotizacionCierre(e.target.value)}
          placeholder={
            tieneOrigen ? "Cotización dólar hoy" : "Cotización dólar hoy (opc.)"
          }
        />
        <button type="submit" className={btnGhostCls}>
          Registrar devolución
        </button>
      </form>
      {msg && <p className="mt-2 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}

function PrestamoDevueltoRow({ prestamo }: { prestamo: Prestamo }) {
  const vol = analizarVolatilidad(prestamo);

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-zinc-300">{prestamo.persona}</span>
        <span className="text-zinc-500">
          {prestamo.tipo === "otorgado" ? "le presté" : "me prestó"}
        </span>
        {prestamo.fecha_devolucion && (
          <span className="text-xs text-zinc-500">
            devuelto {formatFecha(prestamo.fecha_devolucion)}
          </span>
        )}
        <span className="ml-auto tabular-nums text-zinc-400 line-through">
          {formatMoneda(prestamo.monto, prestamo.moneda)}
        </span>
        <span className="text-emerald-400">devuelto</span>
      </div>

      {vol ? (
        <div
          className={
            vol.aFavor
              ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3"
              : "rounded-lg border border-red-500/30 bg-red-500/10 p-3"
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                vol.aFavor
                  ? "inline-flex items-center gap-1 text-sm font-semibold text-emerald-300"
                  : "inline-flex items-center gap-1 text-sm font-semibold text-red-300"
              }
            >
              {vol.aFavor ? (
                <TrendingUp size={15} />
              ) : (
                <TrendingDown size={15} />
              )}
              Diferencia por Volatilidad: {vol.impacto >= 0 ? "+" : "−"}
              {formatMoneda(Math.abs(vol.impacto), "ARS")} ARS
            </span>
            <span
              className={
                vol.aFavor
                  ? "rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-xs font-medium text-emerald-200"
                  : "rounded-md bg-red-500/20 px-1.5 py-0.5 text-xs font-medium text-red-200"
              }
            >
              {vol.aFavor ? "Ganaste" : "Perdiste"} poder adquisitivo
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400 tabular-nums">
            El dólar pasó de ${vol.origen} a ${vol.cierre} (
            {formatPct(vol.variacionPct)}) mientras duró el préstamo.
          </p>
        </div>
      ) : (
        <p className="text-xs text-zinc-600">
          Sin cotizaciones cargadas — no se puede calcular el impacto cambiario.
        </p>
      )}
    </Card>
  );
}
