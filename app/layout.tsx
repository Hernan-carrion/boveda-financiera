import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AppInit from "@/components/AppInit";
import NavBar from "@/components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * En GitHub Pages de proyecto el sitio vive bajo /boveda-financiera. Next
 * prefija `basePath` en assets y <Link>, pero NO en `metadata.manifest` ni en
 * los <link rel="icon">, así que acá lo anteponemos a mano. En local
 * (sin la env) queda "" y todo resuelve contra la raíz.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "👣 Huella",
  description:
    "Gestión de finanzas personales 100% local: cuentas, tarjetas y préstamos, multimoneda y offline.",
  manifest: `${BASE}/manifest.json`,
  applicationName: "Huella",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Huella",
  },
  icons: {
    icon: [
      { url: `${BASE}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${BASE}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: {
      url: `${BASE}/apple-touch-icon.png`,
      sizes: "180x180",
      type: "image/png",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <NavBar />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-zinc-800 px-4 py-4 text-center text-xs text-zinc-600">
          Huella · datos guardados sólo en este dispositivo (IndexedDB)
        </footer>
        <ServiceWorkerRegister />
        <AppInit />
      </body>
    </html>
  );
}
