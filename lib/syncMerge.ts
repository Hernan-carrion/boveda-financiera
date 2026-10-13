/**
 * Reglas puras para reconciliar la base local (Dexie) con la nube (Supabase).
 * Sin imports ni acceso a red/IndexedDB, así se pueden probar en aislado
 * (`npm test`).
 *
 * Contexto: antes cada push subía TODAS las filas locales y cada pull pisaba
 * TODAS las filas locales. Un dispositivo desactualizado (ej: el celu que
 * estuvo en segundo plano) sobrescribía en la nube lo que otro dispositivo
 * había cargado después — así se perdió un cobro de sueldo en el saldo de
 * Mercado Pago. Ahora se compara fila por fila con `last_updated` y los
 * saldos se concilian por diferencia en vez de pisarse.
 */

export interface FilaSync {
  id?: number;
  last_updated?: string | null;
  [campo: string]: unknown;
}

/** `a` es estrictamente más nueva que `b`. Un timestamp ausente cuenta como el más viejo. */
export function esMasNueva(a?: string | null, b?: string | null): boolean {
  return (a ?? "") > (b ?? "");
}

/** Igualdad de contenido insensible al orden de las claves (para desempatar). */
export function filasIguales(a: FilaSync, b: FilaSync): boolean {
  const normalizar = (f: FilaSync) =>
    JSON.stringify(
      Object.keys(f)
        .filter((k) => f[k] !== undefined && f[k] !== null)
        .sort()
        .map((k) => [k, f[k]]),
    );
  return normalizar(a) === normalizar(b);
}

/**
 * Qué filas de la nube hay que aplicar localmente. Se aplica si la fila no
 * existe acá, si la de la nube es más nueva, o si hay empate de timestamp pero
 * el contenido difiere (una edición local siempre tiene un timestamp más
 * nuevo, así que un empate con contenido distinto es una escritura vieja sin
 * sellar: manda la nube, como siempre pasó).
 */
export function filasAPullear(
  locales: Map<number, FilaSync>,
  nube: FilaSync[],
  forzar = false,
): FilaSync[] {
  return nube.filter((n) => {
    if (n.id == null) return false;
    if (forzar) return true;
    const local = locales.get(n.id);
    if (!local) return true;
    if (esMasNueva(n.last_updated, local.last_updated)) return true;
    if (esMasNueva(local.last_updated, n.last_updated)) return false;
    return !filasIguales(local, n);
  });
}

/**
 * Qué filas locales hay que subir: las que no están en la nube o las que son
 * estrictamente más nuevas que la versión de la nube. Una fila vieja no pisa
 * a una más nueva.
 */
export function filasAPushear(
  locales: FilaSync[],
  nube: Map<number, string | null | undefined>,
): FilaSync[] {
  return locales.filter((l) => {
    if (l.id == null) return false;
    if (!nube.has(l.id)) return true;
    return esMasNueva(l.last_updated, nube.get(l.id));
  });
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export type AccionSaldo =
  /** Local y nube coinciden. */
  | "nada"
  /** Sólo cambió la nube: tomar el saldo de la nube. */
  | "bajar"
  /** Sólo cambió acá: subir el saldo local. */
  | "subir"
  /** Cambiaron los dos desde el último punto en común: se suman las diferencias. */
  | "ambos"
  /** No hay punto en común conocido: decidir por timestamp. */
  | "fecha";

/**
 * Concilia el saldo de una cuenta. `base` es el saldo que ambos lados tenían
 * la última vez que estuvieron de acuerdo. Si los dos lados lo movieron
 * (ej: un dispositivo cargó un sueldo y otro, desactualizado, editó un
 * gasto), el resultado es el saldo de la nube más lo que cambió acá — así
 * ninguno de los dos movimientos se pierde.
 */
export function resolverSaldo(
  local: number,
  nube: number,
  base: number | undefined,
): { saldo: number; accion: AccionSaldo } {
  if (redondear(local) === redondear(nube)) return { saldo: local, accion: "nada" };
  if (base === undefined) return { saldo: local, accion: "fecha" };

  const cambioLocal = redondear(local) !== redondear(base);
  const cambioNube = redondear(nube) !== redondear(base);

  if (!cambioLocal && cambioNube) return { saldo: nube, accion: "bajar" };
  if (cambioLocal && !cambioNube) return { saldo: local, accion: "subir" };
  return { saldo: redondear(nube + (local - base)), accion: "ambos" };
}
