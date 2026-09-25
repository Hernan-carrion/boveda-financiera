import Dexie, { type EntityTable } from "dexie";

/**
 * Base de datos local (IndexedDB) de Bóveda Financiera.
 * La app es Local-First; la sincronización con Supabase es opcional.
 *
 * `last_updated` (ISO) está en todas las tablas para resolver conflictos de
 * sincronización a futuro (eventual consistency). El `id` autoincremental local
 * se usa como clave primaria también en Supabase (modelo de un solo usuario).
 */

export type Moneda = "ARS" | "USD";

/** Campo común de sincronización presente en todas las tablas. */
export interface Sincronizable {
  last_updated?: string; // ISO string
}

export type TipoCuenta = "efectivo" | "digital" | "banco";

export interface Cuenta extends Sincronizable {
  id?: number;
  nombre: string;
  tipo: TipoCuenta;
  moneda: Moneda;
  saldo: number;
}

export type TipoTransaccion =
  | "ingreso"
  | "egreso"
  | "prestamo"
  | "devolucion";

export interface Transaccion extends Sincronizable {
  id?: number;
  cuenta_id: number;
  tipo: TipoTransaccion;
  monto: number;
  moneda: Moneda;
  categoria: string;
  descripcion: string;
  fecha: string; // ISO string
  /** El gasto se lo van a reintegrar (obra social, laburo, un amigo…). */
  reintegrable?: boolean;
  /** Ya cobré el reintegro (se generó el ingreso compensatorio). */
  reintegrado?: boolean;
  /**
   * Borrado lógico: la fila sigue existiendo (para que el borrado se pueda
   * sincronizar con un upsert normal) pero se excluye de todas las vistas y
   * cálculos. La UI nunca borra físicamente un movimiento.
   */
  eliminado?: boolean;
}

export interface Tarjeta extends Sincronizable {
  id?: number;
  nombre: string;
  dia_cierre: number;
  dia_vencimiento: number;
  limite: number;
  moneda: Moneda;
}

export type EstadoDeuda = "pendiente" | "parcial" | "pagada";

export interface DeudaTarjeta extends Sincronizable {
  id?: number;
  tarjeta_id: number;
  periodo: string; // ej: "2026-09"
  monto_total: number;
  monto_pagado: number;
  estado: EstadoDeuda;
}

/**
 * Compra con tarjeta en N cuotas. Es el origen de verdad del plan de pagos:
 * al registrarla se reparte `monto_total` entre `cuotas_totales` períodos
 * consecutivos (desde `periodo_inicio`) y cada parte se suma al
 * `DeudaTarjeta.monto_total` de ese período — así el resumen de cada mes
 * futuro ya aparece calculado sin tener que cargar nada a mano.
 */
export interface CompraTarjeta extends Sincronizable {
  id?: number;
  tarjeta_id: number;
  descripcion: string;
  monto_total: number;
  cuotas_totales: number;
  /** Período ("yyyy-MM") de la primera cuota. */
  periodo_inicio: string;
  moneda: Moneda;
  fecha: string; // ISO string
}

export type EstadoInversion = "activa" | "cerrada";

export interface Inversion extends Sincronizable {
  id?: number;
  nombre: string;
  tipo: string;
  capital_inicial: number;
  moneda: Moneda;
  estado: EstadoInversion;
  /** ARS por USD al momento de la compra (compras de dólares). */
  cotizacion_compra?: number;
  /** capital_inicial * cotizacion_compra — cuánto costó en ARS. */
  costo_ars?: number;
  fecha?: string; // ISO string
}

export type TipoPrestamo = "otorgado" | "recibido";
export type EstadoPrestamo = "abierto" | "devuelto";

export interface Prestamo extends Sincronizable {
  id?: number;
  persona: string;
  tipo: TipoPrestamo;
  monto: number;
  moneda: Moneda;
  estado: EstadoPrestamo;
  fecha_prestamo: string; // ISO string
  /** Cotización del dólar (ARS/USD) al dar/recibir el préstamo. */
  cotizacion_origen?: number;
  /** Cotización del dólar (ARS/USD) al registrar la devolución. */
  cotizacion_cierre?: number;
  fecha_devolucion?: string; // ISO string
}

/** Límite de gasto mensual por categoría. */
export interface Presupuesto extends Sincronizable {
  id?: number;
  categoria: string;
  monto_limite: number;
  moneda: Moneda;
  mes: string; // "yyyy-MM"
}

/** Gasto recurrente que se cobra solo cada mes (Netflix, gym, alquiler…). */
export interface Suscripcion extends Sincronizable {
  id?: number;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  categoria: string;
  cuenta_id: number;
  dia_cobro: number; // 1-31
  activa: boolean;
  /** Último período "yyyy-MM" en el que ya se generó el cobro automático. */
  ultimo_cobro_periodo?: string;
  /** Último período "yyyy-MM" en el que ya se avisó "se cobra en 2 días". */
  ultimo_aviso_periodo?: string;
  /**
   * Borrado lógico (mismo motivo que `Transaccion.eliminado`): un borrado
   * físico no se puede "subir" con upsert y un dispositivo desactualizado
   * podría resucitarla en el próximo sync.
   */
  eliminado?: boolean;
}

/** Objetivo de ahorro (Ej: "Moto 150cc", "Llantas Golf"). */
export interface MetaAhorro extends Sincronizable {
  id?: number;
  nombre: string;
  monto_objetivo: number;
  moneda: Moneda;
  color_hex: string;
}

/** Pares clave/valor de configuración (ej: cotización manual del dólar). */
export interface Configuracion extends Sincronizable {
  id?: number;
  clave: string;
  valor: string;
}

export type TipoTurno = "ninguno" | "medio" | "completo";

/**
 * Registro de un día de trabajo (calendario de la "cuenta sueldo" de
 * referencia — no mueve plata real, sólo lleva la cuenta de cuánto sueldo
 * entra a Mercado Pago). Una fila por fecha; "ninguno" en vez de borrar la
 * fila cuando se desmarca un día, así el borrado también sincroniza bien.
 */
export interface DiaTrabajado extends Sincronizable {
  id?: number;
  fecha: string; // "yyyy-MM-dd", única
  turno: TipoTurno;
  /** Monto de ese día según la tarifa vigente al marcarlo (0 si "ninguno"). */
  monto: number;
}

/* ============================================================================
 *  "Vida" — tareas, proyectos, recordatorios y notas (Fase 1 de Huella)
 * ========================================================================== */

/** Agrupa tareas relacionadas bajo un mismo objetivo (ej: "Viaje a Bariloche"). */
export interface Proyecto extends Sincronizable {
  id?: number;
  nombre: string;
  descripcion?: string;
  color_hex: string;
  estado: "activo" | "archivado";
  eliminado?: boolean;
}

export type PrioridadTarea = "baja" | "media" | "alta";
export type EstadoTarea = "pendiente" | "hecha";

export interface Tarea extends Sincronizable {
  id?: number;
  titulo: string;
  descripcion?: string;
  /** "yyyy-MM-dd" — opcional, hay tareas sin fecha ("algún día"). */
  fecha_vencimiento?: string;
  prioridad: PrioridadTarea;
  proyecto_id?: number;
  estado: EstadoTarea;
  /** ISO — cuándo se marcó como hecha. */
  completada_en?: string;
  eliminado?: boolean;
}

export type RepeticionRecordatorio = "ninguna" | "mensual" | "anual";

/**
 * Recordatorio genérico (turnos, vencimientos de documentos, cumpleaños,
 * trámites…) — no mueve plata ni cuenta como transacción, a diferencia de
 * una suscripción. `fecha` es siempre la PRÓXIMA ocurrencia: si `repetir`
 * no es "ninguna", se recalcula sola una vez que pasa.
 */
export interface Recordatorio extends Sincronizable {
  id?: number;
  titulo: string;
  categoria: string;
  /** "yyyy-MM-dd" — próxima fecha en la que corresponde. */
  fecha: string;
  repetir: RepeticionRecordatorio;
  /** Con cuántos días de anticipación avisar. */
  dias_aviso: number;
  activo: boolean;
  /** Última fecha ("yyyy-MM-dd") para la que ya se avisó — evita repetir el toast. */
  ultimo_aviso_fecha?: string;
  eliminado?: boolean;
}

/** Nota rápida sin fecha ni proyecto — listas, ideas sueltas, lo que sea. */
export interface Nota extends Sincronizable {
  id?: number;
  texto: string;
  fijada: boolean;
  eliminado?: boolean;
}

export const bovedaDB = new Dexie("BovedaFinancieraDB") as Dexie & {
  cuentas: EntityTable<Cuenta, "id">;
  transacciones: EntityTable<Transaccion, "id">;
  tarjetas: EntityTable<Tarjeta, "id">;
  deudas_tarjetas: EntityTable<DeudaTarjeta, "id">;
  inversiones: EntityTable<Inversion, "id">;
  prestamos: EntityTable<Prestamo, "id">;
  presupuestos: EntityTable<Presupuesto, "id">;
  suscripciones: EntityTable<Suscripcion, "id">;
  metas_ahorro: EntityTable<MetaAhorro, "id">;
  configuracion: EntityTable<Configuracion, "id">;
  compras_tarjeta: EntityTable<CompraTarjeta, "id">;
  dias_trabajados: EntityTable<DiaTrabajado, "id">;
  proyectos: EntityTable<Proyecto, "id">;
  tareas: EntityTable<Tarea, "id">;
  recordatorios: EntityTable<Recordatorio, "id">;
  notas: EntityTable<Nota, "id">;
};

bovedaDB.version(1).stores({
  cuentas: "++id, nombre, tipo, moneda, saldo",
  transacciones:
    "++id, cuenta_id, tipo, monto, moneda, categoria, descripcion, fecha",
  tarjetas: "++id, nombre, dia_cierre, dia_vencimiento, limite, moneda",
  deudas_tarjetas:
    "++id, tarjeta_id, periodo, monto_total, monto_pagado, estado",
  inversiones: "++id, nombre, tipo, capital_inicial, moneda, estado",
  prestamos: "++id, persona, tipo, monto, moneda, estado, fecha_prestamo",
});

/**
 * v2 — cotizaciones y volatilidad cambiaria.
 * Los campos nuevos (cotizacion_compra, cotizacion_origen, cotizacion_cierre)
 * no se indexan, así que el esquema declarado no cambia; sólo migramos el
 * estado de préstamos "saldado" → "devuelto" para las filas existentes.
 */
bovedaDB
  .version(2)
  .stores({
    inversiones: "++id, nombre, tipo, capital_inicial, moneda, estado",
    prestamos: "++id, persona, tipo, monto, moneda, estado, fecha_prestamo",
  })
  .upgrade((tx) =>
    tx
      .table("prestamos")
      .toCollection()
      .modify((p: { estado?: string }) => {
        if (p.estado === "saldado") p.estado = "devuelto";
      }),
  );

/**
 * v3 — preparación para sincronización con Supabase.
 * Se indexa `last_updated` en todas las tablas para poder resolver conflictos
 * por fecha en el futuro (eventual consistency).
 */
bovedaDB.version(3).stores({
  cuentas: "++id, nombre, tipo, moneda, saldo, last_updated",
  transacciones:
    "++id, cuenta_id, tipo, monto, moneda, categoria, descripcion, fecha, last_updated",
  tarjetas:
    "++id, nombre, dia_cierre, dia_vencimiento, limite, moneda, last_updated",
  deudas_tarjetas:
    "++id, tarjeta_id, periodo, monto_total, monto_pagado, estado, last_updated",
  inversiones:
    "++id, nombre, tipo, capital_inicial, moneda, estado, last_updated",
  prestamos:
    "++id, persona, tipo, monto, moneda, estado, fecha_prestamo, last_updated",
});

/**
 * v4 — módulos PRO: presupuestos, suscripciones, metas de ahorro y
 * configuración (cotización manual del dólar). Además se indexa
 * `reintegrable` en transacciones para la vista "Por cobrar".
 */
bovedaDB.version(4).stores({
  transacciones:
    "++id, cuenta_id, tipo, monto, moneda, categoria, descripcion, fecha, reintegrable, last_updated",
  presupuestos: "++id, categoria, mes, moneda, last_updated",
  suscripciones:
    "++id, descripcion, categoria, cuenta_id, dia_cobro, activa, last_updated",
  metas_ahorro: "++id, nombre, moneda, last_updated",
  configuracion: "++id, &clave, last_updated",
});

/**
 * v5 — compras de tarjeta en cuotas (`compras_tarjeta`). El plan de pagos que
 * genera se refleja como filas de `deudas_tarjetas` por período; esa tabla no
 * cambia de esquema.
 */
bovedaDB.version(5).stores({
  compras_tarjeta:
    "++id, tarjeta_id, periodo_inicio, moneda, fecha, last_updated",
});

/**
 * v6 — borrado lógico de transacciones (`eliminado`). Permite editar o
 * eliminar un movimiento después de cargado sin romper la sincronización: un
 * borrado físico no se puede "subir" con upsert, uno lógico sí (es una fila
 * más que se actualiza).
 */
bovedaDB.version(6).stores({
  transacciones:
    "++id, cuenta_id, tipo, monto, moneda, categoria, descripcion, fecha, reintegrable, eliminado, last_updated",
});

/**
 * v7 — calendario de la "cuenta sueldo" (`dias_trabajados`): un día por
 * fecha, con el turno trabajado ("ninguno"/"medio"/"completo"). Es de
 * referencia — no mueve plata ni cuenta como una `cuenta` real.
 */
bovedaDB.version(7).stores({
  dias_trabajados: "++id, &fecha, turno, last_updated",
});

/**
 * v8 — borrado lógico de suscripciones (`eliminado`), mismo motivo que el
 * de transacciones (v6): editar/eliminar sin romper la sincronización.
 */
bovedaDB.version(8).stores({
  suscripciones:
    "++id, descripcion, categoria, cuenta_id, dia_cobro, activa, eliminado, last_updated",
});

/**
 * v9 — Fase 1 de "Huella": tareas, proyectos, recordatorios y notas. Primer
 * módulo que no es financiero — mismo patrón local-first + borrado lógico
 * que todo lo demás.
 */
bovedaDB.version(9).stores({
  proyectos: "++id, nombre, estado, eliminado, last_updated",
  tareas:
    "++id, proyecto_id, estado, prioridad, fecha_vencimiento, eliminado, last_updated",
  recordatorios:
    "++id, categoria, fecha, activo, eliminado, last_updated",
  notas: "++id, fijada, eliminado, last_updated",
});

/**
 * Cuentas base que se crean la primera vez que se abre la app.
 */
/** Clave en `configuracion` para la cotización ARS/USD manual del usuario. */
export const CLAVE_COTIZACION_USD = "cotizacion_usd";
/** Clave en `configuracion` para el monto de sueldo precargado del botón "Cobrar sueldo". */
export const CLAVE_MONTO_SUELDO = "monto_sueldo";
/** Claves en `configuracion` para las tarifas por día de la cuenta sueldo. */
export const CLAVE_TARIFA_MEDIO_TURNO = "tarifa_medio_turno";
export const CLAVE_TARIFA_TURNO_COMPLETO = "tarifa_turno_completo";

bovedaDB.on("populate", () => {
  bovedaDB.cuentas.bulkAdd([
    { nombre: "Efectivo Pesos", tipo: "efectivo", moneda: "ARS", saldo: 0 },
    { nombre: "Mercado Pago", tipo: "digital", moneda: "ARS", saldo: 0 },
    { nombre: "Efectivo Dólares", tipo: "efectivo", moneda: "USD", saldo: 0 },
  ]);
  bovedaDB.configuracion.add({ clave: CLAVE_COTIZACION_USD, valor: "1000" });
});

/* ============================================================================
 *  Observación de escrituras locales — para el auto-push en tiempo real
 * ========================================================================== */

type ListenerEscritura = () => void;
const listenersEscrituraLocal = new Set<ListenerEscritura>();

/**
 * Suscribe una función que se dispara apenas se confirma (commit) cualquier
 * escritura en cualquier tabla de la app — sea por una función de
 * `lib/actions.ts` o un `bovedaDB.tabla.add/update/delete` directo desde una
 * página. `syncService` la usa para disparar el push a Supabase en tiempo
 * real sin tener que instrumentar cada mutación una por una.
 * Devuelve la función para desuscribirse.
 */
export function onEscrituraLocal(fn: ListenerEscritura): () => void {
  listenersEscrituraLocal.add(fn);
  return () => listenersEscrituraLocal.delete(fn);
}

function avisarEscrituraLocal() {
  for (const fn of listenersEscrituraLocal) fn();
}

// Se engancha una sola vez, a todas las tablas existentes, vía los hooks
// nativos de Dexie (creating/updating/deleting). `transaction.on("complete")`
// asegura que el aviso salga recién cuando el cambio ya quedó confirmado.
for (const tabla of bovedaDB.tables) {
  tabla.hook("creating", (_key, _obj, transaction) => {
    transaction.on("complete", avisarEscrituraLocal);
  });
  tabla.hook("updating", (_mods, _key, _obj, transaction) => {
    transaction.on("complete", avisarEscrituraLocal);
  });
  tabla.hook("deleting", (_key, _obj, transaction) => {
    transaction.on("complete", avisarEscrituraLocal);
  });
}

export default bovedaDB;
