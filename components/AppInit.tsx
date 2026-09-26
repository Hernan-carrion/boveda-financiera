"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import {
  avisarSuscripcionesProximas,
  avisarRecordatoriosProximos,
  procesarSuscripcionesVencidas,
} from "@/lib/actions";
import { startAutoSync, pullFromCloud, pushConCola } from "@/lib/syncService";
import { supabaseEnabled } from "@/lib/supabase";
import { formatMoneda } from "@/lib/utils";

/**
 * Inicialización de la app en el cliente:
 *  - Si hay sync, espera el pull inicial ANTES de tocar nada local — si se
 *    dispara en paralelo, el `bulkPut` del pull puede pisar con el estado
 *    viejo de la nube una escritura local recién hecha (ver el comentario en
 *    `lib/syncService.ts::startAutoSync`), y eso hacía que una suscripción
 *    vencida se cobrara de nuevo en cada apertura de la app y que el
 *    descuento del saldo no quedara reflejado en el patrimonio.
 *  - Cobra las suscripciones vencidas del mes y avisa con un toast.
 *  - Avisa (sin cobrar) las suscripciones que se cobran en 2 días.
 *  - Avisa los recordatorios próximos (turnos, vencimientos de documentos…).
 *  - Si algo de lo anterior escribió localmente, sube ese cambio a la nube
 *    ACÁ MISMO (`pushConCola`), sin esperar al auto-push reactivo — ese
 *    depende de un listener (`onEscrituraLocal`) que recién se conecta más
 *    abajo, en `startAutoSync`, así que una escritura de ESTE mismo `init()`
 *    (como el cobro de una suscripción vencida) pasa antes de que el
 *    listener exista y nunca dispara el auto-push. Si el usuario cierra la
 *    pestaña o navega rápido después de abrir la app, ese cobro queda sólo
 *    local — y el próximo pull lo vuelve a ver como "no cobrado todavía" y
 *    lo cobra de nuevo. Confirmado en producción: probarlo a mano generó
 *    varios cobros duplicados de una suscripción, todos locales, ninguno
 *    llegó a subir — exactamente este hueco.
 *  - Recién ahí arranca el resto de la sincronización automática (realtime +
 *    cola offline + auto-push en tiempo real de cada cambio local).
 * Se monta una sola vez desde el layout raíz.
 */
export default function AppInit() {
  useEffect(() => {
    let cancelado = false;
    let limpiar: (() => void) | undefined;

    async function init() {
      if (supabaseEnabled) {
        try {
          await pullFromCloud();
        } catch {
          /* sin conexión o sin configurar — seguimos con lo local */
        }
        if (cancelado) return;
      }

      try {
        const cobradas = await procesarSuscripcionesVencidas();
        if (!cancelado && cobradas.length > 0) {
          toast.success(
            cobradas.length === 1
              ? `Se registró la suscripción "${cobradas[0]}"`
              : `Se registraron ${cobradas.length} suscripciones del mes`,
            { description: cobradas.join(" · ") },
          );
        }
      } catch {
        /* no bloquea la carga de la app */
      }

      try {
        const proximas = await avisarSuscripcionesProximas();
        if (!cancelado) {
          proximas.forEach((s) => {
            toast(`"${s.descripcion}" se cobra en 2 días`, {
              description: formatMoneda(s.monto, s.moneda),
              icon: "⏰",
            });
          });
        }
      } catch {
        /* no bloquea la carga de la app */
      }

      try {
        const proximosRecordatorios = await avisarRecordatoriosProximos();
        if (!cancelado) {
          proximosRecordatorios.forEach((r) => {
            toast(`"${r.titulo}" ${r.dias === 0 ? "es hoy" : `en ${r.dias} día${r.dias === 1 ? "" : "s"}`}`, {
              icon: "🔔",
            });
          });
        }
      } catch {
        /* no bloquea la carga de la app */
      }

      if (supabaseEnabled) {
        try {
          // Push incondicional: procesarSuscripcionesVencidas/avisar* pueden
          // haber escrito (cobro, avance de fecha de un recordatorio que se
          // repite, marca de aviso) sin que haya forma barata de saber cuál
          // de las tres escribió — más simple y más seguro subir siempre acá
          // que arriesgarse a dejar una escritura sin sincronizar.
          await pushConCola();
        } catch {
          /* si falla, el auto-push de startAutoSync más abajo lo va a reintentar en la próxima escritura */
        }
      }

      if (cancelado || !supabaseEnabled) return;
      limpiar = startAutoSync(
        () => {
          if (!cancelado) toast("Datos sincronizados desde la nube");
        },
        (resultado) => {
          // Silencioso cuando sale bien (pasa después de casi cualquier
          // acción); sólo avisamos si el auto-push falló, para que se pueda
          // actuar (ej: reintentar cuando vuelva la conexión).
          if (!cancelado && !resultado.ok) {
            toast.error("No se pudo sincronizar con la nube", {
              description: resultado.detail ?? resultado.message,
            });
          }
        },
      );
    }

    void init();

    return () => {
      cancelado = true;
      limpiar?.();
    };
  }, []);

  return (
    <Toaster
      theme="dark"
      position="top-right"
      toastOptions={{
        style: {
          background: "rgba(24,24,27,0.85)",
          border: "1px solid #3f3f46",
          color: "#f4f4f5",
          backdropFilter: "blur(8px)",
        },
      }}
    />
  );
}
