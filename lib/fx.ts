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
  const cierre = p.cotizacion_cierre;
  if (!origen || !cierre || origen <= 0 || cierre <= 0) return null;

  const diferenciaBruta = p.monto * cierre - p.monto * origen;
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
