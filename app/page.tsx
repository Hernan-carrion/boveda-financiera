"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Wallet, Banknote } from "lucide-react";
import { bovedaDB } from "@/lib/db";
import { formatMoneda, cn } from "@/lib/utils";
import QuickInput from "@/components/QuickInput";
import TransaccionesRecientes from "@/components/TransaccionesRecientes";
import { Card, SectionTitle } from "@/components/ui";

export default function DashboardPage() {
  const cuentas = useLiveQuery(() => bovedaDB.cuentas.orderBy("nombre").toArray(), []);

  const saldosPorMoneda = (cuentas ?? []).reduce<Record<string, number>>(
    (acc, cuenta) => {
      acc[cuenta.moneda] = (acc[cuenta.moneda] ?? 0) + cuenta.saldo;
      return acc;
    },
    {},
  );

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>Saldos globales</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(saldosPorMoneda).map(([moneda, saldo]) => (
            <Card key={moneda}>
              <div className="flex items-center gap-2 text-zinc-400">
                <Wallet size={16} />
                <span className="text-sm">Total {moneda}</span>
              </div>
              <p
                className={cn(
                  "mt-2 text-2xl font-semibold tabular-nums",
                  saldo >= 0 ? "text-zinc-50" : "text-red-400",
                )}
              >
                {formatMoneda(saldo, moneda as "ARS" | "USD")}
              </p>
            </Card>
          ))}
          {cuentas !== undefined && Object.keys(saldosPorMoneda).length === 0 && (
            <Card className="text-sm text-zinc-500">
              No hay cuentas configuradas todavía.
            </Card>
          )}
          {cuentas === undefined && (
            <Card className="text-sm text-zinc-500">Cargando…</Card>
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Cuentas</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {(cuentas ?? []).map((cuenta) => (
            <div
              key={cuenta.id}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="flex items-center gap-2">
                <Banknote size={16} className="text-zinc-500" />
                <div>
                  <p className="text-sm font-medium text-zinc-200">{cuenta.nombre}</p>
                  <p className="text-xs capitalize text-zinc-500">{cuenta.tipo}</p>
                </div>
              </div>
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  cuenta.saldo >= 0 ? "text-zinc-100" : "text-red-400",
                )}
              >
                {formatMoneda(cuenta.saldo, cuenta.moneda)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Carga rápida</SectionTitle>
        <QuickInput />
      </section>

      <section>
        <SectionTitle>Movimientos recientes</SectionTitle>
        <TransaccionesRecientes />
      </section>
    </div>
  );
}
