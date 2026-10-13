import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filasAPullear,
  filasAPushear,
  filasIguales,
  resolverSaldo,
  type FilaSync,
} from "./syncMerge.ts";

const fila = (id: number, last_updated: string | null, extra: Record<string, unknown> = {}): FilaSync => ({
  id,
  last_updated,
  ...extra,
});
const mapa = (...filas: FilaSync[]) => new Map(filas.map((f) => [f.id as number, f]));

test("pull: aplica filas nuevas y más nuevas, ignora las más viejas", () => {
  const locales = mapa(fila(1, "2026-10-13T10:00:00Z"), fila(2, "2026-10-13T12:00:00Z"));
  const nube = [
    fila(1, "2026-10-13T11:00:00Z"), // nube más nueva
    fila(2, "2026-10-13T09:00:00Z"), // nube más vieja: el dispositivo tiene un cambio sin subir
    fila(3, "2026-10-13T08:00:00Z"), // no existe acá
  ];
  assert.deepEqual(filasAPullear(locales, nube).map((f) => f.id), [1, 3]);
});

test("pull: empate de timestamp con contenido distinto lo gana la nube; idéntico no se reescribe", () => {
  const locales = mapa(fila(1, "T", { saldo: 10 }), fila(2, "T", { saldo: 5 }));
  const nube = [fila(1, "T", { saldo: 99 }), fila(2, "T", { saldo: 5 })];
  assert.deepEqual(filasAPullear(locales, nube).map((f) => f.id), [1]);
});

test("pull forzado aplica todo", () => {
  const locales = mapa(fila(1, "2026-10-13T12:00:00Z"));
  assert.equal(filasAPullear(locales, [fila(1, "2026-10-13T09:00:00Z")], true).length, 1);
});

test("push: sólo sube lo que no está en la nube o es estrictamente más nuevo", () => {
  const nube = new Map<number, string | null>([
    [1, "2026-10-13T10:00:00Z"],
    [2, "2026-10-13T10:00:00Z"],
    [3, "2026-10-13T10:00:00Z"],
  ]);
  const locales = [
    fila(1, "2026-10-13T09:00:00Z"), // vieja: no pisa a la nube
    fila(2, "2026-10-13T10:00:00Z"), // empate: no se sube
    fila(3, "2026-10-13T11:00:00Z"), // nueva
    fila(4, "2026-10-01T00:00:00Z"), // no existe en la nube
  ];
  assert.deepEqual(filasAPushear(locales, nube).map((f) => f.id), [3, 4]);
});

test("push: una fila sin timestamp sólo se sube si la nube no la tiene", () => {
  const nube = new Map<number, string | null>([[1, "2026-10-13T10:00:00Z"]]);
  assert.deepEqual(filasAPushear([fila(1, null), fila(2, null)], nube).map((f) => f.id), [2]);
});

test("filasIguales ignora el orden de claves y los null/undefined", () => {
  assert.ok(filasIguales({ id: 1, a: 1, b: 2 }, { b: 2, id: 1, a: 1, c: null }));
  assert.ok(!filasIguales({ id: 1, a: 1 }, { id: 1, a: 2 }));
});

test("saldo: sin diferencias no hace nada", () => {
  assert.deepEqual(resolverSaldo(100, 100, 50), { saldo: 100, accion: "nada" });
});

test("saldo: sólo cambió la nube -> bajar", () => {
  assert.deepEqual(resolverSaldo(100, 150, 100), { saldo: 150, accion: "bajar" });
});

test("saldo: sólo cambió el dispositivo -> subir", () => {
  assert.deepEqual(resolverSaldo(130, 100, 100), { saldo: 130, accion: "subir" });
});

test("saldo: sin punto en común conocido se decide por fecha", () => {
  assert.equal(resolverSaldo(130, 100, undefined).accion, "fecha");
});

test("saldo: caso real de Mercado Pago — el sueldo cargado en otro dispositivo no se pierde", () => {
  // El celu estaba desactualizado: base $25.388 (lo último que sincronizó).
  // Otro dispositivo cargó un sueldo de +$37.500 -> nube $62.888.
  // El celu corrige la devolución a Daniel (+$1.800) sobre su saldo viejo -> $27.188.
  const r = resolverSaldo(27188, 62888, 25388);
  assert.equal(r.accion, "ambos");
  assert.equal(r.saldo, 64688); // 62.888 + 1.800: se conservan los dos cambios

  // Después elimina el movimiento (+$200): ya sincronizó, la base es $64.688.
  assert.deepEqual(resolverSaldo(64888, 64688, 64688), { saldo: 64888, accion: "subir" });
});

test("saldo: redondea a centavos", () => {
  assert.equal(resolverSaldo(100.1, 200.2, 100).saldo, 200.3);
});
