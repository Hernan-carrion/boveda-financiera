"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { HandCoins } from "lucide-react";
import { bovedaDB, type Moneda, type TipoPrestamo } from "@/lib/db";
import {
  registrarPrestamo,
  registrarDevolucionPrestamo,
} from "@/lib/actions";
import { formatMoneda, formatFecha } from "@/lib/utils";
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
  const saldados = (prestamos ?? []).filter((p) => p.estado === "saldado");

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

      {saldados.length > 0 && (
        <section>
          <SectionTitle>Saldados</SectionTitle>
          <div className="flex flex-col gap-2">
            {saldados.map((p) => (
              <Card key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium text-zinc-300">{p.persona}</span>
                <span className="text-zinc-500">
                  {p.tipo === "otorgado" ? "le presté" : "me prestó"}
                </span>
                <span className="ml-auto tabular-nums text-zinc-400 line-through">
                  {formatMoneda(p.monto, p.moneda)}
                </span>
                <span className="text-emerald-400">saldado</span>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NuevoPrestamoForm({
  cuentas,
}: {
  cuentas: { id?: number; nombre: string; moneda: string }[];
}) {
  const [persona, setPersona] = useState("");
  const [tipo, setTipo] = useState<TipoPrestamo>("otorgado");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [cuentaId, setCuentaId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const m = Number(monto);
    const cid = Number(cuentaId);
    if (!persona.trim() || !m || m <= 0 || !cid) {
      setMsg("Completá persona, monto y cuenta.");
      return;
    }
    await registrarPrestamo({
      persona: persona.trim(),
      tipo,
      monto: m,
      moneda,
      cuenta_id: cid,
    });
    setPersona("");
    setMonto("");
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
  prestamo: {
    id?: number;
    persona: string;
    tipo: TipoPrestamo;
    monto: number;
    moneda: Moneda;
    fecha_prestamo: string;
  };
  cuentas: { id?: number; nombre: string; moneda: string }[];
}) {
  const [cuentaId, setCuentaId] = useState("");
  const [monto, setMonto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function devolver(e: React.FormEvent) {
    e.preventDefault();
    const cid = Number(cuentaId);
    const m = Number(monto) || prestamo.monto;
    if (!cid || m <= 0) {
      setMsg("Elegí la cuenta.");
      return;
    }
    if (prestamo.id == null) return;
    await registrarDevolucionPrestamo(prestamo.id, cid, m);
    setMsg("Devolución registrada ✓");
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-zinc-200">{prestamo.persona}</span>
        <span className="text-zinc-500">
          {prestamo.tipo === "otorgado" ? "le presté" : "me prestó"}
        </span>
        <span className="text-zinc-500">{formatFecha(prestamo.fecha_prestamo)}</span>
        <span className="ml-auto tabular-nums font-semibold text-zinc-100">
          {formatMoneda(prestamo.monto, prestamo.moneda)}
        </span>
      </div>

      <form onSubmit={devolver} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
        <button type="submit" className={btnGhostCls}>
          Registrar devolución
        </button>
      </form>
      {msg && <p className="mt-2 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}
