import type { Prestamo } from "./db";

/**
 * Cuentas de un préstamo con devoluciones parciales. Funciones puras: no
 * tocan IndexedDB ni la red.
 */

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Cuánto ya se devolvió, en la moneda del préstamo. */
export function montoDevuelto(p: Prestamo): number {
  if (p.devoluciones && p.devoluciones.length > 0) {
    return redondear(p.devoluciones.reduce((suma, d) => suma + d.monto, 0));
  }
  // Anterior a las devoluciones parciales: abierto = nada, cualquier otro
  // estado ("devuelto", o "saldado" de filas viejas) = devuelto completo.
  return (p.estado as string) === "abierto" ? 0 : p.monto;
}

/** Cuánto falta devolver (nunca negativo). */
export function montoRestante(p: Prestamo): number {
  return Math.max(0, redondear(p.monto - montoDevuelto(p)));
}
