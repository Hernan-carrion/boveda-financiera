"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { procesarSuscripcionesVencidas } from "@/lib/actions";
import { startAutoSync } from "@/lib/syncService";
import { supabaseEnabled } from "@/lib/supabase";

/**
 * Inicialización de la app en el cliente:
 *  - Cobra las suscripciones vencidas del mes y avisa con un toast.
 *  - Arranca la sincronización automática con la nube (pull + realtime + cola
 *    offline) si Supabase está configurado.
 * Se monta una sola vez desde el layout raíz.
 */
export default function AppInit() {
  useEffect(() => {
    let cancelado = false;

    procesarSuscripcionesVencidas()
      .then((cobradas) => {
        if (cancelado || cobradas.length === 0) return;
        toast.success(
          cobradas.length === 1
            ? `Se registró la suscripción "${cobradas[0]}"`
            : `Se registraron ${cobradas.length} suscripciones del mes`,
          { description: cobradas.join(" · ") },
        );
      })
      .catch(() => {
        /* no bloquea la carga de la app */
      });

    let limpiar: (() => void) | undefined;
    if (supabaseEnabled) {
      limpiar = startAutoSync(() => {
        if (!cancelado) toast("Datos sincronizados desde la nube");
      });
    }

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
