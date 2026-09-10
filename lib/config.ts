import { bovedaDB, CLAVE_COTIZACION_USD, type Moneda } from "./db";

/**
 * Acceso a la tabla `configuracion` (pares clave/valor en IndexedDB).
 * Se usa sobre todo para la cotización ARS/USD que el usuario carga a mano,
 * ya que la app no consulta ninguna API de cambio.
 */

export const COTIZACION_USD_DEFAULT = 1000;

export async function getConfig(clave: string): Promise<string | undefined> {
  const row = await bovedaDB.configuracion.where("clave").equals(clave).first();
  return row?.valor;
}

export async function setConfig(clave: string, valor: string): Promise<void> {
  const row = await bovedaDB.configuracion.where("clave").equals(clave).first();
  if (row?.id != null) {
    await bovedaDB.configuracion.update(row.id, {
      valor,
      last_updated: new Date().toISOString(),
    });
  } else {
    await bovedaDB.configuracion.add({
      clave,
      valor,
      last_updated: new Date().toISOString(),
    });
  }
}

/** Cotización ARS por 1 USD. Nunca devuelve 0 / NaN. */
export async function getCotizacionUSD(): Promise<number> {
  const raw = await getConfig(CLAVE_COTIZACION_USD);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : COTIZACION_USD_DEFAULT;
}

export async function setCotizacionUSD(valor: number): Promise<void> {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("La cotización debe ser un número mayor a 0.");
  }
  await setConfig(CLAVE_COTIZACION_USD, String(n));
}

/**
 * Convierte un monto de su moneda a la moneda objetivo usando la cotización
 * ARS/USD provista (ARS por 1 USD).
 */
export function convertir(
  monto: number,
  desde: Moneda,
  hacia: Moneda,
  cotizacionUsd: number,
): number {
  if (desde === hacia) return monto;
  const cot = cotizacionUsd > 0 ? cotizacionUsd : COTIZACION_USD_DEFAULT;
  return desde === "USD" ? monto * cot : monto / cot;
}
