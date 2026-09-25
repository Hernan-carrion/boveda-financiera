import { addMonths, addYears, differenceInCalendarDays, parseISO } from "date-fns";
import type { RepeticionRecordatorio } from "./db";

/**
 * Funciones puras para el módulo de recordatorios. No tocan IndexedDB ni la
 * red — reciben/devuelven datos planos.
 */

export const CATEGORIAS_RECORDATORIO = [
  "General",
  "Salud",
  "Documento",
  "Trámite",
  "Cumpleaños",
  "Hogar",
  "Trabajo",
] as const;

/** Tipos de documento comunes, para precargar el título del formulario. */
export const TIPOS_DOCUMENTO = [
  "DNI",
  "Pasaporte",
  "Licencia de conducir",
  "Seguro del auto",
  "VTV",
  "Otro",
] as const;

/** "yyyy-MM-dd" de hoy, en horario local. */
export function hoyISO(ref: Date = new Date()): string {
  const y = ref.getFullYear();
  const m = String(ref.getMonth() + 1).padStart(2, "0");
  const d = String(ref.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Días de diferencia entre `fecha` (yyyy-MM-dd) y hoy. Negativo = ya pasó. */
export function diasHasta(fecha: string, ref: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(fecha), parseISO(hoyISO(ref)));
}

/** Próxima ocurrencia de una fecha que se repite mensual o anualmente. */
export function proximaFecha(fecha: string, repetir: RepeticionRecordatorio): string {
  const base = parseISO(fecha);
  const siguiente = repetir === "mensual" ? addMonths(base, 1) : addYears(base, 1);
  return hoyISO(siguiente);
}

/**
 * Si `fecha` ya pasó y el recordatorio se repite, la empuja hacia adelante
 * las veces que haga falta hasta que quede en el futuro (por si la app
 * estuvo mucho tiempo sin abrirse). Si no se repite, la deja igual — queda
 * "vencida" hasta que alguien la edite o la borre.
 */
export function avanzarSiVencida(
  fecha: string,
  repetir: RepeticionRecordatorio,
  ref: Date = new Date(),
): string {
  if (repetir === "ninguna") return fecha;
  let actual = fecha;
  let guard = 0;
  while (diasHasta(actual, ref) < 0 && guard < 1000) {
    actual = proximaFecha(actual, repetir);
    guard += 1;
  }
  return actual;
}
