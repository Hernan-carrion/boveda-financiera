"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Upload, Plus, RefreshCw } from "lucide-react";
import { bovedaDB, type Moneda, type TipoCuenta } from "@/lib/db";
import { exportarJSON, importarJSON, type BackupBoveda } from "@/lib/actions";
import { formatMoneda } from "@/lib/utils";
import {
  Card,
  SectionTitle,
  Field,
  inputCls,
  btnCls,
  btnGhostCls,
} from "@/components/ui";

export default function ConfiguracionPage() {
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.orderBy("nombre").toArray(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleExport() {
    const backup = await exportarJSON();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boveda-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMsg("Backup exportado ✓");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const backup = JSON.parse(texto) as BackupBoveda;
      await importarJSON(backup);
      setMsg("Backup importado ✓ — recargando…");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo importar el archivo.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function reiniciar() {
    if (!window.confirm("Esto borra TODOS los datos locales. ¿Continuar?")) return;
    await bovedaDB.delete();
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Backup local</SectionTitle>
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-zinc-400">
            Todo vive en este dispositivo (IndexedDB). Exportá un JSON para
            respaldar o mover tus datos; al importar se <strong>sobrescribe</strong>{" "}
            todo lo actual.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleExport} className={btnCls}>
              <Download size={16} />
              Exportar JSON
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className={btnGhostCls}
            >
              <Upload size={16} />
              Importar JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />
            <button onClick={reiniciar} className={btnGhostCls}>
              <RefreshCw size={16} />
              Reiniciar datos
            </button>
          </div>
          {msg && <p className="text-xs text-zinc-400">{msg}</p>}
        </Card>
      </section>

      <section>
        <SectionTitle>Cuentas</SectionTitle>
        <div className="flex flex-col gap-3">
          {(cuentas ?? []).map((c) => (
            <AjusteSaldoRow
              key={c.id}
              cuenta={c}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Nueva cuenta</SectionTitle>
        <NuevaCuentaForm />
      </section>
    </div>
  );
}

function AjusteSaldoRow({
  cuenta,
}: {
  cuenta: { id?: number; nombre: string; moneda: Moneda; saldo: number };
}) {
  const [valor, setValor] = useState(String(cuenta.saldo));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (cuenta.id == null) return;
    await bovedaDB.cuentas.update(cuenta.id, { saldo: Number(valor) || 0 });
  }

  return (
    <Card className="flex flex-wrap items-center gap-3">
      <div className="min-w-40">
        <p className="text-sm font-medium text-zinc-200">{cuenta.nombre}</p>
        <p className="text-xs text-zinc-500">
          Actual: {formatMoneda(cuenta.saldo, cuenta.moneda)}
        </p>
      </div>
      <form onSubmit={guardar} className="ml-auto flex items-center gap-2">
        <input
          type="number"
          className={`${inputCls} w-40`}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
        <button type="submit" className={btnGhostCls}>
          Ajustar saldo
        </button>
      </form>
    </Card>
  );
}

function NuevaCuentaForm() {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoCuenta>("efectivo");
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [saldo, setSaldo] = useState("0");
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setMsg("Poné un nombre.");
      return;
    }
    await bovedaDB.cuentas.add({
      nombre: nombre.trim(),
      tipo,
      moneda,
      saldo: Number(saldo) || 0,
    });
    setNombre("");
    setSaldo("0");
    setMsg("Cuenta creada ✓");
  }

  return (
    <Card>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nombre">
          <input
            className={inputCls}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Caja de ahorro"
          />
        </Field>
        <Field label="Tipo">
          <select
            className={inputCls}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCuenta)}
          >
            <option value="efectivo">Efectivo</option>
            <option value="digital">Digital</option>
            <option value="banco">Banco</option>
          </select>
        </Field>
        <Field label="Moneda">
          <select
            className={inputCls}
            value={moneda}
            onChange={(e) => setMoneda(e.target.value as Moneda)}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </Field>
        <Field label="Saldo inicial">
          <input
            type="number"
            className={inputCls}
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
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
