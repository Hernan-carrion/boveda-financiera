import {
  bovedaDB,
  type EstadoDeuda,
  type Moneda,
  type TipoPrestamo,
} from "./db";
import type { ResultadoGasto } from "./categorizer";
import { periodoActual } from "./utils";

/**
 * Todas las mutaciones pasan por acá para mantener consistente el saldo de
 * `cuentas` con cada movimiento. Cero llamadas de red: sólo IndexedDB.
 */

/** Signo que un movimiento aplica sobre el saldo de la cuenta. */
function signo(tipo: ResultadoGasto["tipo"]): number {
  switch (tipo) {
    case "ingreso":
    case "devolucion":
      return 1;
    case "egreso":
    case "prestamo":
      return -1;
    default:
      return -1;
  }
}

export async function registrarTransaccion(res: ResultadoGasto) {
  return bovedaDB.transaction("rw", bovedaDB.cuentas, bovedaDB.transacciones, async () => {
    let cuenta = await bovedaDB.cuentas.where("nombre").equals(res.cuenta).first();
    if (!cuenta) {
      cuenta = await bovedaDB.cuentas.where("moneda").equals(res.moneda).first();
    }
    if (!cuenta || cuenta.id == null) {
      throw new Error("No hay una cuenta disponible para registrar el movimiento.");
    }

    const delta = signo(res.tipo) * Math.abs(res.monto);
    await bovedaDB.cuentas.update(cuenta.id, { saldo: cuenta.saldo + delta });

    return bovedaDB.transacciones.add({
      cuenta_id: cuenta.id,
      tipo: res.tipo,
      monto: Math.abs(res.monto),
      moneda: res.moneda,
      categoria: res.categoria,
      descripcion: res.descripcion,
      fecha: new Date().toISOString(),
    });
  });
}

export async function actualizarCategoria(id: number, categoria: string) {
  return bovedaDB.transacciones.update(id, { categoria });
}

export async function borrarTransaccion(id: number) {
  const tx = await bovedaDB.transacciones.get(id);
  if (!tx) return;
  return bovedaDB.transaction("rw", bovedaDB.cuentas, bovedaDB.transacciones, async () => {
    const cuenta = await bovedaDB.cuentas.get(tx.cuenta_id);
    if (cuenta && cuenta.id != null) {
      // revertir el efecto en el saldo
      const revert = -signo(tx.tipo) * Math.abs(tx.monto);
      await bovedaDB.cuentas.update(cuenta.id, { saldo: cuenta.saldo + revert });
    }
    await bovedaDB.transacciones.delete(id);
  });
}

/* -------------------------- Tarjetas -------------------------- */

function estadoDeuda(total: number, pagado: number): EstadoDeuda {
  if (pagado <= 0) return "pendiente";
  if (pagado >= total) return "pagada";
  return "parcial";
}

export async function registrarConsumoTarjeta(
  tarjeta_id: number,
  monto: number,
  periodo: string = periodoActual(),
) {
  return bovedaDB.transaction("rw", bovedaDB.deudas_tarjetas, async () => {
    const existente = await bovedaDB.deudas_tarjetas
      .where("tarjeta_id")
      .equals(tarjeta_id)
      .and((d) => d.periodo === periodo)
      .first();

    if (existente && existente.id != null) {
      const total = existente.monto_total + monto;
      return bovedaDB.deudas_tarjetas.update(existente.id, {
        monto_total: total,
        estado: estadoDeuda(total, existente.monto_pagado),
      });
    }
    return bovedaDB.deudas_tarjetas.add({
      tarjeta_id,
      periodo,
      monto_total: monto,
      monto_pagado: 0,
      estado: "pendiente",
    });
  });
}

export async function pagarDeudaTarjeta(
  deuda_id: number,
  cuenta_id: number,
  monto: number,
) {
  return bovedaDB.transaction(
    "rw",
    bovedaDB.deudas_tarjetas,
    bovedaDB.cuentas,
    bovedaDB.transacciones,
    async () => {
      const deuda = await bovedaDB.deudas_tarjetas.get(deuda_id);
      const cuenta = await bovedaDB.cuentas.get(cuenta_id);
      if (!deuda || deuda.id == null) throw new Error("Deuda inexistente.");
      if (!cuenta || cuenta.id == null) throw new Error("Cuenta inexistente.");

      const pagado = deuda.monto_pagado + monto;
      await bovedaDB.deudas_tarjetas.update(deuda.id, {
        monto_pagado: pagado,
        estado: estadoDeuda(deuda.monto_total, pagado),
      });
      await bovedaDB.cuentas.update(cuenta.id, { saldo: cuenta.saldo - monto });
      await bovedaDB.transacciones.add({
        cuenta_id: cuenta.id,
        tipo: "egreso",
        monto,
        moneda: cuenta.moneda,
        categoria: "Tarjetas",
        descripcion: `Pago tarjeta período ${deuda.periodo}`,
        fecha: new Date().toISOString(),
      });
    },
  );
}

/* -------------------------- Préstamos -------------------------- */

export async function registrarPrestamo(params: {
  persona: string;
  tipo: TipoPrestamo;
  monto: number;
  moneda: Moneda;
  cuenta_id: number;
  /** Cotización del dólar (ARS/USD) al momento del préstamo. Opcional. */
  cotizacion_origen?: number;
}) {
  const { persona, tipo, monto, moneda, cuenta_id, cotizacion_origen } = params;
  return bovedaDB.transaction(
    "rw",
    bovedaDB.prestamos,
    bovedaDB.cuentas,
    bovedaDB.transacciones,
    async () => {
      const cuenta = await bovedaDB.cuentas.get(cuenta_id);
      if (!cuenta || cuenta.id == null) throw new Error("Cuenta inexistente.");

      // otorgado -> sale plata de la cuenta; recibido -> entra plata
      const delta = tipo === "otorgado" ? -monto : monto;
      await bovedaDB.cuentas.update(cuenta.id, { saldo: cuenta.saldo + delta });

      await bovedaDB.transacciones.add({
        cuenta_id: cuenta.id,
        tipo: tipo === "otorgado" ? "prestamo" : "ingreso",
        monto,
        moneda,
        categoria: "Préstamos",
        descripcion:
          tipo === "otorgado"
            ? `Préstamo a ${persona}`
            : `Préstamo recibido de ${persona}`,
        fecha: new Date().toISOString(),
      });

      return bovedaDB.prestamos.add({
        persona,
        tipo,
        monto,
        moneda,
        estado: "abierto",
        fecha_prestamo: new Date().toISOString(),
        ...(cotizacion_origen && cotizacion_origen > 0
          ? { cotizacion_origen }
          : {}),
      });
    },
  );
}

export async function registrarDevolucionPrestamo(
  prestamo_id: number,
  cuenta_id: number,
  monto: number,
  /** Cotización del dólar (ARS/USD) al momento de la devolución. Opcional. */
  cotizacion_cierre?: number,
) {
  return bovedaDB.transaction(
    "rw",
    bovedaDB.prestamos,
    bovedaDB.cuentas,
    bovedaDB.transacciones,
    async () => {
      const prestamo = await bovedaDB.prestamos.get(prestamo_id);
      const cuenta = await bovedaDB.cuentas.get(cuenta_id);
      if (!prestamo || prestamo.id == null) throw new Error("Préstamo inexistente.");
      if (!cuenta || cuenta.id == null) throw new Error("Cuenta inexistente.");

      // si yo lo otorgué, la devolución ENTRA; si lo recibí, la devolución SALE
      const delta = prestamo.tipo === "otorgado" ? monto : -monto;
      await bovedaDB.cuentas.update(cuenta.id, { saldo: cuenta.saldo + delta });

      await bovedaDB.transacciones.add({
        cuenta_id: cuenta.id,
        tipo: prestamo.tipo === "otorgado" ? "devolucion" : "egreso",
        monto,
        moneda: prestamo.moneda,
        categoria: "Préstamos",
        descripcion:
          prestamo.tipo === "otorgado"
            ? `${prestamo.persona} devolvió el préstamo`
            : `Devolución a ${prestamo.persona}`,
        fecha: new Date().toISOString(),
      });

      await bovedaDB.prestamos.update(prestamo.id, {
        estado: "devuelto",
        fecha_devolucion: new Date().toISOString(),
        ...(cotizacion_cierre && cotizacion_cierre > 0
          ? { cotizacion_cierre }
          : {}),
      });
    },
  );
}

/* -------------------------- Inversiones / Dólares -------------------------- */

/**
 * Registra una compra de dólares (MEP, Blue, CCL, etc.).
 * Guarda el capital en USD, la cotización de compra y el costo total en ARS.
 */
export async function registrarCompraDolares(params: {
  tipo: string;
  capitalUsd: number;
  cotizacionCompra: number;
  nombre?: string;
}) {
  const { tipo, capitalUsd, cotizacionCompra } = params;
  if (!(capitalUsd > 0) || !(cotizacionCompra > 0)) {
    throw new Error("El monto en USD y la cotización de compra son obligatorios.");
  }
  const costo_ars = capitalUsd * cotizacionCompra;
  return bovedaDB.inversiones.add({
    nombre: params.nombre?.trim() || `Compra USD ${tipo}`,
    tipo,
    capital_inicial: capitalUsd,
    moneda: "USD",
    estado: "activa",
    cotizacion_compra: cotizacionCompra,
    costo_ars,
    fecha: new Date().toISOString(),
  });
}

export async function cerrarInversion(id: number) {
  return bovedaDB.inversiones.update(id, { estado: "cerrada" });
}

export async function borrarInversion(id: number) {
  return bovedaDB.inversiones.delete(id);
}

/* -------------------------- Backup JSON -------------------------- */

export interface BackupBoveda {
  __app: "boveda-financiera";
  version: number;
  exportadoEn: string;
  data: {
    cuentas: unknown[];
    transacciones: unknown[];
    tarjetas: unknown[];
    deudas_tarjetas: unknown[];
    inversiones: unknown[];
    prestamos: unknown[];
  };
}

export async function exportarJSON(): Promise<BackupBoveda> {
  const [cuentas, transacciones, tarjetas, deudas_tarjetas, inversiones, prestamos] =
    await Promise.all([
      bovedaDB.cuentas.toArray(),
      bovedaDB.transacciones.toArray(),
      bovedaDB.tarjetas.toArray(),
      bovedaDB.deudas_tarjetas.toArray(),
      bovedaDB.inversiones.toArray(),
      bovedaDB.prestamos.toArray(),
    ]);

  return {
    __app: "boveda-financiera",
    version: 2,
    exportadoEn: new Date().toISOString(),
    data: { cuentas, transacciones, tarjetas, deudas_tarjetas, inversiones, prestamos },
  };
}

export async function importarJSON(backup: BackupBoveda) {
  if (!backup || backup.__app !== "boveda-financiera" || !backup.data) {
    throw new Error("El archivo no es un backup válido de Bóveda Financiera.");
  }
  const { data } = backup;
  await bovedaDB.transaction(
    "rw",
    [
      bovedaDB.cuentas,
      bovedaDB.transacciones,
      bovedaDB.tarjetas,
      bovedaDB.deudas_tarjetas,
      bovedaDB.inversiones,
      bovedaDB.prestamos,
    ],
    async () => {
      await Promise.all([
        bovedaDB.cuentas.clear(),
        bovedaDB.transacciones.clear(),
        bovedaDB.tarjetas.clear(),
        bovedaDB.deudas_tarjetas.clear(),
        bovedaDB.inversiones.clear(),
        bovedaDB.prestamos.clear(),
      ]);
      await Promise.all([
        bovedaDB.cuentas.bulkAdd(data.cuentas as never),
        bovedaDB.transacciones.bulkAdd(data.transacciones as never),
        bovedaDB.tarjetas.bulkAdd(data.tarjetas as never),
        bovedaDB.deudas_tarjetas.bulkAdd(data.deudas_tarjetas as never),
        bovedaDB.inversiones.bulkAdd(data.inversiones as never),
        bovedaDB.prestamos.bulkAdd(data.prestamos as never),
      ]);
    },
  );
}
