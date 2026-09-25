"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bell, Plus } from "lucide-react";
import { bovedaDB, type Recordatorio, type RepeticionRecordatorio } from "@/lib/db";
import { crearRecordatorio } from "@/lib/actions";
import { CATEGORIAS_RECORDATORIO, TIPOS_DOCUMENTO, diasHasta } from "@/lib/recordatorios";
import { cn } from "@/lib/utils";
import EditarRecordatorioModal from "@/components/EditarRecordatorioModal";
import { Card, SectionTitle, Field, EmptyState, inputCls, btnCls } from "@/components/ui";

const REPETIR_LABEL: Record<RepeticionRecordatorio, string> = {
  ninguna: "No se repite",
  mensual: "Cada mes",
  anual: "Cada año",
};

export default function RecordatoriosPage() {
  const recordatorios = useLiveQuery(
    () => bovedaDB.recordatorios.filter((r) => !r.eliminado).toArray(),
    [],
  );

  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [editando, setEditando] = useState<Recordatorio | null>(null);

  const ordenados = useMemo(() => {
    const lista = (recordatorios ?? []).filter((r) => {
      if (filtroCategoria && r.categoria !== filtroCategoria) return false;
      return true;
    });
    return [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [recordatorios, filtroCategoria]);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Filtros</SectionTitle>
        <Card className="grid gap-3 sm:grid-cols-3">
          <Field label="Categoría">
            <select
              className={inputCls}
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            >
              <option value="">Todas</option>
              {CATEGORIAS_RECORDATORIO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </Card>
      </section>

      <section>
        <SectionTitle>Nuevo recordatorio</SectionTitle>
        <NuevoRecordatorioForm />
      </section>

      <section>
        <SectionTitle>{`Recordatorios (${ordenados.length})`}</SectionTitle>
        {recordatorios === undefined ? (
          <p className="text-sm text-zinc-500">Cargando…</p>
        ) : ordenados.length === 0 ? (
          <EmptyState>Todavía no cargaste recordatorios.</EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
            {ordenados.map((r) => {
              const dias = diasHasta(r.fecha);
              const vencido = dias < 0 && r.repetir === "ninguna";
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setEditando(r)}
                    className={cn(
                      "flex w-full flex-wrap items-center gap-x-4 gap-y-1 bg-zinc-900/40 px-4 py-3 text-left transition-colors hover:bg-zinc-800/40",
                      !r.activo && "opacity-50",
                    )}
                  >
                    <Bell size={16} className="shrink-0 text-zinc-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">{r.titulo}</p>
                      <p className="text-xs text-zinc-500">
                        {r.categoria}
                        {r.repetir !== "ninguna" && <> · {REPETIR_LABEL[r.repetir]}</>}
                        {!r.activo && <> · pausado</>}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        vencido
                          ? "text-red-400"
                          : dias <= r.dias_aviso
                            ? "text-amber-400"
                            : "text-zinc-400",
                      )}
                    >
                      {vencido
                        ? "venció"
                        : dias === 0
                          ? "hoy"
                          : dias > 0
                            ? `en ${dias}d`
                            : "venció"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <EditarRecordatorioModal recordatorio={editando} onClose={() => setEditando(null)} />
    </div>
  );
}

function NuevoRecordatorioForm() {
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_RECORDATORIO[0]);
  const [fecha, setFecha] = useState("");
  const [repetir, setRepetir] = useState<RepeticionRecordatorio>("ninguna");
  const [diasAviso, setDiasAviso] = useState("2");
  const [msg, setMsg] = useState<string | null>(null);

  const esDocumento = categoria === "Documento";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await crearRecordatorio({
        titulo,
        categoria,
        fecha,
        repetir,
        dias_aviso: Math.max(0, Number(diasAviso) || 0),
      });
      setTitulo("");
      setFecha("");
      setRepetir("ninguna");
      setDiasAviso("2");
      setMsg("Recordatorio creado ✓");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo crear.");
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <Field label="Categoría">
            <select
              className={inputCls}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {CATEGORIAS_RECORDATORIO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <Field label="Título">
            {esDocumento ? (
              <input
                className={inputCls}
                list="tipos-documento"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="DNI, Seguro del auto, VTV…"
              />
            ) : (
              <input
                className={inputCls}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Turno médico, cumpleaños…"
              />
            )}
            <datalist id="tipos-documento">
              {TIPOS_DOCUMENTO.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="Fecha">
          <input
            type="date"
            className={inputCls}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </Field>
        <Field label="Se repite">
          <select
            className={inputCls}
            value={repetir}
            onChange={(e) => setRepetir(e.target.value as RepeticionRecordatorio)}
          >
            <option value="ninguna">No</option>
            <option value="mensual">Cada mes</option>
            <option value="anual">Cada año</option>
          </select>
        </Field>
        <Field label="Avisar con (días)">
          <input
            type="number"
            min={0}
            max={60}
            className={inputCls}
            value={diasAviso}
            onChange={(e) => setDiasAviso(e.target.value)}
          />
        </Field>
        <div className="flex items-end">
          <button type="submit" className={btnCls}>
            <Plus size={16} />
            Crear
          </button>
        </div>
      </form>
      {msg && <p className="mt-3 text-xs text-zinc-400">{msg}</p>}
    </Card>
  );
}
