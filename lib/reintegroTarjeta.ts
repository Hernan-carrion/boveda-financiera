import type { DeudaTarjeta, Moneda, Suscripcion, Tarjeta } from "./db";

/**
 * Vista previa de cuánto hay que pagar de la tarjeta una vez descontadas las
 * suscripciones que otra persona reintegra (ver `Suscripcion.descuenta_de_
 * tarjeta`). Funciones puras: no tocan IndexedDB ni la red, y nada de lo que
 * calculan se guarda — es sólo para mostrar.
 */

export type MontosPorMoneda = Partial<Record<Moneda, number>>;

export interface FilaPreviewPago {
  /** "yyyy-MM" del resumen. */
  periodo: string;
  moneda: Moneda;
  /** Lo que falta pagar de los resúmenes de ese período (todas las tarjetas). */
  bruto: number;
  /** Suma mensual de las suscripciones que se descuentan (misma moneda). */
  descuento: number;
  /** `bruto - descuento`. Negativo = las suscripciones superan al resumen. */
  neto: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function suscripcionesDescontables(suscripciones: Suscripcion[]): Suscripcion[] {
  return suscripciones.filter(
    (s) => s.activa && !s.eliminado && s.descuenta_de_tarjeta === true,
  );
}

/** Cuánto suman por mes las suscripciones descontables, por moneda. */
export function descuentoMensualPorMoneda(descontables: Suscripcion[]): MontosPorMoneda {
  const out: MontosPorMoneda = {};
  for (const s of descontables) {
    out[s.moneda] = redondear((out[s.moneda] ?? 0) + Math.abs(s.monto));
  }
  return out;
}

/**
 * Una fila por período (y moneda) con saldo pendiente, ordenadas del más
 * próximo al más lejano. Se suman todas las tarjetas: la persona a la que se
 * le paga es una sola, así que el descuento mensual se aplica una vez por
 * período y no una vez por tarjeta. Los períodos ya pagados no aparecen.
 */
export function previewPagoTarjeta(
  deudas: DeudaTarjeta[],
  tarjetas: Tarjeta[],
  descuentoMensual: MontosPorMoneda,
): FilaPreviewPago[] {
  const monedaDeTarjeta = new Map<number, Moneda>();
  for (const t of tarjetas) if (t.id != null) monedaDeTarjeta.set(t.id, t.moneda);

  const pendiente = new Map<string, { periodo: string; moneda: Moneda; bruto: number }>();
  for (const d of deudas) {
    const moneda = monedaDeTarjeta.get(d.tarjeta_id);
    if (!moneda) continue;
    const falta = Math.max(0, d.monto_total - d.monto_pagado);
    if (falta < 0.005) continue;
    const clave = `${d.periodo}|${moneda}`;
    const fila = pendiente.get(clave) ?? { periodo: d.periodo, moneda, bruto: 0 };
    fila.bruto += falta;
    pendiente.set(clave, fila);
  }

  return [...pendiente.values()]
    .sort((a, b) => a.periodo.localeCompare(b.periodo) || a.moneda.localeCompare(b.moneda))
    .map((f) => {
      const bruto = redondear(f.bruto);
      const descuento = descuentoMensual[f.moneda] ?? 0;
      return { periodo: f.periodo, moneda: f.moneda, bruto, descuento, neto: redondear(bruto - descuento) };
    });
}
