import "./test-support/entorno";
import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { bovedaDB, onEscrituraLocal } from "./db";
import { NubeFalsa, type Fila } from "./test-support/nubeFalsa";
import { vaciarLocalStorage } from "./test-support/entorno";
import { __usarSupabaseDePrueba, pullFromCloud, pushToCloud } from "./syncService";

/**
 * Tests del motor de sync de punta a punta: la base real (Dexie con sus
 * hooks, sobre IndexedDB en memoria) y el `syncService` real contra una nube
 * falsa. Los timestamps de las filas "de la nube" se eligen lejos en el
 * pasado/futuro para no depender del reloj.
 */

const EPOCA = "1970-01-01T00:00:00.000Z";
const VIEJO = "2000-01-01T00:00:00.000Z";
const FUTURO = "2099-01-01T00:00:00.000Z";
const esperar = (ms = 25) => new Promise((r) => setTimeout(r, ms));

let nube: NubeFalsa;

beforeEach(async () => {
  vaciarLocalStorage();
  await bovedaDB.delete();
  await bovedaDB.open();
  nube = new NubeFalsa();
  __usarSupabaseDePrueba(nube);
});

/** Las 3 cuentas por defecto tal como las tendría la nube, con Mercado Pago a `saldoMP`. */
const cuentasNube = (saldoMP: number, sello: string): Fila[] => [
  { id: 1, nombre: "Efectivo Pesos", tipo: "efectivo", moneda: "ARS", saldo: 0, last_updated: EPOCA },
  { id: 2, nombre: "Mercado Pago", tipo: "digital", moneda: "ARS", saldo: saldoMP, last_updated: sello },
  { id: 3, nombre: "Efectivo Dólares", tipo: "efectivo", moneda: "USD", saldo: 0, last_updated: EPOCA },
];

const gasto = (monto: number) => ({
  cuenta_id: 2,
  tipo: "egreso" as const,
  monto,
  moneda: "ARS" as const,
  categoria: "Sin categoría",
  descripcion: `gasto ${monto}`,
  fecha: new Date().toISOString(),
});

const agregar = async (datos: Omit<ReturnType<typeof gasto>, "tipo"> & { tipo: "ingreso" | "egreso" }): Promise<number> => Number(await bovedaDB.transacciones.add(datos));

const saldoLocalMP = async () => (await bovedaDB.cuentas.get(2))?.saldo;

describe("escrituras locales (hooks de la base)", () => {
  test("una fila nueva recibe last_updated y un id único entre dispositivos", async () => {
    const id = await agregar(gasto(100));
    const fila = await bovedaDB.transacciones.get(id);
    assert.ok(id > 1e12, `id esperado grande, fue ${id}`);
    assert.ok(fila?.last_updated && fila.last_updated > "2026-01-01", "debe tener last_updated");
  });

  test("cambiar un saldo sella last_updated (antes no pasaba)", async () => {
    const antes = (await bovedaDB.cuentas.get(2))?.last_updated;
    assert.equal(antes, EPOCA);
    await bovedaDB.cuentas.update(2, { saldo: 500 });
    const despues = (await bovedaDB.cuentas.get(2))?.last_updated;
    assert.ok(despues && despues > "2026-01-01");
  });

  test("las cuentas por defecto tienen ids 1-3 y sello de época", async () => {
    const cuentas = await bovedaDB.cuentas.orderBy("id").toArray();
    assert.deepEqual(cuentas.map((c) => [c.id, c.last_updated]), [
      [1, EPOCA],
      [2, EPOCA],
      [3, EPOCA],
    ]);
  });

  test("dos filas creadas seguidas no repiten id", async () => {
    const ids = new Set<number>();
    for (let i = 0; i < 50; i++) ids.add(await agregar(gasto(i + 1)));
    assert.equal(ids.size, 50);
  });
});

describe("push", () => {
  test("sube lo nuevo y un segundo push no vuelve a subir nada", async () => {
    await bovedaDB.transacciones.add(gasto(100));
    await bovedaDB.transacciones.add(gasto(200));

    const r1 = await pushToCloud();
    assert.ok(r1.ok, r1.detail);
    assert.equal(nube.filas("transacciones").length, 2);

    const antes = nube.upsertsEn("transacciones");
    const r2 = await pushToCloud();
    assert.ok(r2.ok);
    assert.equal(nube.upsertsEn("transacciones"), antes, "no debería haber subido nada");
  });

  test("una fila vieja del dispositivo no pisa a una más nueva de la nube", async () => {
    nube.sembrar("transacciones", [{ id: 500, descripcion: "versión nueva", last_updated: FUTURO }]);
    await bovedaDB.transacciones.put({ ...gasto(1), id: 500, descripcion: "versión vieja", last_updated: VIEJO });

    await pushToCloud();
    assert.equal(nube.fila("transacciones", 500)?.descripcion, "versión nueva");
  });

  test("una fila más nueva del dispositivo sí pisa a la de la nube", async () => {
    nube.sembrar("transacciones", [{ id: 500, descripcion: "de la nube", last_updated: VIEJO }]);
    await bovedaDB.transacciones.put({ ...gasto(1), id: 500, descripcion: "editada acá", last_updated: FUTURO });

    await pushToCloud();
    assert.equal(nube.fila("transacciones", 500)?.descripcion, "editada acá");
  });

  test("un dispositivo nuevo (cuentas por defecto) no pisa las cuentas reales de la nube", async () => {
    nube.sembrar("cuentas", cuentasNube(25388, "2026-10-13T10:00:00.000Z"));
    await pushToCloud(); // aunque haga push antes de bajar nada
    assert.equal(nube.fila("cuentas", 2)?.saldo, 25388);
  });

  test("si la nube no responde, no se pierde nada local y se informa", async () => {
    await bovedaDB.transacciones.add(gasto(100));
    nube.falloDeRed = true;
    const r = await pushToCloud();
    assert.equal(r.ok, false);
    assert.equal(await bovedaDB.transacciones.count(), 1);
    nube.falloDeRed = false;
    assert.ok((await pushToCloud()).ok);
    assert.equal(nube.filas("transacciones").length, 1, "al volver la red se sube");
  });

  test("una fila rechazada por la nube no frena a las demás de la tabla", async () => {
    const malo = await agregar({ ...gasto(666), descripcion: "rechazada" });
    await bovedaDB.transacciones.add(gasto(1));
    await bovedaDB.transacciones.add(gasto(2));
    nube.rechazarSi((t, f) => (t === "transacciones" && f.id === malo ? "violación de restricción" : null));

    const r = await pushToCloud();
    assert.equal(r.ok, false);
    assert.match(r.detail ?? "", /violación de restricción/);
    assert.equal(nube.filas("transacciones").length, 2, "las otras dos sí se subieron");
  });
});

describe("pull", () => {
  test("aplica lo más nuevo de la nube conservando su timestamp, y deja lo local más nuevo", async () => {
    await bovedaDB.transacciones.put({ ...gasto(1), id: 10, descripcion: "local viejo", last_updated: VIEJO });
    await bovedaDB.transacciones.put({ ...gasto(2), id: 20, descripcion: "local nuevo", last_updated: FUTURO });
    nube.sembrar("transacciones", [
      { id: 10, descripcion: "nube nueva", last_updated: "2026-10-13T10:00:00.000Z" },
      { id: 20, descripcion: "nube vieja", last_updated: "2026-10-13T10:00:00.000Z" },
      { id: 30, descripcion: "sólo en la nube", last_updated: "2026-10-13T10:00:00.000Z" },
    ]);

    const r = await pullFromCloud();
    assert.ok(r.ok, r.detail);
    const d10 = await bovedaDB.transacciones.get(10);
    assert.equal(d10?.descripcion, "nube nueva");
    assert.equal(d10?.last_updated, "2026-10-13T10:00:00.000Z", "no se re-sella con la hora de hoy");
    assert.equal((await bovedaDB.transacciones.get(20))?.descripcion, "local nuevo");
    assert.equal((await bovedaDB.transacciones.get(30))?.descripcion, "sólo en la nube");
  });

  test("lo que baja la nube NO dispara el auto-push, pero una escritura local sí", async () => {
    let avisos = 0;
    const quitar = onEscrituraLocal(() => void (avisos += 1));
    nube.sembrar("transacciones", [{ id: 30, descripcion: "x", last_updated: "2026-10-13T10:00:00.000Z" }]);

    await pullFromCloud();
    await esperar();
    assert.equal(avisos, 0, "el pull no debe disparar push");

    await bovedaDB.transacciones.add(gasto(5));
    await esperar();
    assert.ok(avisos > 0, "una escritura local sí");
    quitar();
  });

  test("baja más de 1000 filas (la nube pagina)", async () => {
    const filas: Fila[] = Array.from({ length: 2500 }, (_, i) => ({
      id: i + 1,
      cuenta_id: 2,
      tipo: "egreso",
      monto: 1,
      moneda: "ARS",
      categoria: "x",
      descripcion: `m${i}`,
      fecha: "2026-10-01T00:00:00.000Z",
      last_updated: "2026-10-13T10:00:00.000Z",
    }));
    nube.sembrar("transacciones", filas);

    const r = await pullFromCloud();
    assert.ok(r.ok, r.detail);
    assert.equal(await bovedaDB.transacciones.count(), 2500);
  });

  test("pull forzado reemplaza lo local por lo de la nube", async () => {
    await bovedaDB.transacciones.put({ ...gasto(1), id: 10, descripcion: "local más nuevo", last_updated: FUTURO });
    nube.sembrar("transacciones", [{ id: 10, descripcion: "de la nube", last_updated: VIEJO }]);

    await pullFromCloud({ forzar: true });
    assert.equal((await bovedaDB.transacciones.get(10))?.descripcion, "de la nube");
  });

  test("una fila que choca con un índice único no frena a las demás", async () => {
    await bovedaDB.dias_trabajados.add({ fecha: "2026-10-05", turno: "completo", monto: 40000 });
    nube.sembrar("dias_trabajados", [
      { id: 111, fecha: "2026-10-05", turno: "medio", monto: 20000, last_updated: FUTURO }, // misma fecha, otro id
      { id: 222, fecha: "2026-10-06", turno: "completo", monto: 40000, last_updated: FUTURO },
    ]);

    const r = await pullFromCloud();
    assert.equal(r.ok, false);
    assert.match(r.detail ?? "", /dias_trabajados/);
    assert.ok(await bovedaDB.dias_trabajados.get(222), "la fila sin conflicto sí se aplicó");
  });

  test("empate de timestamp con contenido distinto lo gana la nube (cuenta con saldo viejo)", async () => {
    await bovedaDB.cuentas.update(2, { saldo: 100, last_updated: "2026-09-11T03:02:46.403Z" });
    nube.sembrar("cuentas", cuentasNube(200, "2026-09-11T03:02:46.403Z"));

    await pullFromCloud();
    assert.equal(await saldoLocalMP(), 200);
  });
});

describe("saldos de cuentas", () => {
  /** Deja local y nube de acuerdo en Mercado Pago = `saldo` (y registra ese saldo como base). */
  async function sincronizadoEn(saldo: number) {
    nube.sembrar("cuentas", cuentasNube(saldo, "2026-10-13T10:00:00.000Z"));
    const r = await pullFromCloud();
    assert.ok(r.ok, r.detail);
    assert.equal(await saldoLocalMP(), saldo);
  }

  test("sólo cambió la nube: el dispositivo toma el saldo nuevo", async () => {
    await sincronizadoEn(100);
    nube.sembrar("cuentas", [{ ...cuentasNube(150, FUTURO)[1] }]);

    await pullFromCloud();
    assert.equal(await saldoLocalMP(), 150);
  });

  test("sólo cambió el dispositivo: sube su saldo", async () => {
    await sincronizadoEn(100);
    await bovedaDB.cuentas.update(2, { saldo: 130 });

    await pushToCloud();
    assert.equal(nube.fila("cuentas", 2)?.saldo, 130);
  });

  test("INCIDENTE REAL: el sueldo cargado en otro dispositivo no se pierde", async () => {
    await sincronizadoEn(25388); // el celu estaba al día: Mercado Pago $25.388

    // Otro dispositivo carga un sueldo de +$37.500 (la nube queda en $62.888).
    nube.sembrar("cuentas", [{ ...cuentasNube(62888, FUTURO)[1] }]);
    nube.sembrar("transacciones", [
      { id: 108, cuenta_id: 2, tipo: "ingreso", monto: 37500, moneda: "ARS", categoria: "Sueldo", descripcion: "Cobro de sueldo", fecha: "2026-10-13T14:17:00.000Z", last_updated: FUTURO },
    ]);

    // El celu, todavía desactualizado, corrige un movimiento (+$1.800) sobre su saldo viejo.
    await bovedaDB.cuentas.update(2, { saldo: 25388 + 1800 });
    const idPropio = await agregar({ ...gasto(1800), tipo: "ingreso", descripcion: "corrección" });

    const r = await pushToCloud();
    assert.ok(r.ok, r.detail);
    assert.equal(r.conflictos, 1);

    // Se conservan los DOS cambios, y los dos movimientos.
    assert.equal(nube.fila("cuentas", 2)?.saldo, 64688);
    assert.equal(await saldoLocalMP(), 64688);
    assert.ok(nube.fila("transacciones", 108), "el sueldo sigue en la nube");
    assert.ok(nube.fila("transacciones", idPropio), "el movimiento del celu también");

    // Y después de bajar lo del otro dispositivo, todo coincide y no hay más para subir.
    await pullFromCloud();
    assert.ok(await bovedaDB.transacciones.get(108), "el celu recibe el sueldo");
    const antes = nube.upsertsEn("cuentas");
    await pushToCloud();
    assert.equal(nube.upsertsEn("cuentas"), antes, "converge: no hay nada nuevo para subir");
    assert.equal(nube.fila("cuentas", 2)?.saldo, 64688);
  });

  test("el mismo conflicto, resuelto durante un pull, también conserva los dos cambios", async () => {
    await sincronizadoEn(25388);
    nube.sembrar("cuentas", [{ ...cuentasNube(62888, FUTURO)[1] }]);
    await bovedaDB.cuentas.update(2, { saldo: 27188 });

    const r = await pullFromCloud();
    assert.equal(r.conflictos, 1);
    assert.equal(await saldoLocalMP(), 64688);

    await pushToCloud();
    assert.equal(nube.fila("cuentas", 2)?.saldo, 64688);
  });

  test("si el push falla justo después de conciliar, al reintentar no se suma dos veces", async () => {
    await sincronizadoEn(25388);
    nube.sembrar("cuentas", [{ ...cuentasNube(62888, FUTURO)[1] }]);
    await bovedaDB.cuentas.update(2, { saldo: 27188 });

    let rechazar = true;
    nube.rechazarSi((t) => (t === "cuentas" && rechazar ? "falló la red" : null));
    const fallido = await pushToCloud();
    assert.equal(fallido.ok, false);
    assert.equal(nube.fila("cuentas", 2)?.saldo, 62888, "la nube sigue igual");

    rechazar = false;
    await pushToCloud();
    assert.equal(nube.fila("cuentas", 2)?.saldo, 64688, "se suma una sola vez (no 102.188)");
    assert.equal(await saldoLocalMP(), 64688);
  });

  test("dos cambios seguidos del dispositivo entre syncs se suben tal cual", async () => {
    await sincronizadoEn(1000);
    await bovedaDB.cuentas.update(2, { saldo: 900 });
    await bovedaDB.cuentas.update(2, { saldo: 850 });
    await pushToCloud();
    assert.equal(nube.fila("cuentas", 2)?.saldo, 850);
  });
});
