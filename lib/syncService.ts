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
  "presupuestos",
  "suscripciones",
  "metas_ahorro",
  "configuracion",
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
      detail: pistaError(err),
      porTabla,
    };
  }
}

/** Traduce errores frecuentes a algo accionable. */
function pistaError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/row-level security/i.test(msg)) {
    return `${msg} — Falta correr el bloque de políticas RLS de supabase_sync_schema.sql en el SQL Editor de Supabase.`;
  }
  if (/Invalid path specified/i.test(msg)) {
    return `${msg} — NEXT_PUBLIC_SUPABASE_URL debe ser la Project URL (https://xxx.supabase.co), sin /rest/v1.`;
  }
  return msg;
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
      detail: pistaError(err),
      porTabla,
    };
  }
}

/* ============================================================================
 *  Sync resiliente: auto-pull al iniciar, cola offline y realtime (WebSocket)
 * ========================================================================== */

const COLA_KEY = "boveda_sync_pendiente";

function hayPushPendiente(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLA_KEY) === "1";
  } catch {
    return false;
  }
}

function marcarPushPendiente(pendiente: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (pendiente) window.localStorage.setItem(COLA_KEY, "1");
    else window.localStorage.removeItem(COLA_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}

/**
 * Push con cola offline: si falla por falta de red deja una marca en
 * localStorage y reintenta solo cuando vuelve la conexión (`online`).
 */
export async function pushConCola(): Promise<SyncResult> {
  if (!supabase) return SIN_CONFIG;

  const r = await pushToCloud();
  if (r.ok) {
    marcarPushPendiente(false);
    return r;
  }

  const offline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  const errorDeRed = /fetch|network|Failed to fetch|load failed/i.test(
    r.detail ?? r.message,
  );

  if (offline || errorDeRed) {
    marcarPushPendiente(true);
    return {
      ...r,
      message:
        "Sin conexión: los cambios quedaron en cola y se subirán al volver la red.",
    };
  }
  return r;
}

let autoSyncIniciado = false;
let canalRealtime: ReturnType<NonNullable<typeof supabase>["channel"]> | null =
  null;

/**
 * Arranca la sincronización automática:
 *  1. Pull inicial desde la nube.
 *  2. Reintento de la cola offline pendiente.
 *  3. Listener `online` para vaciar la cola cuando vuelve la red.
 *  4. Suscripción realtime (WebSocket) a cambios remotos → pull + callback.
 *
 * Es idempotente: llamarla varias veces no duplica listeners.
 */
export function startAutoSync(onRemoteChange?: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (!supabase) return () => {};
  if (autoSyncIniciado) return () => {};
  autoSyncIniciado = true;

  const cliente = supabase;

  // 1 + 2: pull inicial y drenaje de cola
  void pullFromCloud().then((r) => {
    if (r.ok) onRemoteChange?.();
  });
  if (hayPushPendiente()) void pushConCola();

  // 3: al recuperar conexión, subir lo pendiente
  const alVolverOnline = () => {
    if (hayPushPendiente()) void pushConCola();
  };
  window.addEventListener("online", alVolverOnline);

  // 4: realtime — cualquier cambio remoto dispara un pull
  let pullPendiente: ReturnType<typeof setTimeout> | null = null;
  const programarPull = () => {
    if (pullPendiente) clearTimeout(pullPendiente);
    pullPendiente = setTimeout(() => {
      void pullFromCloud().then((r) => {
        if (r.ok) onRemoteChange?.();
      });
    }, 400);
  };

  canalRealtime = cliente.channel("boveda-sync");
  for (const tabla of TABLAS) {
    canalRealtime.on(
      "postgres_changes",
      { event: "*", schema: "public", table: tabla },
      programarPull,
    );
  }
  canalRealtime.subscribe();

  // Cleanup
  return () => {
    window.removeEventListener("online", alVolverOnline);
    if (pullPendiente) clearTimeout(pullPendiente);
    if (canalRealtime) {
      void cliente.removeChannel(canalRealtime);
      canalRealtime = null;
    }
    autoSyncIniciado = false;
  };
}

export { hayPushPendiente };
