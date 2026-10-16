import type { NextConfig } from "next";

/**
 * Bóveda Financiera — PWA 100% Local-First.
 * Export estático para GitHub Pages: no hay servidor, todo vive en el cliente
 * (IndexedDB via Dexie). Por eso NO existe la carpeta `app/api/`.
 *
 * Para GitHub Pages de proyecto (usuario.github.io/repo) el workflow define
 * NEXT_PUBLIC_BASE_PATH=/repo para que los assets resuelvan bien.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  // Identifica el build en Configuración, para saber qué versión corre cada dispositivo.
  env: { NEXT_PUBLIC_BUILD_ID: Date.now().toString(36) },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
};

export default nextConfig;
