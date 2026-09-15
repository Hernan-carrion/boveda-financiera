"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Wallet, Percent, Briefcase } from "lucide-react";
import { bovedaDB } from "@/lib/db";
import { CATEGORIA_COMISION, CATEGORIA_TRABAJO_INDEPENDIENTE } from "@/lib/categorizer";
import { getTarifasTurno } from "@/lib/config";
import { monthKey, formatMonthLabel } from "@/lib/historical";
import {
  diasDelMes,
  estimarSueldoMensual,
  mapaPorFecha,
  mesVecino,
  siguienteTurno,
  totalesDelMes,
} from "@/lib/sueldo";
import { marcarDiaTrabajado } from "@/lib/actions";
import { formatMoneda, cn } from "@/lib/utils";
import { Card, SectionTitle } from "@/components/ui";
import IngresoExtraButton from "@/components/IngresoExtraButton";

const NOMBRES_DIA = ["D", "L", "M", "M", "J", "V", "S"];

const colorCelda: Record<string, string> = {
  ninguno: "border-zinc-800 bg-zinc-900/40 text-zinc-500 hover:bg-zinc-800/60",
  medio: "border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25",
  completo:
    "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
};

export default function SueldoPage() {
  const [mes, setMes] = useState(() => monthKey());

  const tarifas = useLiveQuery(() => getTarifasTurno(), []);
  const diasTrabajados = useLiveQuery(
    () => bovedaDB.dias_trabajados.toArray(),
    [],
  );
  const cuentaMercadoPago = useLiveQuery(
    () => bovedaDB.cuentas.where("nombre").equals("Mercado Pago").first(),
    [],
  );
  const movimientosExtra = useLiveQuery(
    () =>
      bovedaDB.transacciones
        .where("categoria")
        .anyOf([CATEGORIA_COMISION, CATEGORIA_TRABAJO_INDEPENDIENTE])
        .toArray(),
    [],
  );

  const prefijoMes = `${mes.year}-${String(mes.month + 1).padStart(2, "0")}`;
  const diasDelMesActual = (diasTrabajados ?? []).filter((d) =>
    d.fecha.startsWith(prefijoMes),
  );
  const extraDelMesActual = (movimientosExtra ?? []).filter(
    (t) => !t.eliminado && t.fecha.startsWith(prefijoMes),
  );
  const monedaMercadoPago = cuentaMercadoPago?.moneda ?? "ARS";
  const totalComisiones = extraDelMesActual
    .filter((t) => t.categoria === CATEGORIA_COMISION)
    .reduce((s, t) => s + t.monto, 0);
  const totalTrabajoIndependiente = extraDelMesActual
    .filter((t) => t.categoria === CATEGORIA_TRABAJO_INDEPENDIENTE)
    .reduce((s, t) => s + t.monto, 0);


  const estimacion = tarifas ? estimarSueldoMensual(mes, tarifas) : null;
  const totales = totalesDelMes(diasDelMesActual);
  const mapa = mapaPorFecha(diasDelMesActual);
  const celdas = diasDelMes(mes);
  const relleno = celdas.length > 0 ? celdas[0].diaSemana : 0;

  async function tocarDia(fecha: string) {
    const actual = mapa.get(fecha)?.turno ?? "ninguno";
    await marcarDiaTrabajado(fecha, siguienteTurno(actual));
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Cuenta sueldo (referencia)</SectionTitle>
          <div className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/50 p-1">
            <button
              type="button"
              aria-label="Mes anterior"
              className="grid size-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
              onClick={() => setMes((m) => mesVecino(m, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm font-medium text-zinc-100">
              {formatMonthLabel(mes)}
            </span>
            <button
              type="button"
              aria-label="Mes siguiente"
              className="grid size-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
              onClick={() => setMes((m) => mesVecino(m, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <p className="mb-4 text-xs text-zinc-500">
          Es sólo una referencia de cuánto sueldo entra a Mercado Pago — no es
          una cuenta real, no mueve plata ni suma a tu patrimonio. Días
          laborales = lunes a sábado, sin descontar feriados.
        </p>

        {/* Estimación del mes */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Días laborales del mes
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">
              {estimacion ? estimacion.diasLaborales : "…"}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Estimado · todo medio turno
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">
              {estimacion ? formatMoneda(estimacion.totalMedioTurno, "ARS") : "…"}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Estimado · todo turno completo
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">
              {estimacion ? formatMoneda(estimacion.totalTurnoCompleto, "ARS") : "…"}
            </p>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle>Marcá los días trabajados</SectionTitle>
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded border border-zinc-800 bg-zinc-900/40" />
              Sin marcar
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded border border-amber-500/40 bg-amber-500/15" />
              Medio turno
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded border border-emerald-500/40 bg-emerald-500/15" />
              Turno completo
            </span>
            <span className="ml-auto text-zinc-500">Tocá un día para rotar</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-zinc-600">
            {NOMBRES_DIA.map((n, i) => (
              <div key={i} className="pb-1">
                {n}
              </div>
            ))}
            {Array.from({ length: relleno }).map((_, i) => (
              <div key={`relleno-${i}`} />
            ))}
            {celdas.map((c) => {
              const turno = mapa.get(c.fecha)?.turno ?? "ninguno";
              return (
                <button
                  key={c.fecha}
                  type="button"
                  onClick={() => tocarDia(c.fecha)}
                  disabled={!c.esLaboral}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors",
                    c.esLaboral
                      ? colorCelda[turno]
                      : "border-transparent bg-transparent text-zinc-700",
                  )}
                >
                  {c.numero}
                </button>
              );
            })}
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Total real de este mes</SectionTitle>
        <Card className="flex flex-wrap items-center gap-4">
          <Wallet size={18} className="text-emerald-400" />
          <div>
            <p className="text-2xl font-semibold tabular-nums text-zinc-50">
              {formatMoneda(totales.total, "ARS")}
            </p>
            <p className="text-xs text-zinc-500">
              {totales.diasTrabajados} días marcados · {totales.diasMedioTurno} medio
              turno · {totales.diasTurnoCompleto} turno completo
            </p>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Otros ingresos</SectionTitle>
        <p className="mb-3 text-xs text-zinc-500">
          Comisiones y trabajos independientes — plata real que entra a
          Mercado Pago, además del sueldo. El monto se carga a mano cada vez
          porque varía.
        </p>
        <Card className="flex flex-col gap-3">
          <IngresoExtraButton
            categoria={CATEGORIA_COMISION}
            label="Cobrar comisión"
            Icon={Percent}
          />
          <IngresoExtraButton
            categoria={CATEGORIA_TRABAJO_INDEPENDIENTE}
            label="Cobrar trabajo independiente"
            Icon={Briefcase}
          />
        </Card>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Comisiones este mes
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-50">
              {formatMoneda(totalComisiones, monedaMercadoPago)}
            </p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Trabajos independientes este mes
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-50">
              {formatMoneda(totalTrabajoIndependiente, monedaMercadoPago)}
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
