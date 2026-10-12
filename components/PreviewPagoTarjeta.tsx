"use client";

import Link from "next/link";
import type { Suscripcion } from "@/lib/db";
import type { FilaPreviewPago } from "@/lib/reintegroTarjeta";
import { formatMoneda } from "@/lib/utils";
import { Card, EmptyState, inlineLinkCls } from "@/components/ui";

const PERIODOS_VISIBLES = 3;

/**
 * Vista previa (no guarda nada) del pago real de la tarjeta: el resumen
 * pendiente de cada período menos las suscripciones que te reintegran. Las
 * suscripciones siguen activas y se siguen debitando de tu cuenta; esto sólo
 * te dice cuánto menos le tenés que dar a quien te las compensa.
 */
export default function PreviewPagoTarjeta({
  descontables,
  filas,
}: {
  descontables: Suscripcion[];
  filas: FilaPreviewPago[];
}) {
  if (descontables.length === 0) {
    return (
      <EmptyState>
        Marcá en{" "}
        <Link href="/suscripciones" prefetch={false} className={inlineLinkCls}>
          Suscripciones
        </Link>{" "}
        cuáles te reintegran y acá vas a ver el total de la tarjeta menos esas
        suscripciones.
      </EmptyState>
    );
  }

  const visibles = filas.slice(0, PERIODOS_VISIBLES);
  const resto = filas.slice(PERIODOS_VISIBLES);

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-subtle">
          Suscripciones que se descuentan cada mes (siguen activas y se debitan
          de tu cuenta como siempre):
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {descontables.map((s) => (
            <li
              key={s.id}
              className="rounded-full bg-zinc-800/80 px-2.5 py-1 text-xs text-zinc-300"
            >
              {s.descripcion}{" "}
              <span className="tabular-nums text-zinc-100">
                {formatMoneda(Math.abs(s.monto), s.moneda)}
              </span>
            </li>
          ))}
        </ul>
        <Link
          href="/suscripciones"
          prefetch={false}
          className={`${inlineLinkCls} mt-2 inline-block text-xs`}
        >
          Cambiar cuáles se descuentan
        </Link>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-subtle">No hay resúmenes pendientes de pago.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line">
            {visibles.map((f) => (
              <FilaPeriodo key={`${f.periodo}-${f.moneda}`} fila={f} />
            ))}
          </ul>
          {resto.length > 0 && (
            <details>
              <summary className="flex min-h-11 items-center text-sm text-zinc-300 hover:text-zinc-100">
                Ver {resto.length} {resto.length === 1 ? "período" : "períodos"} más
              </summary>
              <ul className="flex flex-col divide-y divide-line">
                {resto.map((f) => (
                  <FilaPeriodo key={`${f.periodo}-${f.moneda}`} fila={f} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Card>
  );
}

function FilaPeriodo({ fila }: { fila: FilaPreviewPago }) {
  const { periodo, moneda, bruto, descuento, neto } = fila;
  const aFavor = neto < 0;
  return (
    <li className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-200">{periodo}</span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-subtle">{aFavor ? "A tu favor" : "A pagar"}</span>
          <span
            className={`text-base font-semibold tabular-nums ${aFavor ? "text-emerald-400" : "text-zinc-50"}`}
          >
            {formatMoneda(Math.abs(neto), moneda)}
          </span>
        </span>
      </div>
      <p className="text-xs tabular-nums text-subtle">
        Resumen {formatMoneda(bruto, moneda)} − suscripciones{" "}
        {formatMoneda(descuento, moneda)}
      </p>
    </li>
  );
}
