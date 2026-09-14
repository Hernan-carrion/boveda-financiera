import { format, addMonths } from "date-fns";
import { monthKey, type MonthKey } from "./historical";
import type { DiaTrabajado, TipoTurno } from "./db";

/**
 * Cálculo puro para la "cuenta sueldo" de referencia: días laborales del mes
 * (lunes a sábado, sin descontar feriados — así lo pidió el usuario),
 * estimación mensual y totales reales a partir de lo marcado día a día.
 * No toca IndexedDB ni la red.
 */

/** Cantidad de días del mes (1-31). */
function diasDelMesNumero(key: MonthKey): number {
  return new Date(key.year, key.month + 1, 0).getDate();
}

/** Días laborales del mes: lunes a sábado (se excluye sólo el domingo). */
export function diasLaboralesDelMes(key: MonthKey): number {
  const total = diasDelMesNumero(key);
  let cuenta = 0;
  for (let d = 1; d <= total; d++) {
    if (new Date(key.year, key.month, d).getDay() !== 0) cuenta++;
  }
  return cuenta;
}

export interface EstimacionSueldo {
  diasLaborales: number;
  totalMedioTurno: number;
  totalTurnoCompleto: number;
}

/**
 * Proyección del mes: cuántos días laborales tiene y cuánto sumaría la
 * cuenta sueldo si se trabajara todos en medio turno, o todos en turno
 * completo. Útil sobre todo el día 1 del mes.
 */
export function estimarSueldoMensual(
  key: MonthKey,
  tarifas: { medio: number; completo: number },
): EstimacionSueldo {
  const diasLaborales = diasLaboralesDelMes(key);
  return {
    diasLaborales,
    totalMedioTurno: diasLaborales * tarifas.medio,
    totalTurnoCompleto: diasLaborales * tarifas.completo,
  };
}

export function mesVecino(key: MonthKey, delta: number): MonthKey {
  return monthKey(addMonths(new Date(key.year, key.month, 1), delta));
}

export interface DiaCalendario {
  numero: number;
  fecha: string; // "yyyy-MM-dd"
  diaSemana: number; // 0 (domingo) - 6 (sábado)
  esLaboral: boolean;
}

/** Todos los días del mes, con su día de semana, para pintar la grilla. */
export function diasDelMes(key: MonthKey): DiaCalendario[] {
  const total = diasDelMesNumero(key);
  const out: DiaCalendario[] = [];
  for (let d = 1; d <= total; d++) {
    const fecha = new Date(key.year, key.month, d);
    const diaSemana = fecha.getDay();
    out.push({
      numero: d,
      fecha: format(fecha, "yyyy-MM-dd"),
      diaSemana,
      esLaboral: diaSemana !== 0,
    });
  }
  return out;
}

/** Mapa fecha -> DiaTrabajado, para buscar O(1) al pintar la grilla. */
export function mapaPorFecha(
  dias: DiaTrabajado[],
): Map<string, DiaTrabajado> {
  return new Map(dias.map((d) => [d.fecha, d]));
}

export interface TotalesSueldoMes {
  diasTrabajados: number; // con turno !== "ninguno"
  diasMedioTurno: number;
  diasTurnoCompleto: number;
  total: number;
}

/** Suma real de lo marcado en el mes (a partir de `monto`, ya congelado por día). */
export function totalesDelMes(dias: DiaTrabajado[]): TotalesSueldoMes {
  let diasMedioTurno = 0;
  let diasTurnoCompleto = 0;
  let total = 0;
  for (const d of dias) {
    if (d.turno === "medio") diasMedioTurno++;
    else if (d.turno === "completo") diasTurnoCompleto++;
    else continue;
    total += d.monto || 0;
  }
  return {
    diasTrabajados: diasMedioTurno + diasTurnoCompleto,
    diasMedioTurno,
    diasTurnoCompleto,
    total,
  };
}

/** Siguiente estado al tocar un día: ninguno → medio → completo → ninguno. */
export function siguienteTurno(actual: TipoTurno): TipoTurno {
  if (actual === "ninguno") return "medio";
  if (actual === "medio") return "completo";
  return "ninguno";
}
