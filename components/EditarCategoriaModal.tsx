"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { Transaccion } from "@/lib/db";
import { CATEGORIAS_DISPONIBLES } from "@/lib/categorizer";
import { actualizarCategoria } from "@/lib/actions";
import { formatMoneda } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Modal táctil con estética glassmorphism para reasignar la categoría de un
 * movimiento. Se abre desde el dashboard (Bento) al tocar una transacción.
 */
export default function EditarCategoriaModal({
  tx,
  onClose,
}: {
  tx: Transaccion | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {tx && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md rounded-t-2xl border border-white/10 bg-zinc-900/70 p-5 shadow-2xl backdrop-blur-xl sm:rounded-2xl"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-100">
                  {tx.descripcion || "(sin descripción)"}
                </p>
                <p className="text-xs text-zinc-400">
                  {formatMoneda(tx.monto, tx.moneda)} · categoría actual:{" "}
                  <span className="text-zinc-200">{tx.categoria}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CATEGORIAS_DISPONIBLES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={async () => {
                    if (tx.id != null) await actualizarCategoria(tx.id, c);
                    onClose();
                  }}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    c === tx.categoria
                      ? "border-white/30 bg-white/15 text-zinc-50"
                      : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
