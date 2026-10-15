"use client";

import { useEffect } from "react";

/**
 * Registra el Service Worker para que la PWA sea instalable y funcione offline.
 * Se monta una sola vez desde el layout raíz.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // En GitHub Pages de proyecto el SW vive bajo /boveda-financiera.
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

    let registro: ServiceWorkerRegistration | undefined;
    const register = () => {
      navigator.serviceWorker
        .register(`${base}/sw.js`, { scope: `${base}/` })
        .then((r) => {
          registro = r;
        })
        .catch((err) => console.warn("SW no registrado:", err));
    };

    // Una PWA instalada puede quedar abierta días en segundo plano: al volver
    // al primer plano se busca un SW nuevo, y cuando toma el control se
    // recarga una sola vez para no seguir con el JS viejo (que sincroniza mal).
    const buscarActualizacion = () => {
      if (document.visibilityState === "visible") registro?.update().catch(() => undefined);
    };
    const teniaControlador = !!navigator.serviceWorker.controller;
    let recargando = false;
    const alCambiarControlador = () => {
      if (!teniaControlador || recargando) return;
      recargando = true;
      window.location.reload();
    };
    document.addEventListener("visibilitychange", buscarActualizacion);
    window.addEventListener("focus", buscarActualizacion);
    navigator.serviceWorker.addEventListener("controllerchange", alCambiarControlador);
    const limpiar = () => {
      document.removeEventListener("visibilitychange", buscarActualizacion);
      window.removeEventListener("focus", buscarActualizacion);
      navigator.serviceWorker.removeEventListener("controllerchange", alCambiarControlador);
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => {
        window.removeEventListener("load", register);
        limpiar();
      };
    }
    return limpiar;
  }, []);

  return null;
}
