/**
 * Entorno de los tests del sync: IndexedDB en memoria (fake-indexeddb) para
 * que Dexie funcione en Node, y un localStorage mínimo (el sync guarda ahí el
 * saldo base y la cola offline). Hay que importarlo ANTES que lib/db.ts.
 */
import "fake-indexeddb/auto";

const almacen = new Map<string, string>();

(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (clave: string) => almacen.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void almacen.set(clave, String(valor)),
    removeItem: (clave: string) => void almacen.delete(clave),
  },
};

export function vaciarLocalStorage(): void {
  almacen.clear();
}
