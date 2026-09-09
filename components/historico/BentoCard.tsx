import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Accent = "in" | "out" | "equity" | "none";

const glowByAccent: Record<Accent, string> = {
  in: "before:bg-[#4ade80]",
  out: "before:bg-[#fb7185]",
  equity: "before:bg-[#3b82f6]",
  none: "before:bg-transparent",
};

/**
 * Celda de la grilla Bento: fondo casi negro, borde sutil, glassmorphism leve
 * y una línea de acento tenue en el borde superior.
 */
export default function BentoCard({
  children,
  className,
  accent = "none",
}: {
  children: ReactNode;
  className?: string;
  accent?: Accent;
}) {
  return (
    <div
      className={cn(
        "group relative flex min-h-[8.5rem] flex-col overflow-hidden rounded-2xl p-5",
        "border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_20px_40px_-24px_rgba(0,0,0,0.8)]",
        "before:pointer-events-none before:absolute before:inset-x-8 before:-top-px before:h-px before:opacity-40",
        glowByAccent[accent],
        className,
      )}
    >
      {children}
    </div>
  );
}
