import { bovedaDB, onEscrituraLocal } from "./db";
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
  "compras_tarjeta",
  "dias_trabajados",
  "proyectos",
  "tareas",
  "recordatorios",
  "notas",
  "habitos",
  "habito_registros",
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
 * Cada tabla se sube por separado y una que falle (ej: todavía no corriste el
 * schema SQL más nuevo) no frena a las demás — mejor sincronizar lo que se
 * pueda que no sincronizar nada.
 */
export async function pushToCloud(): Promise<SyncResult> {
  if (!supabase) return SIN_CONFIG;

  const porTabla: Record<string, number> = {};
  const errores: string[] = [];
  const now = new Date().toISOString();

  for (const tabla of TABLAS) {
    try {
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
    } catch (err) {
      errores.push(pistaError(err));
    }
  }

  if (errores.length === 0) {
    return {
      ok: true,
      message: "Sincronizado correctamente (subida a la nube).",
      porTabla,
    };
  }
  return {
    ok: false,
    message: `Subida parcial: fallaron ${errores.length} de ${TABLAS.length} tablas.`,
    detail: errores.join(" · "),
    porTabla,
  };
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
  if (/could not find the table|schema cache/i.test(msg)) {
    return `${msg} — Correspondé a una tabla nueva de la app: corré (o volvé a correr) supabase_sync_schema.sql completo en el SQL Editor de Supabase.`;
  }
  return msg;
}

/**
 * true mientras `pullFromCloud` está escribiendo localmente lo que bajó de
 * Supabase. El auto-push (ver más abajo) lo respeta para no re-subir en el
 * acto los mismos datos que se acaban de traer.
 */
let aplicandoCambiosRemotos = false;

/**
 * Descarga todos los registros de Supabase y los aplica localmente con
 * `bulkPut` de Dexie (inserta o reemplaza por clave primaria). Igual que
 * `pushToCloud`, una tabla que falle no frena la descarga de las demás.
 */
export async function pullFromCloud(): Promise<SyncResult> {
  if (!supabase) return SIN_CONFIG;

  const porTabla: Record<string, number> = {};
  const errores: string[] = [];
  aplicandoCambiosRemotos = true;
  try {
    for (const tabla of TABLAS) {
      try {
        const { data, error } = await supabase.from(tabla).select("*");
        if (error) throw new Error(`[${tabla}] ${error.message}`);

        const filas = data ?? [];
        if (filas.length > 0) {
          await bovedaDB.table(tabla).bulkPut(filas as never[]);
        }
        porTabla[tabla] = filas.length;
      } catch (err) {
        errores.push(pistaError(err));
      }
    }

    if (errores.length === 0) {
      return {
        ok: true,
        message: "Sincronizado correctamente (descarga desde la nube).",
        porTabla,
      };
    }
    return {
      ok: false,
      message: `Descarga parcial: fallaron ${errores.length} de ${TABLAS.length} tablas.`,
      detail: errores.join(" · "),
      porTabla,
    };
  } finally {
    aplicandoCambiosRemotos = false;
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
 *  1. Reintento de la cola offline pendiente.
 *  2. Listener `online` para vaciar la cola cuando vuelve la red.
 *  3. Suscripción realtime (WebSocket) a cambios remotos → pull + callback.
 *  4. Auto-push en tiempo real: cualquier escritura local (de cualquier
 *     tabla, sea por una acción de `lib/actions.ts` o un CRUD directo de una
 *     página) dispara un push a los pocos milisegundos, sin que el usuario
 *     tenga que tocar el botón "Subir a la nube".
 *
 * OJO: a propósito NO hace un pull inicial acá — eso le toca al que llama,
 * y tiene que esperarlo (`await pullFromCloud()`) ANTES de generar cualquier
 * escritura local propia (ej. cobrar una suscripción vencida al abrir la
 * app). Si el pull inicial corriera en paralelo con esa escritura, `bulkPut`
 * puede pisarla con el estado viejo de la nube antes de que el auto-push
 * llegue a subirla — eso hacía que una suscripción se cobrara de nuevo en
 * cada apertura de la app (el `ultimo_cobro_periodo` volvía atrás) y que el
 * descuento del saldo de la cuenta desapareciera del patrimonio.
 *
 * Es idempotente: llamarla varias veces no duplica listeners.
 */
export function startAutoSync(
  onRemoteChange?: () => void,
  onAutoPushResult?: (r: SyncResult) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  if (!supabase) return () => {};
  if (autoSyncIniciado) return () => {};
  autoSyncIniciado = true;

  const cliente = supabase;

  // 1: drenaje de la cola offline pendiente de una sesión anterior
  if (hayPushPendiente()) void pushConCola();

  // 2: al recuperar conexión, subir lo pendiente
  const alVolverOnline = () => {
    if (hayPushPendiente()) void pushConCola();
  };
  window.addEventListener("online", alVolverOnline);

  // 3: realtime — cualquier cambio remoto dispara un pull
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

  // 4: auto-push — cualquier escritura local dispara un push (con un
  // pequeño debounce para agrupar ráfagas de escrituras, ej. cargar varios
  // movimientos seguidos, sin pisar la cola offline si estamos sin red).
  let autoPushPendiente: ReturnType<typeof setTimeout> | null = null;
  const programarAutoPush = () => {
    if (aplicandoCambiosRemotos) return; // esto vino de un pull, no de mí
    if (autoPushPendiente) clearTimeout(autoPushPendiente);
    autoPushPendiente = setTimeout(() => {
      void pushConCola().then((r) => onAutoPushResult?.(r));
    }, 700);
  };
  const quitarListenerEscritura = onEscrituraLocal(programarAutoPush);

  // Cleanup
  return () => {
    window.removeEventListener("online", alVolverOnline);
    if (pullPendiente) clearTimeout(pullPendiente);
    if (autoPushPendiente) clearTimeout(autoPushPendiente);
    quitarListenerEscritura();
    if (canalRealtime) {
      void cliente.removeChannel(canalRealtime);
      canalRealtime = null;
    }
    autoSyncIniciado = false;
  };
}

export { hayPushPendiente };
