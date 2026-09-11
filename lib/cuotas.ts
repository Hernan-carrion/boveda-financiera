import { addMonths, format } from "date-fns";
import type { CompraTarjeta, DeudaTarjeta } from "./db";

/**
 * Reparto puro de una compra en cuotas a lo largo de los períodos ("yyyy-MM")
 * de la tarjeta. No toca IndexedDB ni la red.
 *
 * El monto se divide en partes iguales (redondeadas a centavos); la última
 * cuota absorbe el resto del redondeo para que la suma cierre exacto con
 * `montoTotal`.
 */

export interface CuotaSlice {
  /** 1-based: cuota 1 de N, cuota 2 de N, etc. */
  numero: number;
  periodo: string; // "yyyy-MM"
  monto: number;
}

function parsePeriodo(periodo: string): Date {
  const [y, m] = periodo.split("-").map(Number);
  return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
}

export function calcularCuotas(
  montoTotal: number,
  cuotasTotales: number,
  periodoInicio: string,
): CuotaSlice[] {
  const n = Math.max(1, Math.floor(cuotasTotales) || 1);
  const base = Math.floor((montoTotal / n) * 100) / 100;
  const inicio = parsePeriodo(periodoInicio);

  const slices: CuotaSlice[] = [];
  let acumulado = 0;
  for (let i = 0; i < n; i++) {
    const esUltima = i === n - 1;
    const monto = esUltima
      ? Math.round((montoTotal - acumulado) * 100) / 100
      : base;
    acumulado += monto;
    slices.push({
      numero: i + 1,
      periodo: format(addMonths(inicio, i), "yyyy-MM"),
      monto,
    });
  }
  return slices;
}

/** Monto de una cuota individual (para la vista previa del formulario). */
export function montoPorCuota(montoTotal: number, cuotasTotales: number): number {
  const n = Math.max(1, Math.floor(cuotasTotales) || 1);
  return montoTotal / n;
}

export interface ProgresoCompra {
  compra: CompraTarjeta;
  cuotasPagadas: number;
  cuotasTotales: number;
  pct: number;
  finalizada: boolean;
  /** Primer período ("yyyy-MM") con una cuota todavía sin pagar, si queda alguna. */
  proximoPeriodo: string | null;
}

/**
 * Cruza el plan de cuotas de una compra con el estado real de
 * `deudas_tarjetas` para saber cuántas cuotas ya están pagas. Una cuota
 * cuenta como pagada cuando el resumen de ESE período quedó en "pagada"
 * (el pago es por período, no por compra individual).
 */
export function calcularProgresoCompra(
  compra: CompraTarjeta,
  deudasDeLaTarjeta: DeudaTarjeta[],
): ProgresoCompra {
  const slices = calcularCuotas(
    compra.monto_total,
    compra.cuotas_totales,
    compra.periodo_inicio,
  );

  let cuotasPagadas = 0;
  let proximoPeriodo: string | null = null;
  for (const slice of slices) {
    const deuda = deudasDeLaTarjeta.find((d) => d.periodo === slice.periodo);
    if (deuda?.estado === "pagada") {
      cuotasPagadas += 1;
    } else if (proximoPeriodo === null) {
      proximoPeriodo = slice.periodo;
    }
  }

  const cuotasTotales = slices.length;
  return {
    compra,
    cuotasPagadas,
    cuotasTotales,
    pct: cuotasTotales > 0 ? (cuotasPagadas / cuotasTotales) * 100 : 0,
    finalizada: cuotasPagadas >= cuotasTotales,
    proximoPeriodo,
  };
}
