import { format, addMonths, addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { monthKey, type MonthKey } from "./historical";
import type { HabitoRegistro } from "./db";

/**
 * Cálculo puro para el módulo de hábitos: grilla del mes y racha actual a
 * partir de lo marcado. No toca IndexedDB ni la red.
 */

function diasDelMesNumero(key: MonthKey): number {
  return new Date(key.year, key.month + 1, 0).getDate();
}

export function mesVecino(key: MonthKey, delta: number): MonthKey {
  return monthKey(addMonths(new Date(key.year, key.month, 1), delta));
}

export interface DiaCalendarioHabito {
  numero: number;
  fecha: string; // "yyyy-MM-dd"
  diaSemana: number; // 0 (domingo) - 6 (sábado)
}

/** Todos los días del mes — a diferencia de la cuenta sueldo, acá se puede marcar cualquier día (incluido domingo). */
export function diasDelMes(key: MonthKey): DiaCalendarioHabito[] {
  const total = diasDelMesNumero(key);
  const out: DiaCalendarioHabito[] = [];
  for (let d = 1; d <= total; d++) {
    const fecha = new Date(key.year, key.month, d);
    out.push({ numero: d, fecha: format(fecha, "yyyy-MM-dd"), diaSemana: fecha.getDay() });
  }
  return out;
}

/** Mapa fecha -> registro, para buscar O(1) al pintar la grilla. */
export function mapaPorFecha(registros: HabitoRegistro[]): Map<string, HabitoRegistro> {
  return new Map(registros.map((r) => [r.fecha, r]));
}

/**
 * Racha actual: días consecutivos marcados contando hacia atrás desde hoy.
 * Si hoy todavía no se marcó, arranca a contar desde ayer — así la racha no
 * se "rompe" sólo por no haber abierto la app todavía en el día.
 */
export function calcularRacha(
  fechasMarcadas: Set<string>,
  hoy: Date = new Date(),
): number {
  let cursor = hoy;
  if (!fechasMarcadas.has(format(cursor, "yyyy-MM-dd"))) {
    cursor = addDays(cursor, -1);
  }
  let racha = 0;
  while (fechasMarcadas.has(format(cursor, "yyyy-MM-dd"))) {
    racha++;
    cursor = addDays(cursor, -1);
  }
  return racha;
}

/** Mejor racha histórica (la corrida consecutiva más larga en todo lo marcado). */
export function calcularMejorRacha(fechasMarcadas: string[]): number {
  if (fechasMarcadas.length === 0) return 0;
  const ordenadas = [...new Set(fechasMarcadas)].sort();
  let mejor = 1;
  let actual = 1;
  for (let i = 1; i < ordenadas.length; i++) {
    const dif = differenceInCalendarDays(parseISO(ordenadas[i]), parseISO(ordenadas[i - 1]));
    actual = dif === 1 ? actual + 1 : 1;
    mejor = Math.max(mejor, actual);
  }
  return mejor;
}
