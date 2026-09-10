import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import {
  Wallet,
  PieChart,
  History,
  CreditCard,
  HandCoins,
  Coins,
  Settings,
} from "lucide-react";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

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

export const metadata: Metadata = {
  title: "Bóveda Financiera",
  description:
    "Gestión de finanzas personales 100% local: cuentas, tarjetas y préstamos, multimoneda y offline.",
  manifest: "/manifest.json",
  applicationName: "Bóveda",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bóveda",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

const navLinks = [
  { href: "/", label: "Dashboard", Icon: Wallet },
  { href: "/resumen", label: "Resumen", Icon: PieChart },
  { href: "/historico", label: "Histórico", Icon: History },
  { href: "/tarjetas", label: "Tarjetas", Icon: CreditCard },
  { href: "/prestamos", label: "Préstamos", Icon: HandCoins },
  { href: "/inversiones", label: "Inversiones", Icon: Coins },
  { href: "/configuracion", label: "Configuración", Icon: Settings },
];

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
        <header className="border-b border-zinc-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link
              href="/"
              prefetch={false}
              className="font-semibold tracking-tight text-zinc-50"
            >
              🏦 Bóveda
            </Link>
            <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
              {navLinks.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  className="flex items-center gap-1.5 transition-colors hover:text-zinc-100"
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-zinc-800 px-4 py-4 text-center text-xs text-zinc-600">
          Bóveda Financiera · datos guardados sólo en este dispositivo (IndexedDB)
        </footer>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
