"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Pencil, Pin, PinOff, Plus, Trash2, X, Check } from "lucide-react";
import { bovedaDB, type Nota } from "@/lib/db";
import { crearNota, actualizarNota, fijarNota, borrarNota } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Card, SectionTitle, EmptyState, inputCls, btnCls } from "@/components/ui";

export default function NotasPage() {
  const notas = useLiveQuery(
    () => bovedaDB.notas.filter((n) => !n.eliminado).toArray(),
    [],
  );

  const ordenadas = useMemo(() => {
    return [...(notas ?? [])].sort((a, b) => {
      if (a.fijada !== b.fijada) return a.fijada ? -1 : 1;
      return (b.id ?? 0) - (a.id ?? 0);
    });
  }, [notas]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Nueva nota</SectionTitle>
        <NuevaNotaForm />
      </section>

      <section>
        <SectionTitle>{`Notas (${ordenadas.length})`}</SectionTitle>
        {notas === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : ordenadas.length === 0 ? (
          <EmptyState>Todavía no cargaste notas.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {ordenadas.map((n) => (
              <NotaCard key={n.id} nota={n} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NuevaNotaForm() {
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await crearNota(texto);
      setTexto("");
      setMsg(null);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo crear.");
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <textarea
          className={cn(inputCls, "sm:flex-1")}
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Lista del súper, una idea suelta, lo que sea…"
        />
        <button type="submit" className={cn(btnCls, "sm:self-start")}>
          <Plus size={16} />
          Agregar
        </button>
      </form>
      {msg && <p className="mt-2 text-xs text-red-400">{msg}</p>}
    </Card>
  );
}

function NotaCard({ nota }: { nota: Nota }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota.texto);
  const [msg, setMsg] = useState<string | null>(null);

  async function guardar() {
    if (nota.id == null) return;
    try {
      await actualizarNota(nota.id, texto);
      setEditando(false);
      setMsg(null);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  async function eliminar() {
    if (nota.id == null) return;
    if (!window.confirm("¿Eliminar esta nota?")) return;
    await borrarNota(nota.id);
  }

  if (editando) {
    return (
      <Card className="flex flex-col gap-2">
        <textarea
          className={inputCls}
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus
        />
        {msg && <p className="text-xs text-red-400">{msg}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setTexto(nota.texto);
              setEditando(false);
              setMsg(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            <X size={14} />
            Cancelar
          </button>
          <button type="button" onClick={guardar} className={btnCls}>
            <Check size={14} />
            Guardar
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2">
      <p className="whitespace-pre-wrap text-sm text-zinc-200">{nota.texto}</p>
      <div className="mt-1 flex items-center justify-end gap-1 text-zinc-500">
        <button
          type="button"
          onClick={() => nota.id != null && fijarNota(nota.id, !nota.fijada)}
          aria-label={nota.fijada ? "Desfijar" : "Fijar"}
          className={cn(
            "rounded-lg p-1.5 transition-colors hover:bg-white/5",
            nota.fijada ? "text-amber-400" : "hover:text-zinc-200",
          )}
        >
          {nota.fijada ? <Pin size={14} /> : <PinOff size={14} />}
        </button>
        <button
          type="button"
          onClick={() => setEditando(true)}
          aria-label="Editar"
          className="rounded-lg p-1.5 transition-colors hover:bg-white/5 hover:text-zinc-200"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={eliminar}
          aria-label="Eliminar"
          className="rounded-lg p-1.5 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  );
}
