"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { HandCoins, Pencil, TrendingUp, TrendingDown } from "lucide-react";
import {
  bovedaDB,
  type Cuenta,
  type Moneda,
  type Prestamo,
  type TipoPrestamo,
} from "@/lib/db";
import {
  registrarPrestamo,
  registrarDevolucionPrestamo,
  deshacerDevolucionPrestamo,
} from "@/lib/actions";
import { montoDevuelto, montoRestante } from "@/lib/prestamos";
import { ProgressBar } from "@/components/ProgressBar";
import EditarPrestamoModal from "@/components/EditarPrestamoModal";
import { analizarVolatilidad } from "@/lib/fx";
import { formatMoneda, formatFecha, formatPct } from "@/lib/utils";
import { Card, SectionTitle, Field, EmptyState, inputCls, btnCls, btnGhostCls, PageHeader, LoadingState } from "@/components/ui";

export default function PrestamosPage() {
  const prestamos = useLiveQuery(
    () => bovedaDB.prestamos.orderBy("fecha_prestamo").reverse().toArray(),
    [],
  );
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.toArray(), []);
  const [editando, setEditando] = useState<Prestamo | null>(null);

  const abiertos = (prestamos ?? []).filter((p) => p.estado === "abierto");
  // "!== abierto" cubre "devuelto" y filas viejas migradas desde "saldado"
  const devueltos = (prestamos ?? []).filter((p) => p.estado !== "abierto");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        href="/prestamos"
        description="Plata prestada o pedida y sus devoluciones."
      />
      <section>
        <SectionTitle>Asentar préstamo</SectionTitle>
        <NuevoPrestamoForm cuentas={cuentas ?? []} />
      </section>

      <section>
        <SectionTitle>Abiertos</SectionTitle>
        {prestamos === undefined ? (
          <LoadingState />
        ) : abiertos.length === 0 ? (
          <EmptyState>No hay préstamos abiertos.</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {abiertos.map((p) => (
              <PrestamoRow
                key={p.id}
                prestamo={p}
                cuentas={cuentas ?? []}
                onEditar={() => setEditando(p)}
              />
            ))}
          </div>
        )}
      </section>

      {devueltos.length > 0 && (
        <section>
          <SectionTitle>Devueltos</SectionTitle>
          <div className="flex flex-col gap-3">
            {devueltos.map((p) => (
              <PrestamoDevueltoRow
                key={p.id}
                prestamo={p}
                cuentas={cuentas ?? []}
                onEditar={() => setEditando(p)}
              />
            ))}
          </div>
        </section>
      )}

      <EditarPrestamoModal prestamo={editando} onClose={() => setEditando(null)} />
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

const SIN_CUENTA = "sin-cuenta";

function PrestamoRow({
  prestamo,
  cuentas,
  onEditar,
}: {
  prestamo: Prestamo;
  cuentas: Cuenta[];
  onEditar: () => void;
}) {
  const [cuentaId, setCuentaId] = useState("");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [cotizacionCierre, setCotizacionCierre] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const tieneOrigen = !!prestamo.cotizacion_origen;
  const devuelto = montoDevuelto(prestamo);
  const restante = montoRestante(prestamo);
  // Una cuenta de otra moneda restaría el número crudo: sólo se ofrecen las
  // de la misma moneda del préstamo (o "sin mover una cuenta").
  const cuentasElegibles = cuentas.filter((c) => c.moneda === prestamo.moneda);

  async function devolver(e: React.FormEvent) {
    e.preventDefault();
    if (!cuentaId) {
      setMsg({
        ok: false,
        texto: `Elegí ${prestamo.tipo === "otorgado" ? "a qué cuenta ingresa" : "de qué cuenta sale"}, o "Sin mover una cuenta".`,
      });
      return;
    }
    const m = Number(monto) || restante;
    if (m <= 0) {
      setMsg({ ok: false, texto: "Poné un monto mayor a 0." });
      return;
    }
    const cot = Number(cotizacionCierre);
    if (tieneOrigen && !(cot > 0)) {
      setMsg({ ok: false, texto: "Ingresá la cotización del dólar al momento de la devolución." });
      return;
    }
    if (prestamo.id == null) return;
    try {
      await registrarDevolucionPrestamo(
        prestamo.id,
        cuentaId === SIN_CUENTA ? null : Number(cuentaId),
        m,
        cot > 0 ? cot : undefined,
        nota,
      );
      setMonto("");
      setNota("");
      setCotizacionCierre("");
      setMsg({ ok: true, texto: "Devolución registrada ✓" });
    } catch (err) {
      setMsg({ ok: false, texto: err instanceof Error ? err.message : "No se pudo registrar." });
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-zinc-200">{prestamo.persona}</span>
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar préstamo de ${prestamo.persona}`}
          className="-m-1.5 grid size-11 place-items-center rounded-lg text-subtle transition-colors hover:bg-white/5 hover:text-zinc-100"
        >
          <Pencil size={14} aria-hidden />
        </button>
        <span className="text-subtle">
          {prestamo.tipo === "otorgado" ? "le presté" : "me prestó"}
        </span>
        <span className="text-subtle">
          {formatFecha(prestamo.fecha_prestamo)}
        </span>
        {tieneOrigen && (
          <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-xs tabular-nums text-zinc-400">
            dólar @ ${prestamo.cotizacion_origen}
          </span>
        )}
        <span className="ml-auto text-right tabular-nums">
          <span className="font-semibold text-zinc-100">
            {devuelto > 0 ? "Resta " : ""}
            {formatMoneda(restante, prestamo.moneda)}
          </span>
          {devuelto > 0 && (
            <span className="block text-xs text-subtle">
              de {formatMoneda(prestamo.monto, prestamo.moneda)}
            </span>
          )}
        </span>
      </div>

      {devuelto > 0 && (
        <ProgressBar
          pct={(devuelto / prestamo.monto) * 100}
          estado="ok"
          className="mt-3"
        />
      )}
      <HistorialDevoluciones prestamo={prestamo} cuentas={cuentas} />

      <form
        onSubmit={devolver}
        className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        <select
          aria-label={prestamo.tipo === "otorgado" ? "Cuenta donde ingresa" : "Cuenta de donde sale"}
          className={inputCls}
          value={cuentaId}
          onChange={(e) => setCuentaId(e.target.value)}
        >
          <option value="">
            {prestamo.tipo === "otorgado" ? "Ingresa a…" : "Sale de…"}
          </option>
          <option value={SIN_CUENTA}>Sin mover una cuenta (ej: compra en tarjeta)</option>
          {cuentasElegibles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({c.moneda})
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          step="0.01"
          aria-label="Monto a devolver"
          className={inputCls}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder={`Monto (resta ${restante})`}
        />
        <input
          aria-label="Nota"
          className={inputCls}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota (opcional)"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          aria-label="Cotización del dólar hoy"
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
      {msg && (
        <p className={`mt-2 text-xs ${msg.ok ? "text-zinc-400" : "text-red-400"}`}>
          {msg.texto}
        </p>
      )}
    </Card>
  );
}

/** Historial de devoluciones de un préstamo, con "Deshacer" por si se cargó mal. */
function HistorialDevoluciones({
  prestamo,
  cuentas,
}: {
  prestamo: Prestamo;
  cuentas: Cuenta[];
}) {
  const devoluciones = prestamo.devoluciones ?? [];
  if (devoluciones.length === 0) return null;

  async function deshacer(indice: number) {
    if (prestamo.id == null) return;
    const d = devoluciones[indice];
    if (
      !window.confirm(
        `¿Deshacer la devolución de ${formatMoneda(d.monto, prestamo.moneda)}? ${d.transaccion_id != null ? "También se revierte el movimiento y el saldo de la cuenta." : ""}`,
      )
    ) {
      return;
    }
    await deshacerDevolucionPrestamo(prestamo.id, indice);
  }

  return (
    <ul className="mt-3 flex flex-col divide-y divide-line rounded-xl border border-line">
      {devoluciones.map((d, i) => {
        const cuenta = cuentas.find((c) => c.id === d.cuenta_id)?.nombre;
        return (
          <li key={`${d.fecha}-${i}`} className="flex items-center gap-3 px-3 py-1.5 text-xs">
            <span className="text-subtle">{formatFecha(d.fecha)}</span>
            <span className="font-medium tabular-nums text-zinc-200">
              {formatMoneda(d.monto, prestamo.moneda)}
            </span>
            <span className="min-w-0 flex-1 truncate text-subtle">
              {[d.nota, cuenta ?? (d.cuenta_id == null ? "sin mover cuenta" : null)]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <button
              type="button"
              onClick={() => deshacer(i)}
              className="min-h-9 shrink-0 rounded-lg px-2 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              Deshacer
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PrestamoDevueltoRow({
  prestamo,
  cuentas,
  onEditar,
}: {
  prestamo: Prestamo;
  cuentas: Cuenta[];
  onEditar: () => void;
}) {
  const vol = analizarVolatilidad(prestamo);

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-zinc-300">{prestamo.persona}</span>
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar préstamo de ${prestamo.persona}`}
          className="-m-1.5 grid size-11 place-items-center rounded-lg text-subtle transition-colors hover:bg-white/5 hover:text-zinc-100"
        >
          <Pencil size={14} aria-hidden />
        </button>
        <span className="text-subtle">
          {prestamo.tipo === "otorgado" ? "le presté" : "me prestó"}
        </span>
        {prestamo.fecha_devolucion && (
          <span className="text-xs text-subtle">
            devuelto {formatFecha(prestamo.fecha_devolucion)}
          </span>
        )}
        <span className="ml-auto tabular-nums text-zinc-400 line-through">
          {formatMoneda(prestamo.monto, prestamo.moneda)}
        </span>
        <span className="text-emerald-400">devuelto</span>
      </div>

      <HistorialDevoluciones prestamo={prestamo} cuentas={cuentas} />

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
        <p className="text-xs text-subtle">
          Sin cotizaciones cargadas — no se puede calcular el impacto cambiario.
        </p>
      )}
    </Card>
  );
}
