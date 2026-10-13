import type { Prestamo } from "./db";

/**
 * Análisis de volatilidad cambiaria de un préstamo devuelto.
 * Compara el valor del monto a la cotización de origen vs. la de cierre.
 */
export interface Volatilidad {
  origen: number;
  cierre: number;
  /** Fórmula del enunciado: (monto * cotizacion_cierre) - (monto * cotizacion_origen). */
  diferenciaBruta: number;
  /**
   * Impacto en el poder adquisitivo del usuario según su rol:
   * - otorgado (presté): un dólar más alto me perjudica → se invierte el signo.
   * - recibido (me prestaron): un dólar más alto me beneficia.
   */
  impacto: number;
  variacionPct: number;
  subioDolar: boolean;
  /** El movimiento del dólar favoreció al usuario. */
  aFavor: boolean;
}

export function analizarVolatilidad(p: Prestamo): Volatilidad | null {
  const origen = p.cotizacion_origen;
  if (!origen || origen <= 0) return null;

  // Con devoluciones parciales cada pago tiene su propia cotización: se
  // calcula pago por pago y `cierre` es el promedio ponderado por monto.
  const pagos = (p.devoluciones ?? []).filter((d) => d.cotizacion && d.cotizacion > 0);
  let cierre = p.cotizacion_cierre ?? 0;
  let montoBase = p.monto;
  if (pagos.length > 0) {
    montoBase = pagos.reduce((suma, d) => suma + d.monto, 0);
    cierre = pagos.reduce((suma, d) => suma + d.monto * (d.cotizacion as number), 0) / montoBase;
  }
  if (!cierre || cierre <= 0) return null;

  const diferenciaBruta = montoBase * cierre - montoBase * origen;
  const impacto = p.tipo === "otorgado" ? -diferenciaBruta : diferenciaBruta;
  const variacionPct = ((cierre - origen) / origen) * 100;

  return {
    origen,
    cierre,
    diferenciaBruta,
    impacto,
    variacionPct,
    subioDolar: cierre > origen,
    aFavor: impacto >= 0,
  };
}
