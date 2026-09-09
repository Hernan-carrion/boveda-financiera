import Dexie, { type EntityTable } from "dexie";

/**
 * Base de datos local (IndexedDB) de Bóveda Financiera.
 * Ninguna de estas tablas viaja a un servidor: la app es 100% Local-First.
 */

export type Moneda = "ARS" | "USD";

export type TipoCuenta = "efectivo" | "digital" | "banco";

export interface Cuenta {
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

export interface Transaccion {
  id?: number;
  cuenta_id: number;
  tipo: TipoTransaccion;
  monto: number;
  moneda: Moneda;
  categoria: string;
  descripcion: string;
  fecha: string; // ISO string
}

export interface Tarjeta {
  id?: number;
  nombre: string;
  dia_cierre: number;
  dia_vencimiento: number;
  limite: number;
  moneda: Moneda;
}

export type EstadoDeuda = "pendiente" | "parcial" | "pagada";

export interface DeudaTarjeta {
  id?: number;
  tarjeta_id: number;
  periodo: string; // ej: "2026-09"
  monto_total: number;
  monto_pagado: number;
  estado: EstadoDeuda;
}

export type EstadoInversion = "activa" | "cerrada";

export interface Inversion {
  id?: number;
  nombre: string;
  tipo: string;
  capital_inicial: number;
  moneda: Moneda;
  estado: EstadoInversion;
}

export type TipoPrestamo = "otorgado" | "recibido";
export type EstadoPrestamo = "abierto" | "saldado";

export interface Prestamo {
  id?: number;
  persona: string;
  tipo: TipoPrestamo;
  monto: number;
  moneda: Moneda;
  estado: EstadoPrestamo;
  fecha_prestamo: string; // ISO string
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
