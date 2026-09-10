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

    const register = () => {
      navigator.serviceWorker
        .register(`${base}/sw.js`, { scope: `${base}/` })
        .catch((err) => console.warn("SW no registrado:", err));
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
