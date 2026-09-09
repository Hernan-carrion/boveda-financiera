import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Moneda } from "./db";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoneda(monto: number, moneda: Moneda) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(monto ?? 0);
}

/** Como formatMoneda pero sin decimales, para montos grandes en tableros. */
export function formatMonedaCompact(monto: number, moneda: Moneda) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(monto ?? 0);
}

/** "+12,3%" / "−4,0%" con signo explícito. */
export function formatPct(valor: number, decimals = 1) {
  const n = Number.isFinite(valor) ? valor : 0;
  const signo = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${signo}${Math.abs(n).toFixed(decimals)}%`;
}

export function formatFecha(fecha: string | Date) {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd MMM yyyy · HH:mm", { locale: es });
}

export function periodoActual(fecha = new Date()) {
  return format(fecha, "yyyy-MM");
}
