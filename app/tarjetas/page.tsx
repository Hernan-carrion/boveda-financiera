"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CreditCard, Layers, Plus } from "lucide-react";
import { bovedaDB, type Moneda } from "@/lib/db";
import { registrarCompraTarjeta, pagarDeudaTarjeta } from "@/lib/actions";
import { calcularProgresoCompra, montoPorCuota } from "@/lib/cuotas";
import { formatMoneda, periodoActual, cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ProgressBar";
import {
  Card,
  SectionTitle,
  Field,
  EmptyState,
  inputCls,
  btnCls,
  btnGhostCls,
} from "@/components/ui";

export default function TarjetasPage() {
  const tarjetas = useLiveQuery(() => bovedaDB.tarjetas.toArray(), []);
  const deudas = useLiveQuery(
    () => bovedaDB.deudas_tarjetas.orderBy("periodo").reverse().toArray(),
    [],
  );
  const compras = useLiveQuery(
    () => bovedaDB.compras_tarjeta.orderBy("fecha").reverse().toArray(),
    [],
  );
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.toArray(), []);

  const nombreTarjeta = (id: number) =>
    tarjetas?.find((t) => t.id === id)?.nombre ?? "Tarjeta";
  const monedaTarjeta = (id: number) =>
    tarjetas?.find((t) => t.id === id)?.moneda ?? "ARS";

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Nueva tarjeta</SectionTitle>
        <NuevaTarjetaForm />
      </section>

      <section>
        <SectionTitle>Tarjetas</SectionTitle>
        {tarjetas === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : tarjetas.length === 0 ? (
          <EmptyState>No registraste tarjetas.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tarjetas.map((t) => (
              <Card key={t.id}>
                <div className="flex items-center gap-2 text-zinc-200">
                  <CreditCard size={16} className="text-zinc-500" />
                  <span className="font-medium">{t.nombre}</span>
                  <span className="ml-auto text-xs text-zinc-500">{t.moneda}</span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-400">
                  <div>
                    <dt className="text-zinc-600">Cierre</dt>
                    <dd>día {t.dia_cierre}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Vencimiento</dt>
                    <dd>día {t.dia_vencimiento}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Límite</dt>
                    <dd>{formatMoneda(t.limite, t.moneda)}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Registrar compra</SectionTitle>
        <p className="mb-3 text-xs text-zinc-500">
          Elegí la cantidad de cuotas y el reparto se calcula solo: cada cuota
          se suma automáticamente al resumen del período que le corresponde,
          mes a mes, hasta cubrir el total.
        </p>
        <CompraForm tarjetas={tarjetas ?? []} />
      </section>

      <section>
        <SectionTitle>Compras en cuotas</SectionTitle>
        {compras === undefined || deudas === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : compras.length === 0 ? (
          <EmptyState>Todavía no registraste compras en cuotas.</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {compras.map((c) => {
              const deudasDeLaTarjeta = deudas.filter(
                (d) => d.tarjeta_id === c.tarjeta_id,
              );
              const progreso = calcularProgresoCompra(c, deudasDeLaTarjeta);
              return (
                <Card key={c.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Layers size={15} className="text-zinc-500" />
                    <span className="font-medium text-zinc-200">
                      {c.descripcion}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {nombreTarjeta(c.tarjeta_id)}
                    </span>
                    <span className="ml-auto tabular-nums text-zinc-300">
                      {formatMoneda(c.monto_total, c.moneda)} en {c.cuotas_totales}{" "}
                      {c.cuotas_totales === 1 ? "cuota" : "cuotas"}
                    </span>
                  </div>
                  <ProgressBar pct={progreso.pct} estado="ok" />
                  <div className="flex flex-wrap items-center justify-between text-xs text-zinc-500">
                    <span>
                      {progreso.finalizada
                        ? "Todas las cuotas pagadas ✓"
                        : `Cuota ${progreso.cuotasPagadas + 1} de ${progreso.cuotasTotales}`}
                    </span>
                    <span>
                      {formatMoneda(
                        montoPorCuota(c.monto_total, c.cuotas_totales),
                        c.moneda,
                      )}{" "}
                      por cuota
                      {progreso.proximoPeriodo && (
                        <> · próxima: {progreso.proximoPeriodo}</>
                      )}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>Resúmenes / deudas</SectionTitle>
        {deudas === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : deudas.length === 0 ? (
          <EmptyState>Sin deudas registradas.</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {deudas.map((d) => (
              <DeudaRow
                key={d.id}
                deuda={d}
                tarjetaNombre={nombreTarjeta(d.tarjeta_id)}
                moneda={monedaTarjeta(d.tarjeta_id)}
                cuentas={cuentas ?? []}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NuevaTarjetaForm() {
  const [nombre, setNombre] = useState("");
  const [cierre, setCierre] = useState("1");
  const [venc, setVenc] = useState("10");
  const [limite, setLimite] = useState("0");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setMsg("Poné un nombre.");
      return;
    }
    await bovedaDB.tarjetas.add({
      nombre: nombre.trim(),
      dia_cierre: Number(cierre) || 1,
      dia_vencimiento: Number(venc) || 1,
      limite: Number(limite) || 0,
      moneda,
    });
    setNombre("");
    setLimite("0");
    setMsg("Tarjeta agregada ✓");
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nombre">
          <input
            className={inputCls}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Visa Galicia"
          />
        </Field>
        <Field label="Día de cierre">
          <input
            type="number"
            min={1}
            max={31}
            className={inputCls}
            value={cierre}
            onChange={(e) => setCierre(e.target.value)}
          />
        </Field>
        <Field label="Día de vencimiento">
          <input
            type="number"
            min={1}
            max={31}
            className={inputCls}
            value={venc}
            onChange={(e) => setVenc(e.target.value)}
          />
        </Field>
        <Field label="Límite">
          <input
            type="number"
            min={0}
            className={inputCls}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
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
        <div className="flex items-end">
          <button type="submit" className={btnCls}>
            <Plus size={16} />
            Agregar
          </button>
        </div>
      </form>
      {msg && <p className="mt-3 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}

function CompraForm({
  tarjetas,
}: {
  tarjetas: { id?: number; nombre: string; moneda: Moneda }[];
}) {
  const [tarjetaId, setTarjetaId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [cuotas, setCuotas] = useState("1");
  const [periodoInicio, setPeriodoInicio] = useState(periodoActual());
  const [msg, setMsg] = useState<string | null>(null);

  const tarjetaSel = tarjetas.find((t) => String(t.id) === tarjetaId);
  const montoNum = Number(monto);
  const cuotasNum = Math.max(1, Math.floor(Number(cuotas)) || 1);
  const porCuota = montoNum > 0 ? montoPorCuota(montoNum, cuotasNum) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(tarjetaId);
    if (!id || !(montoNum > 0)) {
      setMsg("Elegí tarjeta y un monto válido.");
      return;
    }
    await registrarCompraTarjeta({
      tarjeta_id: id,
      descripcion: descripcion.trim() || "Compra",
      monto_total: montoNum,
      cuotas_totales: cuotasNum,
      moneda: tarjetaSel?.moneda ?? "ARS",
      periodo_inicio: periodoInicio || periodoActual(),
    });
    setDescripcion("");
    setMonto("");
    setCuotas("1");
    setMsg(
      cuotasNum > 1
        ? `Compra registrada ✓ — ${cuotasNum} cuotas de ${formatMoneda(porCuota, tarjetaSel?.moneda ?? "ARS")}`
        : "Compra registrada ✓",
    );
  }

  if (tarjetas.length === 0) {
    return <EmptyState>Primero creá una tarjeta.</EmptyState>;
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Tarjeta">
          <select
            className={inputCls}
            value={tarjetaId}
            onChange={(e) => setTarjetaId(e.target.value)}
          >
            <option value="">Elegir…</option>
            {tarjetas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descripción">
          <input
            className={inputCls}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Heladera, viaje, insumos…"
          />
        </Field>
        <Field label="Monto total">
          <input
            type="number"
            min={0}
            step="0.01"
            className={inputCls}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </Field>
        <Field label="Cantidad de cuotas">
          <input
            type="number"
            min={1}
            max={48}
            className={inputCls}
            value={cuotas}
            onChange={(e) => setCuotas(e.target.value)}
          />
        </Field>
        <Field label="Período de la 1ª cuota">
          <input
            type="month"
            className={inputCls}
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value || periodoActual())}
          />
        </Field>
        <div className="flex items-end">
          <button type="submit" className={btnCls}>
            <Plus size={16} />
            Registrar
          </button>
        </div>
      </form>

      {montoNum > 0 && cuotasNum > 1 && (
        <p className="mt-3 text-xs text-zinc-400">
          {cuotasNum} cuotas de{" "}
          <span className="font-medium text-zinc-200">
            {formatMoneda(porCuota, tarjetaSel?.moneda ?? "ARS")}
          </span>{" "}
          — la última ajusta el redondeo para que sume exacto.
        </p>
      )}
      {msg && <p className="mt-3 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}

function DeudaRow({
  deuda,
  tarjetaNombre,
  moneda,
  cuentas,
}: {
  deuda: {
    id?: number;
    periodo: string;
    monto_total: number;
    monto_pagado: number;
    estado: string;
  };
  tarjetaNombre: string;
  moneda: Moneda;
  cuentas: { id?: number; nombre: string; moneda: string }[];
}) {
  const [cuentaId, setCuentaId] = useState("");
  const [monto, setMonto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const restante = deuda.monto_total - deuda.monto_pagado;

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    const cid = Number(cuentaId);
    const m = Number(monto) || restante;
    if (!cid || m <= 0) {
      setMsg("Elegí cuenta y monto.");
      return;
    }
    if (deuda.id == null) return;
    await pagarDeudaTarjeta(deuda.id, cid, m);
    setMonto("");
    setMsg("Pago aplicado ✓");
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-zinc-200">{tarjetaNombre}</span>
        <span className="text-zinc-500">{deuda.periodo}</span>
        <span
          className={cn(
            deuda.estado === "pagada"
              ? "text-emerald-400"
              : deuda.estado === "parcial"
                ? "text-amber-400"
                : "text-red-400",
          )}
        >
          {deuda.estado}
        </span>
        <span className="ml-auto tabular-nums text-zinc-300">
          Pagado {formatMoneda(deuda.monto_pagado, moneda)} /{" "}
          {formatMoneda(deuda.monto_total, moneda)}
        </span>
      </div>

      {deuda.estado !== "pagada" && (
        <form
          onSubmit={pagar}
          className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        >
          <select
            className={inputCls}
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
          >
            <option value="">Pagar desde…</option>
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
            placeholder={`Restante ${restante}`}
          />
          <button type="submit" className={btnGhostCls}>
            Pagar
          </button>
        </form>
      )}
      {msg && <p className="mt-2 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}
