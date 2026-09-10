"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { Wallet, Banknote, Target, TrendingUp, Pencil } from "lucide-react";
import { bovedaDB, type Transaccion, type Moneda } from "@/lib/db";
import { getCotizacionUSD } from "@/lib/config";
import { consolidarPatrimonio } from "@/lib/patrimonio";
import { calcularAvances } from "@/lib/presupuestos";
import { formatMoneda, formatMonedaCompact, formatFecha, cn, periodoActual } from "@/lib/utils";
import QuickInput from "@/components/QuickInput";
import EditarCategoriaModal from "@/components/EditarCategoriaModal";
import { ProgressBar } from "@/components/ProgressBar";
import { Card, SectionTitle, EmptyState } from "@/components/ui";

const bento =
  "rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" as const },
  }),
};

export default function DashboardPage() {
  const cuentas = useLiveQuery(
    () => bovedaDB.cuentas.orderBy("nombre").toArray(),
    [],
  );
  const cotizacion = useLiveQuery(() => getCotizacionUSD(), []);
  const presupuestos = useLiveQuery(() => bovedaDB.presupuestos.toArray(), []);
  const transacciones = useLiveQuery(
    () =>
      bovedaDB.transacciones.orderBy("fecha").reverse().limit(12).toArray(),
    [],
  );
  const txsMes = useLiveQuery(() => bovedaDB.transacciones.toArray(), []);

  const [monedaHero, setMonedaHero] = useState<Moneda>("ARS");
  const [editando, setEditando] = useState<Transaccion | null>(null);

  const cot = cotizacion ?? 1000;

  const patrimonio = useMemo(
    () => consolidarPatrimonio(cuentas ?? [], cot, monedaHero),
    [cuentas, cot, monedaHero],
  );

  const saldosPorMoneda = (cuentas ?? []).reduce<Record<string, number>>(
    (acc, c) => {
      acc[c.moneda] = (acc[c.moneda] ?? 0) + c.saldo;
      return acc;
    },
    {},
  );

  const avances = calcularAvances(
    presupuestos ?? [],
    txsMes ?? [],
    periodoActual(),
  ).slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      {/* HERO — Patrimonio Neto Consolidado */}
      <motion.section
        custom={0}
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900/80 to-zinc-950 p-6"
      >
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-zinc-400">
              <TrendingUp size={15} />
              Patrimonio neto consolidado
            </p>
            <p
              className={cn(
                "mt-1 font-display text-4xl font-semibold tabular-nums",
                patrimonio.total >= 0 ? "text-zinc-50" : "text-red-400",
              )}
            >
              {formatMoneda(patrimonio.total, monedaHero)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {formatMonedaCompact(patrimonio.totalARS, "ARS")} +{" "}
              {formatMonedaCompact(patrimonio.totalUSD, "USD")} · dólar a{" "}
              {formatMonedaCompact(cot, "ARS")}
            </p>
          </div>
          <div className="flex overflow-hidden rounded-lg border border-zinc-700 text-sm">
            {(["ARS", "USD"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMonedaHero(m)}
                className={cn(
                  "px-3 py-1.5 transition-colors",
                  monedaHero === m
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-300 hover:bg-zinc-800",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </motion.section>

      {/* BENTO GRID */}
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(saldosPorMoneda).map(([moneda, saldo], i) => (
          <motion.div
            key={moneda}
            custom={i + 1}
            initial="hidden"
            animate="show"
            variants={fadeUp}
            className={bento}
          >
            <div className="flex items-center gap-2 text-zinc-400">
              <Wallet size={16} />
              <span className="text-sm">Total {moneda}</span>
            </div>
            <p
              className={cn(
                "mt-2 text-2xl font-semibold tabular-nums",
                saldo >= 0 ? "text-zinc-50" : "text-red-400",
              )}
            >
              {formatMoneda(saldo, moneda as Moneda)}
            </p>
          </motion.div>
        ))}
        {cuentas !== undefined && Object.keys(saldosPorMoneda).length === 0 && (
          <Card className="text-sm text-zinc-500 md:col-span-3">
            No hay cuentas configuradas todavía.
          </Card>
        )}
      </div>

      {/* Presupuestos del mes */}
      <motion.section
        custom={2}
        initial="hidden"
        animate="show"
        variants={fadeUp}
      >
        <SectionTitle>Presupuestos del mes</SectionTitle>
        {avances.length === 0 ? (
          <EmptyState>
            Sin presupuestos este mes.{" "}
            <a href="/presupuestos" className="underline hover:text-zinc-300">
              Crear uno
            </a>
            .
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {avances.map((a) => (
              <div key={a.presupuesto.id} className={bento}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-zinc-200">
                    <Target size={14} className="text-zinc-500" />
                    {a.presupuesto.categoria}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums text-xs",
                      a.estado === "excedido"
                        ? "text-red-400"
                        : a.estado === "alerta"
                          ? "text-orange-400"
                          : "text-zinc-400",
                    )}
                  >
                    {a.pct.toFixed(0)}%
                  </span>
                </div>
                <ProgressBar pct={a.pct} estado={a.estado} />
                <p className="mt-1.5 text-xs text-zinc-500">
                  {formatMoneda(a.gastado, a.presupuesto.moneda)} de{" "}
                  {formatMoneda(a.presupuesto.monto_limite, a.presupuesto.moneda)}
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Cuentas */}
      <section>
        <SectionTitle>Cuentas</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {(cuentas ?? []).map((cuenta) => (
            <div
              key={cuenta.id}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="flex items-center gap-2">
                <Banknote size={16} className="text-zinc-500" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    {cuenta.nombre}
                  </p>
                  <p className="text-xs capitalize text-zinc-500">{cuenta.tipo}</p>
                </div>
              </div>
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  cuenta.saldo >= 0 ? "text-zinc-100" : "text-red-400",
                )}
              >
                {formatMoneda(cuenta.saldo, cuenta.moneda)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Carga rápida</SectionTitle>
        <QuickInput />
      </section>

      {/* Movimientos recientes — tap para editar categoría (modal glass) */}
      <section>
        <SectionTitle>Movimientos recientes</SectionTitle>
        {transacciones === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : transacciones.length === 0 ? (
          <EmptyState>Todavía no cargaste movimientos.</EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {transacciones.map((t) => {
              const positivo = t.tipo === "ingreso" || t.tipo === "devolucion";
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setEditando(t)}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 bg-zinc-900/40 px-4 py-3 text-left transition-colors hover:bg-zinc-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">
                        {t.descripcion || "(sin descripción)"}
                        {t.reintegrable && !t.reintegrado && (
                          <span className="ml-2 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
                            por cobrar
                          </span>
                        )}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                        {formatFecha(t.fecha)} · {t.categoria}
                        <Pencil size={11} className="text-zinc-600" />
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        positivo ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {positivo ? "+" : "−"}
                      {formatMoneda(t.monto, t.moneda)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <EditarCategoriaModal tx={editando} onClose={() => setEditando(null)} />
    </div>
  );
}
