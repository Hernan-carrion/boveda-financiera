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
 * Cuentas base que se crean la primera vez que se abre la app.
 */
/** Clave en `configuracion` para la cotización ARS/USD manual del usuario. */
export const CLAVE_COTIZACION_USD = "cotizacion_usd";

bovedaDB.on("populate", () => {
  bovedaDB.cuentas.bulkAdd([
    { nombre: "Efectivo Pesos", tipo: "efectivo", moneda: "ARS", saldo: 0 },
    { nombre: "Mercado Pago", tipo: "digital", moneda: "ARS", saldo: 0 },
    { nombre: "Efectivo Dólares", tipo: "efectivo", moneda: "USD", saldo: 0 },
  ]);
  bovedaDB.configuracion.add({ clave: CLAVE_COTIZACION_USD, valor: "1000" });
});

export default bovedaDB;
