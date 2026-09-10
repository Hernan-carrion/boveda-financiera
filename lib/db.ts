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

export const bovedaDB = new Dexie("BovedaFinancieraDB") as Dexie & {
  cuentas: EntityTable<Cuenta, "id">;
  transacciones: EntityTable<Transaccion, "id">;
  tarjetas: EntityTable<Tarjeta, "id">;
  deudas_tarjetas: EntityTable<DeudaTarjeta, "id">;
  inversiones: EntityTable<Inversion, "id">;
  prestamos: EntityTable<Prestamo, "id">;
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
 * Cuentas base que se crean la primera vez que se abre la app.
 */
bovedaDB.on("populate", () => {
  bovedaDB.cuentas.bulkAdd([
    { nombre: "Efectivo Pesos", tipo: "efectivo", moneda: "ARS", saldo: 0 },
    { nombre: "Mercado Pago", tipo: "digital", moneda: "ARS", saldo: 0 },
    { nombre: "Efectivo Dólares", tipo: "efectivo", moneda: "USD", saldo: 0 },
  ]);
});

export default bovedaDB;
