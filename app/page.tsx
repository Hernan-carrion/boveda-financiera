"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import {
  Wallet,
  Banknote,
  Smartphone,
  Landmark,
  Target,
  TrendingUp,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { bovedaDB, type Transaccion, type Moneda } from "@/lib/db";
import { getCotizacionUSD } from "@/lib/config";
import { consolidarPatrimonio } from "@/lib/patrimonio";
import { calcularAvances } from "@/lib/presupuestos";
import { getSaludFinanciera } from "@/lib/metrics";
import { formatMoneda, formatMonedaCompact, formatFecha, cn, periodoActual } from "@/lib/utils";
import QuickInput from "@/components/QuickInput";
import CobrarSueldoButton from "@/components/CobrarSueldoButton";
import EditarMovimientoModal from "@/components/EditarMovimientoModal";
import { ProgressBar, CircleProgress } from "@/components/ProgressBar";
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

const ICONO_TIPO_CUENTA: Record<string, LucideIcon> = {
  efectivo: Wallet,
  digital: Smartphone,
  banco: Landmark,
};

/**
 * Marcas del dial de la bóveda (hero) — 24 rayitas tipo combinación de caja
 * fuerte. Redondeadas a 2 decimales: sin esto, Math.cos/sin puede diferir en
 * el último dígito entre el render de servidor y el del cliente y React
 * marca un mismatch de hidratación.
 */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
const VAULT_TICKS = Array.from({ length: 24 }, (_, i) => {
  const angulo = (i / 24) * 2 * Math.PI;
  return {
    x1: round2(100 + 84 * Math.cos(angulo)),
    y1: round2(100 + 84 * Math.sin(angulo)),
    x2: round2(100 + 94 * Math.cos(angulo)),
    y2: round2(100 + 94 * Math.sin(angulo)),
  };
});

const REGLA_50_30_20 = [
  { key: "necesidad" as const, label: "Necesidades", target: 50, color: "#38bdf8" },
  { key: "deseo" as const, label: "Deseos", target: 30, color: "#fbbf24" },
  { key: "ahorro" as const, label: "Ahorro", target: 20, color: "#34d399" },
];

export default function DashboardPage() {
  const cuentas = useLiveQuery(
    () => bovedaDB.cuentas.orderBy("nombre").toArray(),
    [],
  );
  const cotizacion = useLiveQuery(() => getCotizacionUSD(), []);
  const presupuestos = useLiveQuery(() => bovedaDB.presupuestos.toArray(), []);
  const transacciones = useLiveQuery(
    () =>
      bovedaDB.transacciones
        .orderBy("fecha")
        .reverse()
        .filter((t) => !t.eliminado)
        .limit(12)
        .toArray(),
    [],
  );
  const txsMes = useLiveQuery(
    () => bovedaDB.transacciones.filter((t) => !t.eliminado).toArray(),
    [],
  );

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

  const salud = useMemo(
    () => getSaludFinanciera(txsMes ?? [], monedaHero),
    [txsMes, monedaHero],
  );

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
        <svg
          aria-hidden
          viewBox="0 0 200 200"
          className="vault-dial pointer-events-none absolute -right-14 -top-14 h-56 w-56 text-emerald-500/10 sm:h-72 sm:w-72"
        >
          <circle cx="100" cy="100" r="94" stroke="currentColor" strokeWidth="1" fill="none" />
          <circle cx="100" cy="100" r="66" stroke="currentColor" strokeWidth="1" fill="none" />
          <circle cx="100" cy="100" r="38" stroke="currentColor" strokeWidth="1" fill="none" />
          {VAULT_TICKS.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke="currentColor"
              strokeWidth="1.5"
            />
          ))}
        </svg>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-zinc-400">
              <TrendingUp size={15} />
              Patrimonio neto consolidado
            </p>
            <p
              className={cn(
                "mt-1 font-tech text-4xl font-semibold tabular-nums",
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
                "mt-2 font-tech text-2xl font-semibold tabular-nums",
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

      {/* Salud financiera — regla 50/30/20 */}
      <motion.section custom={1.5} initial="hidden" animate="show" variants={fadeUp}>
        <SectionTitle>Salud financiera · 50/30/20</SectionTitle>
        <p className="mb-4 text-xs text-zinc-500">
          Cómo se repartió lo que entró este mes en {monedaHero}: necesidades,
          deseos y lo que quedó de ahorro, contra el objetivo clásico 50/30/20.
        </p>
        {salud.ingresos <= 0 ? (
          <EmptyState>
            Todavía no registraste ingresos este mes en {monedaHero}.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {REGLA_50_30_20.map((r) => {
              const monto =
                r.key === "necesidad"
                  ? salud.necesidades
                  : r.key === "deseo"
                    ? salud.deseos
                    : salud.ahorro;
              const pct =
                r.key === "necesidad"
                  ? salud.pctNecesidades
                  : r.key === "deseo"
                    ? salud.pctDeseos
                    : salud.pctAhorro;
              const enLinea = r.key === "ahorro" ? pct >= r.target : pct <= r.target;
              const color = r.key === "ahorro" && monto < 0 ? "#f87171" : r.color;
              return (
                <div key={r.key} className={cn(bento, "flex flex-col items-center gap-3 text-center")}>
                  <CircleProgress pct={Math.max(0, pct)} size={100} stroke={10} color={color}>
                    <span className="font-tech text-lg font-semibold text-zinc-50">
                      {pct.toFixed(0)}%
                    </span>
                  </CircleProgress>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{r.label}</p>
                    <p className="font-tech text-xs tabular-nums text-zinc-400">
                      {formatMonedaCompact(monto, monedaHero)}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-[11px]",
                        enLinea ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      objetivo {r.target}% ·{" "}
                      {enLinea ? "en línea" : r.key === "ahorro" ? "por debajo" : "por encima"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.section>

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
          {(cuentas ?? []).map((cuenta) => {
            const Icono = ICONO_TIPO_CUENTA[cuenta.tipo] ?? Banknote;
            return (
              <div
                key={cuenta.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700"
              >
                <div className="flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-800/80 text-emerald-400">
                    <Icono size={15} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {cuenta.nombre}
                    </p>
                    <p className="text-xs capitalize text-zinc-500">{cuenta.tipo}</p>
                  </div>
                </div>
                <p
                  className={cn(
                    "font-tech text-sm font-semibold tabular-nums",
                    cuenta.saldo >= 0 ? "text-zinc-100" : "text-red-400",
                  )}
                >
                  {formatMoneda(cuenta.saldo, cuenta.moneda)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle>Acciones rápidas</SectionTitle>
        <div className="flex flex-col gap-3">
          <CobrarSueldoButton />
          <QuickInput />
        </div>
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
                        "font-tech text-sm font-semibold tabular-nums",
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

      <EditarMovimientoModal
        tx={editando}
        cuentas={cuentas ?? []}
        onClose={() => setEditando(null)}
      />
    </div>
  );
}
