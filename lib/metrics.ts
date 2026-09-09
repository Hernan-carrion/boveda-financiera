import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import type { Transaccion, Prestamo, Moneda } from "./db";

/**
 * Funciones puras de agregación para el dashboard de métricas.
 * Reciben los registros crudos de Dexie y devuelven data lista para Recharts.
 * No tocan IndexedDB ni la red.
 *
 * Nota multimoneda: sumar ARS + USD no tiene sentido, así que cada función
 * agrega una sola moneda (por defecto "ARS").
 */

export interface MonthlySummary {
  ingresos: number;
  egresos: number;
}

export interface CategoryDatum {
  name: string;
  value: number;
}

function fechaEnMes(fechaISO: string, ref: Date): boolean {
  const d = new Date(fechaISO);
  if (Number.isNaN(d.getTime())) return false;
  return isWithinInterval(d, { start: startOfMonth(ref), end: endOfMonth(ref) });
}

const ES_INGRESO = (t: Transaccion) =>
  t.tipo === "ingreso" || t.tipo === "devolucion";
const ES_EGRESO = (t: Transaccion) => t.tipo === "egreso";

/**
 * Total de ingresos y egresos de las transacciones del mes actual.
 */
export function getMonthlySummary(
  transacciones: Transaccion[],
  moneda: Moneda = "ARS",
  ref: Date = new Date(),
): MonthlySummary {
  const delMes = transacciones.filter(
    (t) => t.moneda === moneda && fechaEnMes(t.fecha, ref),
  );

  const ingresos = delMes
    .filter(ES_INGRESO)
    .reduce((sum, t) => sum + (t.monto || 0), 0);

  const egresos = delMes
    .filter(ES_EGRESO)
    .reduce((sum, t) => sum + (t.monto || 0), 0);

  return { ingresos, egresos };
}

/**
 * Agrupa los egresos del mes actual por `categoria` y suma los montos.
 * Devuelve `{ name, value }[]` ordenado de mayor a menor, listo para un PieChart.
 */
export function getExpensesByCategory(
  transacciones: Transaccion[],
  moneda: Moneda = "ARS",
  ref: Date = new Date(),
): CategoryDatum[] {
  const acumulado = new Map<string, number>();

  for (const t of transacciones) {
    if (t.moneda !== moneda) continue;
    if (!ES_EGRESO(t)) continue;
    if (!fechaEnMes(t.fecha, ref)) continue;

    const clave = t.categoria?.trim() || "Sin categoría";
    acumulado.set(clave, (acumulado.get(clave) ?? 0) + (t.monto || 0));
  }

  return Array.from(acumulado, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value,
  );
}

/**
 * Porcentaje de egresos sobre ingresos: `(egresos / ingresos) * 100`.
 * Si no hay ingresos: 100 cuando hubo egresos, 0 cuando no hubo nada.
 */
export function getExpenseToIncomeRatio(
  ingresos: number,
  egresos: number,
): number {
  if (!ingresos || ingresos <= 0) {
    return egresos > 0 ? 100 : 0;
  }
  return (egresos / ingresos) * 100;
}

/**
 * Tasa de devolución de préstamos:
 * `(monto de préstamos devueltos / monto total de préstamos) * 100`.
 * Se considera "devuelto" el estado "saldado" (o "devuelto", por compatibilidad).
 */
export function getLoanReturnRate(prestamos: Prestamo[]): number {
  const total = prestamos.reduce((sum, p) => sum + (p.monto || 0), 0);
  if (total <= 0) return 0;

  const devueltos = prestamos
    .filter((p) => {
      const estado = p.estado as string;
      return estado === "saldado" || estado === "devuelto";
    })
    .reduce((sum, p) => sum + (p.monto || 0), 0);

  return (devueltos / total) * 100;
}
