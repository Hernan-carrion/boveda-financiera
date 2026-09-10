"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Estado = "ok" | "alerta" | "excedido";

const COLOR: Record<Estado, string> = {
  ok: "bg-emerald-500",
  alerta: "bg-orange-500",
  excedido: "bg-red-500",
};

/** % → color: >100 rojo, >80 naranja, resto verde. */
export function estadoDePct(pct: number): Estado {
  if (pct > 100) return "excedido";
  if (pct > 80) return "alerta";
  return "ok";
}

/**
 * Barra de progreso lineal animada (Framer Motion). El relleno se anima de 0
 * al % actual y el color depende del estado (verde / naranja / rojo).
 */
export function ProgressBar({
  pct,
  estado,
  className,
}: {
  pct: number;
  estado?: Estado;
  className?: string;
}) {
  const est = estado ?? estadoDePct(pct);
  const ancho = Math.max(0, Math.min(100, pct));

  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full bg-zinc-800",
        className,
      )}
    >
      <motion.div
        className={cn("h-full rounded-full", COLOR[est])}
        initial={{ width: 0 }}
        animate={{ width: `${ancho}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}

/**
 * Progreso circular animado para las metas de ahorro.
 */
export function CircleProgress({
  pct,
  size = 96,
  stroke = 9,
  color = "#34d399",
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circ - (clamped / 100) * circ;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#27272a"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums text-zinc-100">
        {children ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
}
