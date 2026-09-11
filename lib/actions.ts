import {
  bovedaDB,
  type EstadoDeuda,
  type Moneda,
  type TipoPrestamo,
} from "./db";
import { CATEGORIA_CAMBIO_DIVISA, type ResultadoGasto } from "./categorizer";
import { periodoActual } from "./utils";
import { calcularCuotas } from "./cuotas";

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
      ...(res.reintegrable
        ? { reintegrable: true as const, reintegrado: false as const }
        : {}),
    });
  });
}

/**
 * Marca un gasto reintegrable como ya cobrado: genera el ingreso compensatorio
 * (categoría "Reintegros") en la misma cuenta y moneda, y suma el monto al saldo.
 */
export async function marcarReintegrado(id: number) {
  return bovedaDB.transaction(
    "rw",
    bovedaDB.transacciones,
    bovedaDB.cuentas,
    async () => {
      const tx = await bovedaDB.transacciones.get(id);
      if (!tx || tx.id == null) throw new Error("Movimiento inexistente.");
      if (!tx.reintegrable || tx.reintegrado) return;

      const cuenta = await bovedaDB.cuentas.get(tx.cuenta_id);
      if (cuenta && cuenta.id != null) {
        await bovedaDB.cuentas.update(cuenta.id, {
          saldo: cuenta.saldo + Math.abs(tx.monto),
        });
      }

      await bovedaDB.transacciones.add({
        cuenta_id: tx.cuenta_id,
        tipo: "ingreso",
        monto: Math.abs(tx.monto),
        moneda: tx.moneda,
        categoria: "Reintegros",
        descripcion: `Reintegro: ${tx.descripcion || "gasto"}`,
        fecha: new Date().toISOString(),
      });

      await bovedaDB.transacciones.update(tx.id, { reintegrado: true });
    },
  );
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

/* -------------------------- Suscripciones -------------------------- */

/**
 * Recorre las suscripciones activas y, si ya pasó el `dia_cobro` del mes en
 * curso y todavía no se generó el cobro de este período, inserta la
 * transacción de egreso y descuenta el saldo de la cuenta.
 * Devuelve las descripciones cobradas para poder notificar con `sonner`.
 */
export async function procesarSuscripcionesVencidas(
  hoy: Date = new Date(),
): Promise<string[]> {
  const periodo = periodoActual(hoy);
  const diaHoy = hoy.getDate();
  const cobradas: string[] = [];

  const activas = await bovedaDB.suscripciones
    .filter((s) => s.activa === true)
    .toArray();

  for (const sus of activas) {
    if (sus.id == null) continue;
    if (sus.ultimo_cobro_periodo === periodo) continue;
    if (diaHoy < sus.dia_cobro) continue;

    await bovedaDB.transaction(
      "rw",
      bovedaDB.suscripciones,
      bovedaDB.cuentas,
      bovedaDB.transacciones,
      async () => {
        const cuenta = await bovedaDB.cuentas.get(sus.cuenta_id);
        if (cuenta && cuenta.id != null) {
          await bovedaDB.cuentas.update(cuenta.id, {
            saldo: cuenta.saldo - Math.abs(sus.monto),
          });
        }
        await bovedaDB.transacciones.add({
          cuenta_id: sus.cuenta_id,
          tipo: "egreso",
          monto: Math.abs(sus.monto),
          moneda: sus.moneda,
          categoria: sus.categoria || "Suscripciones",
          descripcion: `Suscripción: ${sus.descripcion}`,
          fecha: hoy.toISOString(),
        });
        await bovedaDB.suscripciones.update(sus.id!, {
          ultimo_cobro_periodo: periodo,
          last_updated: new Date().toISOString(),
        });
      },
    );
    cobradas.push(sus.descripcion);
  }

  return cobradas;
}

/* -------------------------- Exportación CSV -------------------------- */

/** Escapa un valor para CSV (comillas dobles + separador coma). */
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Convierte toda la tabla `transacciones` de Dexie a texto CSV. */
export async function transaccionesToCSV(): Promise<string> {
  const filas = await bovedaDB.transacciones.orderBy("fecha").toArray();
  const cuentas = await bovedaDB.cuentas.toArray();
  const nombreCuenta = (id: number) =>
    cuentas.find((c) => c.id === id)?.nombre ?? String(id);

  const cabecera = [
    "id",
    "fecha",
    "tipo",
    "categoria",
    "descripcion",
    "monto",
    "moneda",
    "cuenta",
    "reintegrable",
    "reintegrado",
  ];

  const lineas = filas.map((t) =>
    [
      t.id,
      t.fecha,
      t.tipo,
      t.categoria,
      t.descripcion,
      t.monto,
      t.moneda,
      nombreCuenta(t.cuenta_id),
      t.reintegrable ? "sí" : "no",
      t.reintegrado ? "sí" : "no",
    ]
      .map(csvCell)
      .join(","),
  );

  return [cabecera.join(","), ...lineas].join("\n");
}

/* -------------------------- Tarjetas -------------------------- */

function estadoDeuda(total: number, pagado: number): EstadoDeuda {
  if (pagado <= 0) return "pendiente";
  if (pagado >= total) return "pagada";
  return "parcial";
}

/**
 * Suma `monto` al resumen (`deudas_tarjetas`) de un período de una tarjeta,
 * creándolo si todavía no existe. Es el punto único donde cualquier consumo
 * (de una sola vez o una cuota de un plan) impacta el resumen mensual.
 */
async function sumarDeudaPeriodo(tarjeta_id: number, periodo: string, monto: number) {
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
}

/**
 * Registra una compra con tarjeta, en una o varias cuotas. Reparte el monto
 * total (ver `lib/cuotas.ts`) y suma cada parte al período de tarjeta que le
 * corresponde — incluidos los meses futuros, que ya quedan calculados sin
 * necesidad de cargarlos a mano cuando llegue el mes.
 */
export async function registrarCompraTarjeta(params: {
  tarjeta_id: number;
  descripcion: string;
  monto_total: number;
  cuotas_totales: number;
  moneda: Moneda;
  periodo_inicio?: string;
}) {
  const { tarjeta_id, descripcion, monto_total, moneda } = params;
  if (!(monto_total > 0)) throw new Error("El monto debe ser mayor a 0.");
  const cuotas_totales = Math.max(1, Math.floor(params.cuotas_totales) || 1);
  const periodo_inicio = params.periodo_inicio || periodoActual();

  return bovedaDB.transaction(
    "rw",
    bovedaDB.compras_tarjeta,
    bovedaDB.deudas_tarjetas,
    async () => {
      const compra_id = await bovedaDB.compras_tarjeta.add({
        tarjeta_id,
        descripcion: descripcion.trim() || "Compra",
        monto_total,
        cuotas_totales,
        periodo_inicio,
        moneda,
        fecha: new Date().toISOString(),
      });

      for (const slice of calcularCuotas(monto_total, cuotas_totales, periodo_inicio)) {
        await sumarDeudaPeriodo(tarjeta_id, slice.periodo, slice.monto);
      }

      return compra_id;
    },
  );
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

/**
 * Compra o venta de moneda extranjera: mueve dinero real entre dos cuentas
 * propias de distinta moneda, convertido con la cotización indicada. Sale
 * `monto_origen` de `cuenta_origen_id` (en su moneda) y entra el equivalente
 * a `cuenta_destino_id` (en la suya). Si el destino queda en USD, además
 * registra la compra en `inversiones` para no perder el precio promedio.
 */
export async function registrarCambioDivisa(params: {
  cuenta_origen_id: number;
  cuenta_destino_id: number;
  monto_origen: number;
  /** ARS por 1 USD. */
  cotizacion: number;
}) {
  const { cuenta_origen_id, cuenta_destino_id, monto_origen, cotizacion } = params;
  if (cuenta_origen_id === cuenta_destino_id) {
    throw new Error("Elegí dos cuentas distintas.");
  }
  if (!(monto_origen > 0)) throw new Error("El monto debe ser mayor a 0.");
  if (!(cotizacion > 0)) throw new Error("La cotización debe ser mayor a 0.");

  return bovedaDB.transaction(
    "rw",
    bovedaDB.cuentas,
    bovedaDB.transacciones,
    bovedaDB.inversiones,
    async () => {
      const origen = await bovedaDB.cuentas.get(cuenta_origen_id);
      const destino = await bovedaDB.cuentas.get(cuenta_destino_id);
      if (!origen || origen.id == null) throw new Error("Cuenta de origen inexistente.");
      if (!destino || destino.id == null) throw new Error("Cuenta de destino inexistente.");
      if (origen.moneda === destino.moneda) {
        throw new Error("Elegí una cuenta en ARS y otra en USD para convertir.");
      }

      const montoDestino =
        Math.round(
          (origen.moneda === "USD" ? monto_origen * cotizacion : monto_origen / cotizacion) *
            100,
        ) / 100;

      await bovedaDB.cuentas.update(origen.id, { saldo: origen.saldo - monto_origen });
      await bovedaDB.cuentas.update(destino.id, { saldo: destino.saldo + montoDestino });

      const fecha = new Date().toISOString();
      const esCompraUsd = destino.moneda === "USD";
      const descripcion = esCompraUsd
        ? `Compra de USD a $${cotizacion} (${origen.nombre} → ${destino.nombre})`
        : `Venta de USD a $${cotizacion} (${origen.nombre} → ${destino.nombre})`;

      await bovedaDB.transacciones.add({
        cuenta_id: origen.id,
        tipo: "egreso",
        monto: monto_origen,
        moneda: origen.moneda,
        categoria: CATEGORIA_CAMBIO_DIVISA,
        descripcion,
        fecha,
      });
      await bovedaDB.transacciones.add({
        cuenta_id: destino.id,
        tipo: "ingreso",
        monto: montoDestino,
        moneda: destino.moneda,
        categoria: CATEGORIA_CAMBIO_DIVISA,
        descripcion,
        fecha,
      });

      if (esCompraUsd) {
        await bovedaDB.inversiones.add({
          nombre: `Compra USD (${origen.nombre} → ${destino.nombre})`,
          tipo: "Cambio de cuenta",
          capital_inicial: montoDestino,
          moneda: "USD",
          estado: "activa",
          cotizacion_compra: cotizacion,
          costo_ars: monto_origen,
          fecha,
        });
      }

      return { montoDestino };
    },
  );
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
    presupuestos?: unknown[];
    suscripciones?: unknown[];
    metas_ahorro?: unknown[];
    configuracion?: unknown[];
    compras_tarjeta?: unknown[];
  };
}

export async function exportarJSON(): Promise<BackupBoveda> {
  const [
    cuentas,
    transacciones,
    tarjetas,
    deudas_tarjetas,
    inversiones,
    prestamos,
    presupuestos,
    suscripciones,
    metas_ahorro,
    configuracion,
    compras_tarjeta,
  ] = await Promise.all([
    bovedaDB.cuentas.toArray(),
    bovedaDB.transacciones.toArray(),
    bovedaDB.tarjetas.toArray(),
    bovedaDB.deudas_tarjetas.toArray(),
    bovedaDB.inversiones.toArray(),
    bovedaDB.prestamos.toArray(),
    bovedaDB.presupuestos.toArray(),
    bovedaDB.suscripciones.toArray(),
    bovedaDB.metas_ahorro.toArray(),
    bovedaDB.configuracion.toArray(),
    bovedaDB.compras_tarjeta.toArray(),
  ]);

  return {
    __app: "boveda-financiera",
    version: 5,
    exportadoEn: new Date().toISOString(),
    data: {
      cuentas,
      transacciones,
      tarjetas,
      deudas_tarjetas,
      inversiones,
      prestamos,
      presupuestos,
      suscripciones,
      metas_ahorro,
      configuracion,
      compras_tarjeta,
    },
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
      bovedaDB.presupuestos,
      bovedaDB.suscripciones,
      bovedaDB.metas_ahorro,
      bovedaDB.configuracion,
      bovedaDB.compras_tarjeta,
    ],
    async () => {
      await Promise.all([
        bovedaDB.cuentas.clear(),
        bovedaDB.transacciones.clear(),
        bovedaDB.tarjetas.clear(),
        bovedaDB.deudas_tarjetas.clear(),
        bovedaDB.inversiones.clear(),
        bovedaDB.prestamos.clear(),
        bovedaDB.presupuestos.clear(),
        bovedaDB.suscripciones.clear(),
        bovedaDB.metas_ahorro.clear(),
        bovedaDB.configuracion.clear(),
        bovedaDB.compras_tarjeta.clear(),
      ]);
      await Promise.all([
        bovedaDB.cuentas.bulkAdd(data.cuentas as never),
        bovedaDB.transacciones.bulkAdd(data.transacciones as never),
        bovedaDB.tarjetas.bulkAdd(data.tarjetas as never),
        bovedaDB.deudas_tarjetas.bulkAdd(data.deudas_tarjetas as never),
        bovedaDB.inversiones.bulkAdd(data.inversiones as never),
        bovedaDB.prestamos.bulkAdd(data.prestamos as never),
        bovedaDB.presupuestos.bulkAdd((data.presupuestos ?? []) as never),
        bovedaDB.suscripciones.bulkAdd((data.suscripciones ?? []) as never),
        bovedaDB.metas_ahorro.bulkAdd((data.metas_ahorro ?? []) as never),
        bovedaDB.configuracion.bulkAdd((data.configuracion ?? []) as never),
        bovedaDB.compras_tarjeta.bulkAdd((data.compras_tarjeta ?? []) as never),
      ]);
    },
  );
}
