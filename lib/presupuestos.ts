import { startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import type { Presupuesto, Transaccion, Moneda } from "./db";
import { periodoActual } from "./utils";

/**
 * Cálculo puro del avance de presupuestos mensuales por categoría.
 * No toca IndexedDB ni la red.
 */

export interface AvancePresupuesto {
  presupuesto: Presupuesto;
  gastado: number;
  restante: number;
  /** 0-100+ (puede superar 100 si se pasó del límite). */
  pct: number;
  estado: "ok" | "alerta" | "excedido";
}

/** Color/estado según el % consumido: >100 rojo, >80 naranja, resto ok. */
export function estadoPorPct(pct: number): AvancePresupuesto["estado"] {
  if (pct > 100) return "excedido";
  if (pct > 80) return "alerta";
  return "ok";
}

function esEgresoComputable(t: Transaccion): boolean {
  // Los gastos reintegrables no cuentan como egreso neto.
  return t.tipo === "egreso" && !t.reintegrable;
}

function enMes(fechaISO: string, ref: Date): boolean {
  const d = new Date(fechaISO);
  if (Number.isNaN(d.getTime())) return false;
  return isWithinInterval(d, { start: startOfMonth(ref), end: endOfMonth(ref) });
}

/**
 * Cruza los presupuestos del mes `mes` ("yyyy-MM") con las transacciones para
 * devolver el avance de cada uno, ordenado por % consumido descendente.
 */
export function calcularAvances(
  presupuestos: Presupuesto[],
  transacciones: Transaccion[],
  mes: string = periodoActual(),
): AvancePresupuesto[] {
  const [y, m] = mes.split("-").map(Number);
  const ref = new Date(y, (m || 1) - 1, 15);

  return presupuestos
    .filter((p) => p.mes === mes)
    .map((p) => {
      const gastado = transacciones
        .filter(
          (t) =>
            esEgresoComputable(t) &&
            t.moneda === p.moneda &&
            (t.categoria || "Sin categoría") === p.categoria &&
            enMes(t.fecha, ref),
        )
        .reduce((s, t) => s + Math.abs(t.monto || 0), 0);

      const limite = p.monto_limite > 0 ? p.monto_limite : 0;
      const pct = limite > 0 ? (gastado / limite) * 100 : gastado > 0 ? 100 : 0;

      return {
        presupuesto: p,
        gastado,
        restante: limite - gastado,
        pct,
        estado: estadoPorPct(pct),
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

export function totalPresupuestado(
  presupuestos: Presupuesto[],
  mes: string,
  moneda: Moneda,
): number {
  return presupuestos
    .filter((p) => p.mes === mes && p.moneda === moneda)
    .reduce((s, p) => s + (p.monto_limite || 0), 0);
}
