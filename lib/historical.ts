import {
  startOfMonth,
  endOfMonth,
  endOfDay,
  eachDayOfInterval,
  isAfter,
  addMonths,
  format,
} from "date-fns";
import { es } from "date-fns/locale";
import type { Cuenta, Transaccion, Inversion, Moneda } from "./db";

/**
 * Consolidación histórica mes a mes para la vista "Resúmenes mensuales".
 *
 * El patrimonio se reconstruye hacia atrás: net worth actual − Σ(deltas de las
 * transacciones posteriores a la fecha de corte). Los ajustes manuales de saldo
 * y los saldos iniciales de cuenta no llevan fecha, así que se consideran parte
 * de la línea de base (constante en el tiempo). Todo es local, sin red.
 */

export interface MonthKey {
  year: number;
  /** 0-11, como Date.getMonth() */
  month: number;
}

export interface HistoricalSummary {
  netWorthClose: number;
  netWorthOpen: number;
  ingresos: number;
  gastos: number;
  flujoLibre: number;
  tasaAhorro: number;
  movimientos: number;
  rendimientoInversiones: number;
}

export interface DailyPoint {
  dia: number;
  fecha: string;
  patrimonio: number;
}

function signo(tipo: Transaccion["tipo"]): number {
  return tipo === "ingreso" || tipo === "devolucion" ? 1 : -1;
}

const esIngreso = (t: Transaccion) =>
  (t.tipo === "ingreso" || t.tipo === "devolucion") &&
  t.categoria !== "Reintegros";
const esEgreso = (t: Transaccion) => t.tipo === "egreso" && !t.reintegrable;

function ts(fechaISO: string): number {
  const n = new Date(fechaISO).getTime();
  return Number.isNaN(n) ? 0 : n;
}

export function monthKey(d: Date = new Date()): MonthKey {
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function sameMonth(a: MonthKey, b: MonthKey): boolean {
  return a.year === b.year && a.month === b.month;
}

export function monthRange(key: MonthKey): { start: Date; end: Date } {
  const start = startOfMonth(new Date(key.year, key.month, 1));
  return { start, end: endOfMonth(start) };
}

export function formatMonthLabel(key: MonthKey): string {
  const label = format(new Date(key.year, key.month, 1), "MMMM yyyy", {
    locale: es,
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Suma de saldos actuales de las cuentas de una moneda. */
export function currentNetWorth(
  cuentas: Cuenta[],
  moneda: Moneda = "ARS",
): number {
  return cuentas
    .filter((c) => c.moneda === moneda)
    .reduce((sum, c) => sum + (c.saldo || 0), 0);
}

/** Patrimonio neto reconstruido al final del instante `at`. */
export function netWorthAt(
  cuentas: Cuenta[],
  transacciones: Transaccion[],
  at: Date,
  moneda: Moneda = "ARS",
): number {
  const current = currentNetWorth(cuentas, moneda);
  const corte = at.getTime();
  const posteriores = transacciones
    .filter((t) => t.moneda === moneda && ts(t.fecha) > corte)
    .reduce((sum, t) => sum + signo(t.tipo) * Math.abs(t.monto || 0), 0);
  return current - posteriores;
}

export function getHistoricalSummary(
  cuentas: Cuenta[],
  transacciones: Transaccion[],
  inversiones: Inversion[],
  key: MonthKey,
  moneda: Moneda = "ARS",
): HistoricalSummary {
  const { start, end } = monthRange(key);
  const startMs = start.getTime();
  const endMs = end.getTime();

  const delMes = transacciones.filter((t) => {
    if (t.moneda !== moneda) return false;
    const m = ts(t.fecha);
    return m >= startMs && m <= endMs;
  });

  const ingresos = delMes
    .filter(esIngreso)
    .reduce((s, t) => s + Math.abs(t.monto || 0), 0);
  const gastos = delMes
    .filter(esEgreso)
    .reduce((s, t) => s + Math.abs(t.monto || 0), 0);

  const flujoLibre = ingresos - gastos;
  const tasaAhorro = ingresos > 0 ? (flujoLibre / ingresos) * 100 : 0;

  const netWorthClose = netWorthAt(cuentas, transacciones, end, moneda);
  const netWorthOpen = netWorthAt(
    cuentas,
    transacciones,
    new Date(startMs - 1),
    moneda,
  );

  const rendimientoInversiones = inversiones
    .filter((i) => i.moneda === moneda && i.estado === "activa")
    .reduce((s, i) => s + (i.capital_inicial || 0), 0);

  return {
    netWorthClose,
    netWorthOpen,
    ingresos,
    gastos,
    flujoLibre,
    tasaAhorro,
    movimientos: delMes.length,
    rendimientoInversiones,
  };
}

/** Serie diaria de patrimonio para el gráfico de área. */
export function getDailyNetWorthSeries(
  cuentas: Cuenta[],
  transacciones: Transaccion[],
  key: MonthKey,
  moneda: Moneda = "ARS",
): DailyPoint[] {
  const { start, end } = monthRange(key);
  const cap = isAfter(end, new Date()) ? new Date() : end;
  if (isAfter(start, cap)) return [];

  return eachDayOfInterval({ start, end: cap }).map((d) => ({
    dia: d.getDate(),
    fecha: format(d, "yyyy-MM-dd"),
    patrimonio: netWorthAt(cuentas, transacciones, endOfDay(d), moneda),
  }));
}

/**
 * Meses navegables: desde el mes de la transacción más antigua hasta el mes
 * actual (siempre incluye el mes actual), de más viejo a más nuevo.
 */
export function getAvailableMonths(transacciones: Transaccion[]): MonthKey[] {
  const ahora = new Date();
  const tiempos = transacciones
    .map((t) => ts(t.fecha))
    .filter((n) => n > 0);

  const desde = startOfMonth(
    tiempos.length ? new Date(Math.min(...tiempos)) : ahora,
  );
  const hasta = startOfMonth(ahora);

  const meses: MonthKey[] = [];
  let cursor = desde;
  while (!isAfter(cursor, hasta)) {
    meses.push(monthKey(cursor));
    cursor = addMonths(cursor, 1);
  }
  return meses;
}
