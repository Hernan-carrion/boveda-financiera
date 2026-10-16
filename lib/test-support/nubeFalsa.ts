/**
 * Nube falsa para los tests: imita lo que el sync usa de supabase-js
 * (`from(t).select(cols).order().range()` y `from(t).upsert()`), con la misma
 * semántica de PostgREST — el upsert fusiona por `id` y un lote es atómico:
 * si una fila es rechazada, no se aplica ninguna.
 */
export type Fila = Record<string, unknown> & { id: number };

export class NubeFalsa {
  private tablas = new Map<string, Map<number, Fila>>();
  private rechazos: ((tabla: string, fila: Fila) => string | null)[] = [];
  readonly upserts: { tabla: string; ids: number[] }[] = [];
  falloDeRed = false;

  sembrar(tabla: string, filas: Fila[]): void {
    for (const f of filas) this.tabla(tabla).set(f.id, { ...f });
  }

  filas(tabla: string): Fila[] {
    return [...this.tabla(tabla).values()].sort((a, b) => a.id - b.id);
  }

  fila(tabla: string, id: number): Fila | undefined {
    return this.tabla(tabla).get(id);
  }

  /** Rechaza el upsert de las filas para las que `regla` devuelva un mensaje de error. */
  rechazarSi(regla: (tabla: string, fila: Fila) => string | null): void {
    this.rechazos.push(regla);
  }

  upsertsEn(tabla: string): number {
    return this.upserts.filter((u) => u.tabla === tabla).reduce((n, u) => n + u.ids.length, 0);
  }

  private tabla(nombre: string): Map<number, Fila> {
    let t = this.tablas.get(nombre);
    if (!t) {
      t = new Map();
      this.tablas.set(nombre, t);
    }
    return t;
  }

  from(tabla: string) {
    return {
      select: (columnas: string) => ({
        order: () => ({
          range: async (desde: number, hasta: number) => {
            if (this.falloDeRed) return { data: null, error: { message: "Failed to fetch" } };
            let filas: Record<string, unknown>[] = this.filas(tabla).slice(desde, hasta + 1);
            if (columnas !== "*") {
              const cols = columnas.split(",");
              filas = filas.map((f) => Object.fromEntries(cols.map((c) => [c, f[c] ?? null])));
            }
            return { data: filas, error: null };
          },
        }),
      }),
      upsert: async (cuerpo: Fila | Fila[]) => {
        if (this.falloDeRed) return { error: { message: "Failed to fetch" } };
        const lote = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
        for (const fila of lote) {
          for (const regla of this.rechazos) {
            const motivo = regla(tabla, fila);
            if (motivo) return { error: { message: motivo } };
          }
        }
        const t = this.tabla(tabla);
        for (const fila of lote) t.set(fila.id, { ...(t.get(fila.id) ?? {}), ...fila });
        this.upserts.push({ tabla, ids: lote.map((f) => f.id) });
        return { error: null };
      },
    };
  }
}
