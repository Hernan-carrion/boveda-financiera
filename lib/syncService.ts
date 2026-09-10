import { bovedaDB } from "./db";
import { supabase } from "./supabase";

/**
 * Motor de sincronización entre IndexedDB (Dexie) y Supabase.
 *
 * Modelo simple de un solo usuario: el `id` autoincremental local se usa como
 * clave primaria en Supabase, así `upsert` inserta o actualiza por `id`.
 * `last_updated` viaja en cada fila para poder resolver conflictos por fecha
 * más adelante (eventual consistency).
 */

const TABLAS = [
  "cuentas",
  "transacciones",
  "tarjetas",
  "deudas_tarjetas",
  "inversiones",
  "prestamos",
] as const;

export type TablaSync = (typeof TABLAS)[number];

export interface SyncResult {
  ok: boolean;
  message: string;
  detail?: string;
  porTabla?: Record<string, number>;
}

const SIN_CONFIG: SyncResult = {
  ok: false,
  message:
    "Falta configurar Supabase. Definí NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.",
};

/**
 * Sube todos los registros locales a Supabase con `upsert` (insert or update).
 * Cada tabla se sube en una sola llamada, que es atómica del lado de Supabase.
 */
export async function pushToCloud(): Promise<SyncResult> {
  if (!supabase) return SIN_CONFIG;

  const porTabla: Record<string, number> = {};
  try {
    const now = new Date().toISOString();

    for (const tabla of TABLAS) {
      const filas = await bovedaDB.table(tabla).toArray();
      if (filas.length === 0) {
        porTabla[tabla] = 0;
        continue;
      }

      const conSello = filas.map((f) => ({
        ...f,
        last_updated: f.last_updated ?? now,
      }));

      const { error } = await supabase
        .from(tabla)
        .upsert(conSello, { onConflict: "id" });
      if (error) throw new Error(`[${tabla}] ${error.message}`);

      porTabla[tabla] = conSello.length;
    }

    return {
      ok: true,
      message: "Sincronizado correctamente (subida a la nube).",
      porTabla,
    };
  } catch (err) {
    return {
      ok: false,
      message: "Error al subir a la nube.",
      detail: err instanceof Error ? err.message : String(err),
      porTabla,
    };
  }
}

/**
 * Descarga todos los registros de Supabase y los aplica localmente con
 * `bulkPut` de Dexie (inserta o reemplaza por clave primaria).
 */
export async function pullFromCloud(): Promise<SyncResult> {
  if (!supabase) return SIN_CONFIG;

  const porTabla: Record<string, number> = {};
  try {
    for (const tabla of TABLAS) {
      const { data, error } = await supabase.from(tabla).select("*");
      if (error) throw new Error(`[${tabla}] ${error.message}`);

      const filas = data ?? [];
      if (filas.length > 0) {
        await bovedaDB.table(tabla).bulkPut(filas as never[]);
      }
      porTabla[tabla] = filas.length;
    }

    return {
      ok: true,
      message: "Sincronizado correctamente (descarga desde la nube).",
      porTabla,
    };
  } catch (err) {
    return {
      ok: false,
      message: "Error al descargar de la nube.",
      detail: err instanceof Error ? err.message : String(err),
      porTabla,
    };
  }
}
