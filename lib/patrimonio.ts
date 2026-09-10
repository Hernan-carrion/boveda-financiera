import type { Cuenta, MetaAhorro, Moneda } from "./db";
import { convertir } from "./config";

/**
 * Consolidación de patrimonio multimoneda usando la cotización ARS/USD manual.
 * Funciones puras: reciben las cuentas y la cotización, devuelven totales.
 */

export interface PatrimonioConsolidado {
  moneda: Moneda;
  cotizacionUsd: number;
  totalARS: number;
  totalUSD: number;
  /** Todo convertido a `moneda`. */
  total: number;
}

export function consolidarPatrimonio(
  cuentas: Cuenta[],
  cotizacionUsd: number,
  moneda: Moneda = "ARS",
): PatrimonioConsolidado {
  const totalARS = cuentas
    .filter((c) => c.moneda === "ARS")
    .reduce((s, c) => s + (c.saldo || 0), 0);
  const totalUSD = cuentas
    .filter((c) => c.moneda === "USD")
    .reduce((s, c) => s + (c.saldo || 0), 0);

  const total =
    convertir(totalARS, "ARS", moneda, cotizacionUsd) +
    convertir(totalUSD, "USD", moneda, cotizacionUsd);

  return { moneda, cotizacionUsd, totalARS, totalUSD, total };
}

export interface ProgresoMeta {
  meta: MetaAhorro;
  actual: number;
  pct: number; // 0-100 (clamp)
  falta: number;
}

/**
 * Progreso de una meta de ahorro: consolida TODO el patrimonio (ARS + USD)
 * a la moneda de la meta y lo compara contra el objetivo.
 */
export function progresoMeta(
  meta: MetaAhorro,
  cuentas: Cuenta[],
  cotizacionUsd: number,
): ProgresoMeta {
  const { total } = consolidarPatrimonio(cuentas, cotizacionUsd, meta.moneda);
  const objetivo = meta.monto_objetivo > 0 ? meta.monto_objetivo : 0;
  const pctRaw = objetivo > 0 ? (total / objetivo) * 100 : 0;
  const pct = Math.max(0, Math.min(100, pctRaw));
  return {
    meta,
    actual: total,
    pct,
    falta: Math.max(0, objetivo - total),
  };
}
