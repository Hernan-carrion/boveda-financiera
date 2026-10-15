import type { Table } from "dexie";
import { bovedaDB, marcarTransaccionRemota, onEscrituraLocal } from "./db";
import { supabase as supabaseReal } from "./supabase";
import {
  esMasNueva,
  filasAPullear,
  filasAPushear,
  resolverSaldo,
  type FilaSync,
} from "./syncMerge";

/**
 * Motor de sincronización entre IndexedDB (Dexie) y Supabase.
 *
 * Modelo simple de un solo usuario: el `id` autoincremental local se usa como
 * clave primaria en Supabase, así `upsert` inserta o actualiza por `id`.
 *
 * Reconciliación fila por fila con `last_updated` (lo sella solo cada
 * escritura local, ver lib/db.ts): un push sólo sube las filas más nuevas que
 * las de la nube y un pull sólo aplica las más nuevas que las locales. Así un
 * dispositivo desactualizado ya no pisa lo que otro cargó después. Los saldos
 * de las cuentas son la excepción: si dos dispositivos los movieron, se
 * concilian sumando las diferencias (ver `resolverSaldo`).
 *
 * Limitaciones conocidas: la comparación usa el reloj de cada dispositivo, y
 * dos dispositivos que creen filas sin conexión pueden generar el mismo `id`.
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

// Cliente de la nube. Es un `let` sólo para que los tests puedan reemplazarlo
// por una nube falsa (ver lib/syncService.test.ts); en la app nunca cambia.
let supabase = supabaseReal;

export function __usarSupabaseDePrueba(cliente: unknown): void {
  supabase = cliente as typeof supabaseReal;
}

export interface SyncResult {
  ok: boolean;
  message: string;
  detail?: string;
  porTabla?: Record<string, number>;
  /** Saldos que se movieron en dos dispositivos a la vez y se conciliaron. */
  conflictos?: number;
}

const SIN_CONFIG: SyncResult = {
  ok: false,
  message:
    "Falta configurar Supabase. Definí NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.",
};

/* ----------------------------- Saldo base ----------------------------- */

/**
 * Último saldo en el que este dispositivo y la nube estuvieron de acuerdo,
 * por cuenta. Es el punto en común que permite sumar las diferencias cuando
 * los dos lados movieron el saldo. Vive en localStorage (es por dispositivo).
 */
const BASE_KEY = "boveda_sync_saldo_base";
type Bases = Record<string, number>;

function leerBases(): Bases {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(BASE_KEY) ?? "{}") as Bases;
  } catch {
    return {};
  }
}

function guardarBases(bases: Bases): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BASE_KEY, JSON.stringify(bases));
  } catch {
    /* almacenamiento no disponible: se vuelve a decidir por fecha */
  }
}

/* ------------------------------- Lectura ------------------------------ */

/** Lee una tabla entera de la nube, paginando (PostgREST corta en 1000 filas). */
async function leerNube(tabla: string, columnas: string): Promise<FilaSync[]> {
  if (!supabase) return [];
  const PAGINA = 1000;
  const filas: FilaSync[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from(tabla)
      .select(columnas)
      .order("id")
      .range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`[${tabla}] ${error.message}`);
    const pagina = (data ?? []) as unknown as FilaSync[];
    filas.push(...pagina);
    if (pagina.length < PAGINA) break;
  }
  return filas;
}

/* -------------------------------- Push -------------------------------- */

/**
 * Sube las filas con un solo upsert; si falla (ej: una fila choca con una
 * restricción única de la nube) reintenta fila por fila para que una sola
 * fila mala no frene a las demás de la tabla.
 */
async function subirFilas(
  tabla: string,
  filas: FilaSync[],
): Promise<{ subidas: FilaSync[]; falla?: string }> {
  if (!supabase) return { subidas: [] };
  const lote = await supabase.from(tabla).upsert(filas, { onConflict: "id" });
  if (!lote.error) return { subidas: filas };
  if (filas.length === 1) return { subidas: [], falla: `[${tabla}] ${lote.error.message}` };

  const subidas: FilaSync[] = [];
  let falla: string | undefined;
  for (const fila of filas) {
    const r = await supabase.from(tabla).upsert(fila, { onConflict: "id" });
    if (r.error) falla ??= `[${tabla}] ${r.error.message}`;
    else subidas.push(fila);
  }
  return { subidas, falla };
}

/** Qué cuentas hay que subir, conciliando saldos con la nube. */
async function cuentasASubir(
  locales: FilaSync[],
  nube: FilaSync[],
  bases: Bases,
  resultado: { conflictos: number },
): Promise<FilaSync[]> {
  const nubePorId = new Map(nube.map((n) => [n.id as number, n]));
  const subir: FilaSync[] = [];

  for (const local of locales) {
    const id = local.id as number;
    const remota = nubePorId.get(id);
    if (!remota) {
      subir.push(local);
      continue;
    }

    const r = resolverSaldo(local.saldo as number, remota.saldo as number, bases[id]);
    switch (r.accion) {
      case "nada":
        bases[id] = local.saldo as number;
        if (esMasNueva(local.last_updated, remota.last_updated)) subir.push(local);
        break;
      case "subir":
        subir.push(local);
        break;
      case "bajar":
        break; // lo trae el pull
      case "ambos": {
        // Se conservan los dos movimientos: saldo de la nube + lo que cambió acá.
        // La base pasa a ser el saldo de la nube sobre el que se sumó, así un
        // push fallido no vuelve a sumar la diferencia dos veces.
        resultado.conflictos += 1;
        bases[id] = remota.saldo as number;
        await bovedaDB.cuentas.update(id, { saldo: r.saldo });
        subir.push({ ...local, saldo: r.saldo, last_updated: new Date().toISOString() });
        break;
      }
      case "fecha":
        if (esMasNueva(local.last_updated, remota.last_updated)) subir.push(local);
        break;
    }
  }
  return subir;
}

/**
 * Sube a Supabase las filas locales que son más nuevas que las de la nube (o
 * que la nube no tiene). Cada tabla se sube por separado y una que falle (ej:
 * todavía no corriste el schema SQL más nuevo) no frena a las demás — mejor
 * sincronizar lo que se pueda que no sincronizar nada.
 */
export async function pushToCloud(): Promise<SyncResult> {
  if (!supabase) return SIN_CONFIG;

  const porTabla: Record<string, number> = {};
  const errores: string[] = [];
  const resultado = { conflictos: 0 };
  const bases = leerBases();
  const now = new Date().toISOString();

  for (const tabla of TABLAS) {
    try {
      const locales = (await bovedaDB.table(tabla).toArray()) as FilaSync[];
      if (locales.length === 0) {
        porTabla[tabla] = 0;
        continue;
      }

      const esCuentas = tabla === "cuentas";
      const nube = await leerNube(tabla, esCuentas ? "id,last_updated,saldo" : "id,last_updated");
      const aSubir = esCuentas
        ? await cuentasASubir(locales, nube, bases, resultado)
        : filasAPushear(locales, new Map(nube.map((n) => [n.id as number, n.last_updated ?? null])));

      if (aSubir.length === 0) {
        porTabla[tabla] = 0;
        continue;
      }

      const conSello: FilaSync[] = aSubir.map((f) => ({
        ...f,
        last_updated: f.last_updated ?? now,
      }));
      const { subidas, falla } = await subirFilas(tabla, conSello);

      if (esCuentas) for (const f of subidas) bases[f.id as number] = f.saldo as number;
      porTabla[tabla] = subidas.length;
      if (falla) throw new Error(falla);
    } catch (err) {
      errores.push(pistaError(err));
    }
  }
  guardarBases(bases);

  if (errores.length === 0) {
    return {
      ok: true,
      message: "Sincronizado correctamente (subida a la nube).",
      porTabla,
      conflictos: resultado.conflictos,
    };
  }
  return {
    ok: false,
    message: `Subida parcial: fallaron ${errores.length} de ${TABLAS.length} tablas.`,
    detail: errores.join(" · "),
    porTabla,
    conflictos: resultado.conflictos,
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

/* -------------------------------- Pull -------------------------------- */

/**
 * Aplica filas de la nube con `bulkPut` (marcadas como escritura remota). Si
 * el lote falla —ej: la misma marca de hábito creada en dos dispositivos con
 * distinto id choca con el índice único— reintenta fila por fila para que una
 * sola no frene al resto. Devuelve cuántas no se pudieron aplicar.
 */
async function aplicarFilas(tbl: Table, filas: FilaSync[]): Promise<number> {
  const escribir = (lote: FilaSync[]) =>
    bovedaDB.transaction("rw", tbl, async () => {
      marcarTransaccionRemota();
      await tbl.bulkPut(lote as never[]);
    });

  try {
    await escribir(filas);
    return 0;
  } catch {
    let omitidas = 0;
    for (const fila of filas) {
      try {
        await escribir([fila]);
      } catch {
        omitidas += 1;
      }
    }
    return omitidas;
  }
}

/** Qué cuentas de la nube hay que aplicar, conciliando saldos con lo local. */
async function cuentasABajar(
  locales: Map<number, FilaSync>,
  nube: FilaSync[],
  bases: Bases,
  resultado: { conflictos: number },
): Promise<FilaSync[]> {
  const aplicar: FilaSync[] = [];

  for (const remota of nube) {
    const id = remota.id as number;
    const local = locales.get(id);
    if (!local) {
      aplicar.push(remota);
      bases[id] = remota.saldo as number;
      continue;
    }

    const r = resolverSaldo(local.saldo as number, remota.saldo as number, bases[id]);
    switch (r.accion) {
      case "nada":
        bases[id] = remota.saldo as number;
        if (filasAPullear(new Map([[id, local]]), [remota]).length > 0) aplicar.push(remota);
        break;
      case "bajar":
        aplicar.push(remota);
        bases[id] = remota.saldo as number;
        break;
      case "subir":
        break; // lo sube el push
      case "ambos":
        resultado.conflictos += 1;
        bases[id] = remota.saldo as number;
        await bovedaDB.cuentas.update(id, { saldo: r.saldo });
        break;
      case "fecha":
        if (filasAPullear(new Map([[id, local]]), [remota]).length > 0) {
          aplicar.push(remota);
          bases[id] = remota.saldo as number;
        }
        break;
    }
  }
  return aplicar;
}

/**
 * Baja de Supabase las filas que son más nuevas que las locales (o que no
 * existen acá) y las aplica con `bulkPut`. Con `forzar` reemplaza TODO lo
 * local por lo de la nube (botón "Forzar descarga"). Igual que `pushToCloud`,
 * una tabla que falle no frena la descarga de las demás.
 */
export async function pullFromCloud(
  opciones: { forzar?: boolean } = {},
): Promise<SyncResult> {
  if (!supabase) return SIN_CONFIG;
  const forzar = opciones.forzar === true;

  const porTabla: Record<string, number> = {};
  const errores: string[] = [];
  const resultado = { conflictos: 0 };
  const bases = leerBases();

  for (const tabla of TABLAS) {
    try {
      const nube = await leerNube(tabla, "*");
      if (nube.length === 0) {
        porTabla[tabla] = 0;
        continue;
      }

      const tbl = bovedaDB.table(tabla);
      const locales = new Map(
        ((await tbl.toArray()) as FilaSync[]).map((f) => [f.id as number, f]),
      );
      const esCuentas = tabla === "cuentas";
      const aplicar =
        esCuentas && !forzar
          ? await cuentasABajar(locales, nube, bases, resultado)
          : filasAPullear(locales, nube, forzar);

      if (esCuentas && forzar) for (const n of nube) bases[n.id as number] = n.saldo as number;

      const omitidas = aplicar.length > 0 ? await aplicarFilas(tbl, aplicar) : 0;
      porTabla[tabla] = aplicar.length - omitidas;
      if (omitidas > 0) {
        throw new Error(
          `[${tabla}] ${omitidas} fila(s) chocan con un dato igual cargado en otro dispositivo y no se pudieron aplicar.`,
        );
      }
    } catch (err) {
      errores.push(pistaError(err));
    }
  }
  guardarBases(bases);

  if (errores.length === 0) {
    return {
      ok: true,
      message: "Sincronizado correctamente (descarga desde la nube).",
      porTabla,
      conflictos: resultado.conflictos,
    };
  }
  return {
    ok: false,
    message: `Descarga parcial: fallaron ${errores.length} de ${TABLAS.length} tablas.`,
    detail: errores.join(" · "),
    porTabla,
    conflictos: resultado.conflictos,
  };
}

/* ============================================================================
 *  Sync resiliente: cola offline, realtime y actualización al volver a la app
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
 *  2. Suscripción realtime (WebSocket) a cambios remotos → pull + callback.
 *  3. Pull al volver a la app (pestaña visible, foco o reconexión): el
 *     WebSocket se suspende con la app en segundo plano y es justo cuando un
 *     dispositivo queda desactualizado y después pisa datos más nuevos.
 *  4. Auto-push en tiempo real: cualquier escritura local (de cualquier
 *     tabla, sea por una acción de `lib/actions.ts` o un CRUD directo de una
 *     página) dispara un push a los pocos milisegundos, sin que el usuario
 *     tenga que tocar el botón "Subir a la nube".
 *
 * OJO: a propósito NO hace un pull inicial acá — eso le toca al que llama,
 * y tiene que esperarlo (`await pullFromCloud()`) ANTES de generar cualquier
 * escritura local propia (ej. cobrar una suscripción vencida al abrir la
 * app). Si el pull inicial corriera en paralelo con esa escritura, el
 * estado viejo de la nube podía pisarla antes de que el auto-push la subiera.
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

  // 2/3: cualquier cambio remoto, o volver a la app, dispara un pull. Si el
  // pull concilió saldos movidos en dos dispositivos, se suben ya mismo.
  let pullPendiente: ReturnType<typeof setTimeout> | null = null;
  const programarPull = () => {
    if (pullPendiente) clearTimeout(pullPendiente);
    pullPendiente = setTimeout(() => {
      void pullFromCloud().then((r) => {
        if (r.ok) onRemoteChange?.();
        if ((r.conflictos ?? 0) > 0) void pushConCola();
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

  const alVolverOnline = () => {
    if (hayPushPendiente()) void pushConCola();
    programarPull();
  };
  const alVolverALaApp = () => {
    if (document.visibilityState === "visible") programarPull();
  };
  window.addEventListener("online", alVolverOnline);
  window.addEventListener("focus", programarPull);
  document.addEventListener("visibilitychange", alVolverALaApp);

  // 4: auto-push — cualquier escritura local dispara un push (con un
  // pequeño debounce para agrupar ráfagas de escrituras, ej. cargar varios
  // movimientos seguidos, sin pisar la cola offline si estamos sin red).
  // Las escrituras que vienen de un pull no lo disparan (ver db.ts).
  let autoPushPendiente: ReturnType<typeof setTimeout> | null = null;
  const programarAutoPush = () => {
    if (autoPushPendiente) clearTimeout(autoPushPendiente);
    autoPushPendiente = setTimeout(() => {
      void pushConCola().then((r) => onAutoPushResult?.(r));
    }, 700);
  };
  const quitarListenerEscritura = onEscrituraLocal(programarAutoPush);

  // Cleanup
  return () => {
    window.removeEventListener("online", alVolverOnline);
    window.removeEventListener("focus", programarPull);
    document.removeEventListener("visibilitychange", alVolverALaApp);
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
